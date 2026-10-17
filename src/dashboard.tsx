import RecordEditor from './record-editor';
import { useState, useEffect } from 'react';
import { Home, Upload, BookOpen, Users, ShieldCheck, Mail, BarChart3, ListFilter, Settings, Bell, Calendar, ChevronDown, Plus, Search, Copy, GraduationCap, Menu, X, Printer, Check, LogOut } from 'lucide-react';
import { initials, greeting, scheduleTime } from './presentation';
import { loadSchool, saveSchool, friendlyError, generateStudentPasscodes, importStudentRoster, updateRecord, createRecord, deleteRecord } from './school-store';
const pages = ['Overview', 'Rosters', 'Classes & Codes', 'Students & Passcodes', 'Teachers & Access', 'Guardians', 'Reports', 'System Logs', 'Settings'];
const icons = [Home, Upload, BookOpen, Users, ShieldCheck, Mail, BarChart3, ListFilter, Settings];
const descriptions = ['Accounts, rosters and system health at a glance', 'Import official class lists from the school registrar', 'Create sections, assign teachers and generate class codes', 'Student accounts, sign-in passcodes and locked accounts', 'Teacher accounts, class assignments and role permissions', 'Contacts for the weekly progress email', 'School-wide performance and engagement for decision-making', 'Who did what, and when, across EduLearn', 'Rules and content that apply to every class'];
function Badge({ children }: any) { return <span className={'badge ' + (/Pending|No passcode|Draft|Not sent|Not started/.test(children) ? 'amber' : /Bounced|Locked|No email|Suspended/.test(children) ? 'red' : '')}>{children}</span>; }
function csv(name: string, rows: any[]) { const keys = Object.keys(rows[0] || {}), text = [keys, ...rows.map(r => keys.map(k => r[k]))].map(r => r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8;' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function parseCSV(text: string) {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (q && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else
                q = !q;
        }
        else if (c === ',' && !q) {
            row.push(cell);
            cell = '';
        }
        else if ((c === '\n' || c === '\r') && !q) {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            if (row.some(Boolean))
                rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    }
    row.push(cell);
    if (row.some(Boolean))
        rows.push(row);
    if (q)
        throw Error('Unclosed CSV quote');
    return rows;
}
export default function Dashboard({ email, onSignOut }: any) {
    const [data, D] = useState<any>(null), [rev, R] = useState(0), [page, P] = useState('Overview'), [grade, G] = useState('All grades'), [cid, C] = useState('c1'), [search, S] = useState(''), [filter, F] = useState('All'), [modal, M] = useState<any>(null), [toast, T] = useState(''), [busy, B] = useState(false), [error, E] = useState(''), [mobile, U] = useState(false), [tab, V] = useState('School and school year'), [file, Q] = useState<File | null>(null), [parsed, J] = useState<any>(null), [draft, K] = useState<any>(null);
    useEffect(() => { loadSchool().then(v => { D(v.data); K(v.data.settings); C(v.data.classes[0]?.id || ''); R(v.revision); }).catch(e => E(friendlyError(e))); }, []);
    useEffect(() => {
        if (!modal)
            return;
        const previous = document.activeElement as HTMLElement | null;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const root = document.querySelector<HTMLElement>('.modal');
        const elements = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]') || []);
        (root?.querySelector<HTMLElement>('[autofocus]') || elements()[0])?.focus();
        const handle = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                M(null);
            }
            if (event.key === 'Tab') {
                const items = elements(), first = items[0], last = items[items.length - 1];
                if (!first)
                    return;
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', handle);
        return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', handle); previous?.focus(); };
    }, [modal, busy]);
    function notify(s: string) { T(s); setTimeout(() => T(''), 5000); }
    function nav(p: string) { P(p); S(''); F('All'); G('All grades'); U(false); }
    async function mutate(fn: any, action: string, type = 'Accounts and rosters') {
        if (busy)
            return false;
        const n = structuredClone(data);
        fn(n);
        n.logs.unshift({ date: new Date().toISOString(), who: data.settings.name, type, action });
        B(true);
        try {
            const v = await saveSchool(n, rev);
            D(v.data);
            R(v.revision);
            notify(action);
            return true;
        }
        catch (e: any) {
            notify(friendlyError(e));
            return false;
        }
        finally {
            B(false);
        }
    }
    function random() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(7)), n => chars[n % chars.length]).join('') + '!'; }
    async function perform(operation: () => Promise<any>, message: string) {
        if (busy)
            return false;
        B(true);
        try {
            const result = await operation();
            D(result.data);
            R(result.revision);
            notify(message);
            return true;
        }
        catch (error) {
            notify(friendlyError(error));
            return false;
        }
        finally {
            B(false);
        }
    }
    async function generate(id?: string) { const classId = id ? data.students.find((s: any) => s.id === id)?.classId : cid; return perform(() => generateStudentPasscodes(classId, rev, id), 'Student passcodes saved'); }
    if (error)
        return <div className="loading"><h2>Unable to load school records</h2><p>{error}</p><button onClick={() => location.reload()}>Try again</button><button className="secondary" onClick={onSignOut}>Sign out</button></div>;
    if (!data)
        return <div className="loading"><GraduationCap size={44}/><h2>Opening EduLearn…</h2></div>;
    const name = (id: string) => data.classes.find((c: any) => c.id === id)?.name || 'Unassigned', classes = data.classes.filter((c: any) => grade === 'All grades' || c.grade === Number(grade.replace('Grade ', ''))), missing = data.students.filter((s: any) => !s.passcode).length, issues = data.guardians.filter((g: any) => !g.email || g.report === 'Bounced').length, pending = data.guardians.filter((g: any) => g.consent === 'Pending').length;
    const invitationCount = data.teachers.filter((t: any) => t.status === 'Draft invitation').length;
    const attentionItems: any[] = [];
    if (missing)
        attentionItems.push([missing + ' students need passcodes', 'Choose a class to prepare student sign-in details.', 'Review students', () => nav('Students & Passcodes'), Users]);
    if (issues)
        attentionItems.push([issues + ' guardian contacts need review', 'Update missing or bounced email addresses.', 'Review contacts', () => { nav('Guardians'); F('Email problems'); }, Mail]);
    if (invitationCount)
        attentionItems.push([invitationCount + ' teacher invitation' + (invitationCount === 1 ? '' : 's') + ' in draft', 'Review account details before sending invitations.', 'Review teachers', () => nav('Teachers & Access'), ShieldCheck]);
    if (pending)
        attentionItems.push([pending + ' guardian consents pending', 'Record consent before sharing student progress.', 'Review consent', () => { nav('Guardians'); F('Consent pending'); }, ShieldCheck]);
    const students = data.students.filter((s: any) => s.classId === cid && s.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || s.status === filter));
    const table = (heads: string[], rows: any[]) => <div className="table-wrap"><table><thead><tr>{heads.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((v: any, j: number) => <td key={j}>{v}</td>)}</tr>) : <tr><td colSpan={heads.length} className="empty">No matching records.</td></tr>}</tbody></table></div>;
    const card = (title: string, content: any, action?: any) => <section className="card"><div className="card-title"><h3>{title}</h3>{action}</div>{content}</section>;
    const select = <select aria-label="Class" value={cid} onChange={e => { C(e.target.value); J(null); }}>{data.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
    const gradeSelect = <select aria-label="Grade" value={grade} onChange={e => G(e.target.value)}>{['All grades', 'Grade 4', 'Grade 5', 'Grade 6'].map(g => <option key={g}>{g}</option>)}</select>;
    const progress = (n: number) => <div className="progress"><div><i style={{ width: n + '%' }}/></div><span>{n}%</span></div>;
    const stats = (rows: any[]) => <div className="stats">{rows.map(([t, n, s, p, I]: any, i) => { const Tag = p ? 'button' : 'div'; return <Tag key={t} className={'stat card ' + (p ? 'stat-action' : '')} onClick={p ? () => nav(p) : undefined}>{I && <span className={'stat-icon color' + i}><I size={22}/></span>}<div><span>{t}</span><strong>{n}</strong><small>{s}</small></div></Tag>; })}</div>;
    return <div className="app"><a className="skip-link" href="#workspace">Skip to content</a>{mobile && <button className="nav-scrim" aria-label="Close navigation" onClick={() => U(false)}/>}<aside className={mobile ? 'sidebar open' : 'sidebar'}><div className="brand"><GraduationCap size={44}/><strong>EDULEARN</strong><small>ADMIN PANEL</small></div><div className="nav-caption">WORKSPACE</div><nav aria-label="Main navigation">{pages.map((p, i) => { const Icon = icons[i]; return <button key={p} aria-current={page === p ? 'page' : undefined} className={page === p ? 'selected' : ''} onClick={() => nav(p)}><Icon size={17}/><span>{p}</span>{(i === 3 && missing > 0 || i === 5 && issues > 0) && <b>{i === 3 ? missing : issues}</b>}</button>; })}</nav><div className="sidebar-bottom"><div className="school-name">{data.settings.school}<br />{data.settings.department}, S.Y. {data.settings.year}</div><div className="account"><span className="avatar">{initials(data.settings.name)}</span><div><strong>{data.settings.name}</strong><small>School Administrator</small></div><button className="icon-btn" type="button" title="Sign out" onClick={onSignOut}><LogOut size={14}/></button></div></div></aside><main id="workspace" tabIndex={-1}><header><button className="mobile-menu icon-btn" onClick={() => U(!mobile)} aria-expanded={mobile} aria-label="Toggle navigation"><Menu /></button><div><h1>{page === 'Overview' ? greeting() + ', ' + data.settings.name : page === 'Settings' ? 'System settings' : page}</h1><p>{descriptions[pages.indexOf(page)]}</p></div><div className="header-actions"><span className="year"><Calendar size={14}/> S.Y. {data.settings.year}</span><button className="icon-btn notification" aria-label="View attention items" onClick={() => nav('Overview')}><Bell size={18}/><i /></button><span className="avatar">{initials(data.settings.name)}</span><div className="header-user"><strong>{data.settings.name}</strong><small>Administrator</small></div><button className="icon-btn" aria-label="Account details" onClick={() => M({ kind: 'account' })}><ChevronDown size={15}/></button></div></header>
    {page === 'Overview' && <>{stats([['Students', data.classes.reduce((s: number, c: any) => s + c.count, 0), 'In ' + data.classes.length + ' classes', 'Rosters', Users], ['Teachers', data.teachers.filter((t: any) => t.status === 'Active').length, invitationCount ? invitationCount + ' draft invitation' + (invitationCount === 1 ? '' : 's') : 'Active teacher accounts', 'Teachers & Access', ShieldCheck], ['Passcodes to generate', missing, 'Student accounts awaiting access', 'Students & Passcodes', Users], ['Guardian emails to fix', issues, 'Bounced or missing', 'Guardians', Mail]])}<div className="overview-grid"><div>{card('Needs your attention', <div className="attention">{!attentionItems.length && <div className="attention-clear"><Check size={20}/><div><strong>All caught up</strong><small>No outstanding access or guardian contact issues.</small></div></div>}{attentionItems.map(([a, b, c, fn, Icon]: any, i) => <div key={a}><span className={'attention-icon color' + i}><Icon size={18}/></span><div><strong>{a}</strong><small>{b}</small></div><button disabled={busy} className={i === 0 ? '' : 'secondary'} onClick={fn}>{c}</button></div>)}</div>, <small>{attentionItems.length ? attentionItems.length + ' to review' : 'Up to date'}</small>)}{card('Classes this school year', table(['Class / Teacher', 'Students', 'Class code', 'Quest completion'], data.classes.map((c: any) => [<><strong>{c.name}</strong><small>{c.teacher}</small></>, c.count, <Badge>{c.code}</Badge>, progress(c.completion)])), <button className="link" onClick={() => nav('Classes & Codes')}>Manage classes and codes</button>)}</div><div>{card('Quick actions', <div className="quick">{[[Upload, 'Upload a roster', () => nav('Rosters')], [BookOpen, 'Create a class', () => M({ kind: 'class' })], [ShieldCheck, 'Invite a teacher', () => M({ kind: 'teacher' })], [Printer, 'Print passcode slips', () => { nav('Students & Passcodes'); setTimeout(() => window.print(), 100); }]].map(([I, t, f]: any) => <button key={t} className="secondary" onClick={f}><I size={21}/>{t}</button>)}</div>)}<div className="email-card"><small>Guardian email schedule</small><h3>{data.settings.day} <span className="schedule-divider">/</span> {scheduleTime(data.settings.time)}</h3><p>{issues} contacts to fix · {pending} consents pending</p><button onClick={() => nav('Guardians')}>Review guardian contacts</button><small className="integration-note">Sending is paused until email is connected.</small></div>{card('Recent activity', <div className="activity">{data.logs.slice(0, 5).map((l: any, i: number) => <div key={i}><i /><span>{l.action}<small>{l.who} · {new Date(l.date).toLocaleDateString()}</small></span></div>)}</div>, <button className="link" onClick={() => nav('System Logs')}>View all logs</button>)}</div></div></>}
    {page === 'Classes & Codes' && <><div className="toolbar"><div className="tabs">{['All grades', 'Grade 4', 'Grade 5', 'Grade 6'].map(g => <button className={grade === g ? 'active' : ''} key={g} onClick={() => G(g)}>{g}</button>)}</div><button onClick={() => M({ kind: 'class' })}><Plus size={16}/> New class</button></div><section className="card">{table(['Class', 'Teacher', 'Students', 'Class code', 'Status', ''], classes.map((c: any) => [<><strong>{c.name}</strong><small>Araling Panlipunan</small></>, c.teacher, c.count, <div className="code">{c.code}<button className="icon-btn" aria-label={'Copy ' + c.code} onClick={() => navigator.clipboard.writeText(c.code).then(() => notify('Class code copied')).catch(() => notify('Select the code to copy it.'))}><Copy size={14}/></button></div>, <Badge>{c.status}</Badge>, <button className="secondary" onClick={() => M({ kind: 'class', record: c })}>Edit</button>]))}</section><p className="footnote">Each class code is unique. Students use their class code and their own passcode.</p></>}
    {page === 'Students & Passcodes' && <><div className="toolbar"><p>Click a student name to edit their record or remove it.</p><button disabled={!data.classes.length} onClick={() => M({ kind: 'record', resource: 'students' })}><Plus size={16}/> Add student</button></div><div className="toolbar wrap"><div className="controls">{select}{['All', 'Active', 'No passcode', 'Locked'].map(f => <button className={'pill ' + (filter === f ? 'active' : '')} key={f} onClick={() => F(f)}>{f} ({data.students.filter((s: any) => s.classId === cid && (f === 'All' || s.status === f)).length})</button>)}</div><div className="controls"><label className="search"><Search size={15}/><input aria-label="Search students" placeholder="Search" value={search} onChange={e => S(e.target.value)}/></label><button className="secondary" onClick={() => window.print()}><Printer size={15}/> Print slips</button><button disabled={busy} onClick={() => generate()}>Generate passcodes</button></div></div><div className="notice"><ShieldCheck size={18}/> Every passcode is unique: 8 characters with uppercase letters, numbers and a special character. Class code: <strong>{data.classes.find((c: any) => c.id === cid)?.code}</strong></div><section className="card">{table(['Student', 'Passcode', 'Status', 'Last sign-in', ''], students.map((s: any) => [<div className="person"><span className="avatar small">{s.name.split(' ').map((n: string) => n[0]).join('')}</span><button className="link" onClick={() => M({ kind: 'record', resource: 'students', record: s })}>{s.name}</button></div>, <code className={!s.passcode ? 'unset' : ''}>{s.passcode || 'Not generated'}</code>, <Badge>{s.status}</Badge>, s.last, <button disabled={busy} onClick={() => s.status === 'Locked' ? mutate((n: any) => { n.students.find((a: any) => a.id === s.id).status = 'Active'; }, 'Unlocked ' + s.name) : s.passcode ? M({ kind: 'student', record: s }) : generate(s.id)}>{s.status === 'Locked' ? 'Unlock' : s.passcode ? 'Manage' : 'Generate'}</button>]))}<p className="table-footer">Showing {students.length} students in {name(cid)}.</p></section></>}
    {page === 'Teachers & Access' && <>{card('Teacher accounts', table(['Teacher', 'Subject', 'Classes', 'Status', ''], data.teachers.map((t: any) => [<><strong>{t.name}</strong><small>{t.email}</small></>, t.subject, data.classes.filter((c: any) => c.teacher === t.name).map((c: any) => c.name).join(', ') || 'No classes yet', <Badge>{t.status}</Badge>, <button className="secondary" onClick={() => M({ kind: 'teacher', record: t })}>Manage</button>])), <button onClick={() => M({ kind: 'teacher' })}><Plus size={16}/> Invite teacher</button>)}{card('Role permissions', <><p className="section-description">Each role only sees what it needs. Guardians receive weekly progress emails.</p>{table(['Permission', 'Administrator', 'Teacher', 'Student', 'Guardian'], [['Upload manuscripts and manage quests', '—', 'Yes', '—', '—'], ['Lock and unlock syllabus chapters', '—', 'Yes', '—', '—'], ['Record attendance and grades', '—', 'Yes', '—', '—'], ['View student progress and reports', 'All classes', 'Own classes', 'Own progress', 'Weekly email'], ['Send reminders to students', '—', 'Yes', '—', '—'], ['Import rosters and create student accounts', 'Yes', '—', '—', '—'], ['Generate class codes and passcodes', 'Yes', '—', '—', '—'], ['Manage teacher access', 'Yes', '—', '—', '—'], ['System settings and logs', 'Yes', '—', '—', '—'], ['Play quests, earn coins and badges', '—', '—', 'Yes', '—']])}<p className="table-footer">Teacher and student portals are separate from this administrator workspace.</p></>)}</>}
    {page === 'Guardians' && <><div className="toolbar"><p>Click a guardian name to edit the contact or remove it.</p><button disabled={!data.classes.length} onClick={() => M({ kind: 'record', resource: 'guardians' })}><Plus size={16}/> Add guardian</button></div>{stats([['Next email schedule', data.settings.day, data.settings.time], ['Delivered in sample data', '132', 'Of 135 guardians'], ['Emails to fix', issues, 'Bounced or missing'], ['Consent pending', pending, 'Needed before sharing progress']])}{issues > 0 && <div className="alert"><Mail size={17}/> Some guardian emails are missing or bounced.<button className="secondary" onClick={() => F('Email problems')}>Fix email</button></div>}<div className="toolbar"><div className="controls">{['All', 'Email problems', 'Consent pending'].map(f => <button key={f} className={'pill ' + (filter === f ? 'active' : '')} onClick={() => F(f)}>{f} ({f === 'All' ? data.guardians.length : f === 'Email problems' ? issues : pending})</button>)}</div><select aria-label="Filter guardians by class" value={grade} onChange={e => G(e.target.value)}><option value="All grades">All classes</option>{data.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><section className="card">{table(['Guardian', 'Student', 'Email', 'Last report', 'Consent', ''], data.guardians.filter((g: any) => (filter === 'All' || filter === 'Email problems' && (!g.email || g.report === 'Bounced') || filter === 'Consent pending' && g.consent === 'Pending') && (grade === 'All grades' || g.classId === grade)).map((g: any) => [<button className="link" onClick={() => M({ kind: 'record', resource: 'guardians', record: g })}>{g.name}</button>, <>{g.student}<small>{name(g.classId)}</small></>, <span className={!g.email || g.report === 'Bounced' ? 'danger' : ''}>{g.email || 'No email on file'}</span>, <Badge>{g.report}</Badge>, <Badge>{g.consent}</Badge>, <div className="controls"><button className="secondary" onClick={() => M({ kind: 'guardian', record: g })}>{g.email ? 'Edit email' : 'Add email'}</button>{g.consent === 'Pending' && <button disabled={busy} onClick={() => M({ kind: 'consent', record: g })}>Record consent</button>}</div>]))}</section><p className="footnote">Contact details and consent records are private. Email delivery service is not connected.</p></>}
    {page === 'Rosters' && <>{card('Import a registrar roster', <><p className="section-description">Upload CSV columns: name, guardian_name, guardian_email. Duplicate student names in the selected class are skipped.</p><div className="import-controls"><label>Class{select}</label><label className="upload-field"><Upload size={18}/><input type="file" accept=".csv,text/csv" onChange={e => { Q(e.target.files?.[0] || null); J(null); }}/></label><button className="secondary" onClick={() => csv('roster-template.csv', [{ name: 'Student name', guardian_name: 'Guardian name', guardian_email: 'guardian@example.com' }])}>Template</button><button disabled={!file || busy} onClick={async () => {
                    try {
                        if (file!.size > 1000000)
                            throw Error('Choose a CSV smaller than 1 MB.');
                        const rows = parseCSV(await file!.text()), header = rows.shift()!.map(s => s.trim().toLowerCase().replace(/^\uFEFF/, '')), index = header.indexOf('name');
                        if (index < 0)
                            throw Error('CSV must include a name column.');
                        const records = rows.map(r => ({ name: r[index]?.trim(), guardianName: r[header.indexOf('guardian_name')]?.trim() || '', email: r[header.indexOf('guardian_email')]?.trim() || '' })).filter(r => r.name);
                        if (!records.length)
                            throw Error('No student names found.');
                        J(records);
                        notify('Checked ' + records.length + ' student rows.');
                    }
                    catch (e: any) {
                        notify(e.message);
                    }
                }}>Check file</button></div>{parsed && <div className="notice"><span>{parsed.length} rows ready for {name(cid)}.</span><button disabled={busy} onClick={async () => {
                        const ok = await perform(() => importStudentRoster(cid, file!.name, parsed, rev), 'Roster imported');
                        if (ok) {
                            J(null);
                            Q(null);
                        }
                    }}>Import roster</button></div>}</>)}<div className="roster-grid">{card('Import history', table(['Date', 'File', 'Class', 'Added', 'Skipped', ''], data.imports.map((i: any) => [i.date, i.file, name(i.classId), i.added, i.skipped, <button className="secondary" onClick={() => csv('class-roster.csv', data.students.filter((s: any) => s.classId === i.classId).map((s: any) => ({ name: s.name, class: name(s.classId) })))}>Download class</button>])))}{card('Roster status', <div className="roster-status">{data.classes.map((c: any) => <div key={c.id}><strong>{c.name}</strong><span>{c.count} students</span><small>{data.imports.find((i: any) => i.classId === c.id)?.date || 'No imports yet'}</small></div>)}<p>Importing a roster creates student accounts. Duplicate names within a class are skipped.</p></div>)}</div></>}
    {page === 'Reports' && <><div className="toolbar"><div className="controls">{gradeSelect}<span className="year">Current sample reporting period</span></div><div className="controls"><button className="secondary" onClick={() => csv('edulearn-report.csv', classes)}>Export data (CSV)</button><button onClick={() => window.print()}>Print / save school report</button></div></div><div className="notice">Sample learning analytics. Connect the student learning app to receive live quest, score, attendance and activity data.</div>{stats([['Quest completion', Math.round(classes.reduce((s: number, c: any) => s + c.completion, 0) / (classes.length || 1)) + '%', 'Across selected classes'], ['Average score', Math.round(classes.filter((c: any) => c.score).reduce((s: number, c: any) => s + c.score, 0) / (classes.filter((c: any) => c.score).length || 1)) + '%', 'Quizzes and boss battles'], ['Attendance rate', '93%', 'Sample attendance'], ['Active in the app', '113 students', 'Sample weekly activity']])}{card('Classes compared', table(['Class', 'Teacher', 'Quest completion', 'Avg. score', 'Attendance', 'Need support'], classes.map((c: any) => [<strong>{c.name}</strong>, c.teacher, progress(c.completion), c.score ? c.score + '%' : '—', c.attendance ? c.attendance + '%' : '—', <Badge>{c.completion ? '3 students' : 'Not started'}</Badge>])))}<div className="report-grid">{card('Most looked-up Filipino words', <><p className="section-description">Words students tap most may need extra classroom support.</p>{[['kapuluan', 142], ['rehiyon', 128], ['lalawigan', 97], ['kasarinlan', 84], ['katutubo', 76], ['anyong lupa', 61]].map(([w, n]: any) => <div className="word" key={w}><strong>{w}</strong><div><i style={{ width: n / 142 * 100 + '%' }}/></div><span>{n}</span></div>)}</>)}{card('Language support use', <div className="language-grid">{[['71%', 'Lookups shown in Mandarin'], ['29%', 'Lookups shown in English'], ['4.2', 'Hints used per student'], ['612', 'Audio read-alouds played']].map(([n, t], i) => <div className={'color' + i} key={t}><strong>{n}</strong><small>{t}</small></div>)}</div>)}</div></>}
    {page === 'System Logs' && <><div className="toolbar wrap"><div className="controls">{['All', 'Accounts and rosters', 'Teacher access', 'Emails and reminders', 'Settings'].map(f => <button key={f} className={'pill ' + (filter === f ? 'active' : '')} onClick={() => F(f)}>{f === 'All' ? 'All activity' : f}</button>)}</div></div><div className="toolbar"><label className="search"><Search size={16}/><input aria-label="Search logs" placeholder="Search name or action" value={search} onChange={e => S(e.target.value)}/></label><button onClick={() => csv('edulearn-logs.csv', data.logs)}>Export CSV</button></div><section className="card">{table(['When', 'Who', 'Type', 'Action'], data.logs.filter((l: any) => (filter === 'All' || l.type === filter) && (l.who + ' ' + l.action).toLowerCase().includes(search.toLowerCase())).map((l: any) => [new Date(l.date).toLocaleString(), <strong>{l.who}</strong>, <Badge>{l.type}</Badge>, l.action]))}<p className="table-footer">{data.logs.length} entries. Logs are visible only to administrators.</p></section></>}
    {page === 'Settings' && <div className="settings-layout"><div className="card settings-tabs">{['School and school year', 'Learning rules', 'Notifications', 'Shop catalog', 'Data privacy', 'Security'].map(t => <button className={tab === t ? 'active' : ''} key={t} onClick={() => V(t)}>{t}</button>)}</div><form className="card settings-card" onSubmit={async (e) => { e.preventDefault(); await mutate((n: any) => { n.settings = draft; }, 'Saved system settings', 'Settings'); }}><div className="card-title"><div><h3>{tab}</h3><p>School-wide administration preferences</p></div></div><div className="settings-fields">{tab === 'School and school year' ? <>{[['school', 'School name'], ['department', 'Department'], ['year', 'Current school year'], ['name', 'Administrator name']].map(([k, t]) => <label key={k}>{t}<input required value={draft[k]} onChange={e => K({ ...draft, [k]: e.target.value })}/></label>)}</> : tab === 'Notifications' ? <><label>Email schedule day<select value={draft.day} onChange={e => K({ ...draft, day: e.target.value })}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <option key={d}>{d}</option>)}</select></label><label>Email schedule time<input type="time" value={draft.time} onChange={e => K({ ...draft, time: e.target.value })}/></label><p className="notice">Schedule saved for a future email integration. Sending is not connected.</p></> : tab === 'Learning rules' ? <><label>Passcode policy<input readOnly value="8 characters: uppercase, numbers, special character"/></label><p>Learning content and quests are managed in the separate teacher portal.</p></> : tab === 'Data privacy' ? <p>Guardian consent records are stored with your private school data. Export records through the relevant administration section.</p> : tab === 'Security' ? <><p>Administrator access uses your school email and password. Firebase rules restrict school records to approved administrators. Student passcodes use cryptographically random values.</p><button type="button" onClick={onSignOut}>Sign out</button></> : <p>The learning-app shop catalog requires connection to the student learning app.</p>}</div><footer><span>{busy ? 'Saving…' : 'Select Save changes to apply your preferences.'}</span><button type="button" className="secondary" onClick={() => K({ ...data.settings })}>Discard</button><button disabled={busy} type="submit">Save changes</button></footer></form></div>}
    <div className="sample-label">EduLearn · School administration</div></main>{toast && <div className="toast" role="status"><Check size={18}/>{toast}<button className="icon-btn" onClick={() => T('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {modal && <div className="modal-overlay" onClick={() => !busy && M(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="Manage school record" onClick={e => e.stopPropagation()}><button className="close icon-btn" aria-label="Close dialog" onClick={() => M(null)}><X size={20}/></button>{modal.kind === 'record' ? <RecordEditor resource={modal.resource} record={modal.record} data={data} busy={busy} onCancel={() => M(null)} onSave={async (record: any) => { const payload = modal.resource === 'students' && !modal.record ? { ...record, passcode: '', status: 'No passcode', last: 'Never' } : record; if (await perform(() => modal.record ? updateRecord(modal.resource, modal.record.id, payload, rev) : createRecord(modal.resource, payload, rev), 'Record saved'))
                M(null); }} onDelete={async () => { if (await perform(() => deleteRecord(modal.resource, modal.record.id, rev), 'Record deleted'))
                M(null); }}/> : modal.kind === 'account' ? <><h2>Administrator account</h2><p>{email}</p><p>{data.settings.name}</p><button type="button" onClick={onSignOut}>Sign out</button></> : modal.kind === 'student' ? <><h2>{modal.record.name}</h2><p>Class: {name(modal.record.classId)}</p><p>Passcode: <code>{modal.record.passcode}</code></p><div className="controls"><button disabled={busy} onClick={async () => {
                    if (await generate(modal.record.id))
                        M(null);
                }}>Reset passcode</button><button className="secondary" disabled={busy} onClick={async () => {
                    if (await mutate((n: any) => { n.students.find((s: any) => s.id === modal.record.id).status = 'Locked'; }, 'Locked ' + modal.record.name))
                        M(null);
                }}>Lock account</button></div></> : <form onSubmit={async (e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    let ok = false;
                    if (modal.kind === 'class') {
                        ok = await mutate((n: any) => {
                            let code = modal.record?.code || String(f.section).slice(0, 3).toUpperCase() + '-' + f.grade + random().slice(0, 2);
                            while (!modal.record && n.classes.some((c: any) => c.code === code))
                                code = String(f.section).slice(0, 3).toUpperCase() + '-' + f.grade + random().slice(0, 2);
                            const record = { id: modal.record?.id || crypto.randomUUID(), name: 'Grade ' + f.grade + ' – ' + f.section, grade: Number(f.grade), teacher: f.teacher, count: modal.record?.count || 0, code, completion: modal.record?.completion || 0, score: modal.record?.score || 0, attendance: modal.record?.attendance || 0, status: f.status };
                            if (modal.record)
                                n.classes[n.classes.findIndex((c: any) => c.id === record.id)] = record;
                            else
                                n.classes.push(record);
                        }, modal.record ? 'Updated class' : 'Created new class');
                    }
                    else if (modal.kind === 'teacher') {
                        ok = await mutate((n: any) => {
                            const record: any = { id: modal.record?.id || crypto.randomUUID(), ...f };
                            if (modal.record) {
                                const old = n.teachers.find((t: any) => t.id === record.id);
                                n.classes.filter((c: any) => c.teacher === old.name).forEach((c: any) => c.teacher = record.name);
                                n.teachers[n.teachers.findIndex((t: any) => t.id === record.id)] = record;
                            }
                            else
                                n.teachers.push(record);
                        }, modal.record ? 'Updated teacher access' : 'Created teacher invitation draft', 'Teacher access');
                    }
                    else if (modal.kind === 'guardian') {
                        ok = await mutate((n: any) => { const g = n.guardians.find((g: any) => g.id === modal.record.id); g.email = f.email; g.report = 'Ready for next report'; }, 'Updated guardian email', 'Emails and reminders');
                    }
                    else if (modal.kind === 'consent') {
                        ok = await mutate((n: any) => { const g = n.guardians.find((g: any) => g.id === modal.record.id); g.consent = 'Recorded'; g.consentDate = f.date; g.consentNote = f.note; }, 'Recorded guardian consent', 'Emails and reminders');
                    }
                    if (ok)
                        M(null);
                }}><h2>{modal.kind === 'class' ? (modal.record ? 'Edit class' : 'Create a class') : modal.kind === 'teacher' ? (modal.record ? 'Manage teacher' : 'Invite a teacher') : modal.kind === 'consent' ? 'Record guardian consent' : 'Edit guardian email'}</h2>{modal.kind === 'class' ? <><label>Section name<input autoFocus name="section" required maxLength={60} defaultValue={modal.record?.name.split(' – ')[1]}/></label><label>Grade<select name="grade" defaultValue={modal.record?.grade || 4}>{[4, 5, 6].map(g => <option key={g}>{g}</option>)}</select></label><label>Teacher<select name="teacher" defaultValue={modal.record?.teacher || ''}><option value="">Unassigned</option>{data.teachers.filter((t: any) => t.status === 'Active').map((t: any) => <option key={t.id}>{t.name}</option>)}</select></label><label>Status<select name="status" defaultValue={modal.record?.status || 'Active'}><option>Active</option><option>Archived</option></select></label></> : modal.kind === 'teacher' ? <><label>Name<input name="name" autoFocus required defaultValue={modal.record?.name}/></label><label>Email<input name="email" type="email" required defaultValue={modal.record?.email}/></label><label>Subject<input name="subject" required defaultValue={modal.record?.subject || 'Araling Panlipunan'}/></label><label>Status<select name="status" defaultValue={modal.record?.status || 'Draft invitation'}><option>Draft invitation</option><option>Active</option><option>Suspended</option></select></label><p className="notice">Invitations are drafts. Connect an email service and teacher portal to send them.</p></> : modal.kind === 'consent' ? <><p>{modal.record.name} · {modal.record.student}</p><label>Consent date<input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)}/></label><label>Consent reference<input name="note" required placeholder="Signed form reference or confirmation"/></label></> : <><p>{modal.record.name}</p><label>Email address<input autoFocus type="email" name="email" required defaultValue={modal.record.email}/></label></>}<div className="modal-footer">{modal.record && ['class', 'teacher'].includes(modal.kind) && <button type="button" className="secondary" disabled={busy} onClick={async () => { if (window.confirm('Delete this record? Assigned classes will be unassigned for deleted teachers. A class with student or guardian records cannot be deleted.')) {
                if (await perform(() => deleteRecord(modal.kind === 'class' ? 'classes' : 'teachers', modal.record.id, rev), 'Record deleted'))
                    M(null);
            } }}>Delete</button>}<button type="button" className="secondary" onClick={() => M(null)}>Cancel</button><button disabled={busy}>Save {modal.kind === 'teacher' && !modal.record ? 'invitation draft' : 'changes'}</button></div></form>}</section></div>}</div>;
}

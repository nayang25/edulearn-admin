import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './errors.mjs';
import { parse, validateSchool, schemas } from './validation.mjs';
export function replaceSchool(previous, input) {
    const next = validateSchool({ ...input, logs: previous.logs });
    for (const student of next.students) {
        const old = previous.students.find(s => s.id === student.id);
        if (student.passcode !== (old?.passcode || ''))
            throw new HttpError(400, 'Generate or reset passcodes using the dedicated passcode action.');
    }
    const changed = ['settings', 'classes', 'teachers', 'students', 'guardians', 'imports'].filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
    return { data: next, action: changed.length ? `Updated ${changed.join(', ')}` : 'Saved school records', type: changed.length === 1 && changed[0] === 'settings' ? 'Settings' : 'Accounts and rosters' };
}
export function generatePasscodes(data, input) {
    const payload = parse(z.object({ classId: z.string().min(1), studentId: z.string().optional() }), input);
    if (!data.classes.some(c => c.id === payload.classId))
        throw new HttpError(404, 'Class not found.');
    const records = data.students.filter(s => s.classId === payload.classId && (payload.studentId ? s.id === payload.studentId : !s.passcode));
    if (payload.studentId && !records.length)
        throw new HttpError(404, 'Student not found in this class.');
    const used = new Set(data.students.map(s => s.passcode)), chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (const student of records) {
        let code;
        do {
            code = Array.from({ length: 7 }, () => chars[randomInt(chars.length)]).join('') + '!';
        } while (used.has(code));
        used.add(code);
        student.passcode = code;
        student.status = 'Active';
    }
    return { data, action: `${payload.studentId ? 'Reset' : 'Generated'} passcodes for ${records.length} student(s)`, summary: { generated: records.length } };
}
export function importRoster(data, input) {
    const payload = parse(z.object({ classId: z.string().min(1), file: z.string().trim().min(1).max(200), rows: z.array(z.object({ name: z.string().trim().min(1).max(160), guardianName: z.string().trim().max(160).default(''), email: z.union([z.email().max(254), z.literal('')]).default('') })).min(1).max(1000) }), input);
    const cls = data.classes.find(c => c.id === payload.classId);
    if (!cls)
        throw new HttpError(404, 'Class not found.');
    let added = 0, skipped = 0;
    for (const row of payload.rows) {
        if (data.students.some(s => s.classId === cls.id && s.name.toLowerCase() === row.name.toLowerCase())) {
            skipped++;
            continue;
        }
        data.students.push({ id: randomUUID(), name: row.name, classId: cls.id, passcode: '', status: 'No passcode', last: 'Never' });
        added++;
        if (row.guardianName)
            data.guardians.push({ id: randomUUID(), name: row.guardianName, student: row.name, classId: cls.id, email: row.email, report: row.email ? 'Not sent' : 'No email', consent: 'Pending' });
    }
    data.imports.unshift({ date: new Date().toISOString(), file: payload.file, classId: cls.id, added, skipped });
    return { data, action: `Imported roster into ${cls.name}: ${added} added, ${skipped} skipped`, summary: { added, skipped } };
}
export function changeRecord(data, resource, recordId, method, input) {
    const schema = schemas[resource];
    if (!schema)
        throw new HttpError(404, 'Resource not found.');
    const existing = recordId ? data[resource].find(r => r.id === recordId) : null;
    if (recordId && !existing)
        throw new HttpError(404, 'Record not found.');
    if (method === 'DELETE') {
        if (resource === 'classes' && [...data.students, ...data.guardians].some(r => r.classId === recordId))
            throw new HttpError(409, 'Move or remove the students and guardian contacts before deleting this class.');
        if (resource === 'teachers')
            data.classes.filter(c => c.teacher === existing.name).forEach(c => c.teacher = '');
        data[resource] = data[resource].filter(r => r.id !== recordId);
        if (resource === 'students')
            data.guardians = data.guardians.filter(g => !(g.classId === existing.classId && g.student === existing.name));
    }
    else {
        const candidate = {
    ...(existing || {}),
    ...input,
    id: existing?.id || randomUUID()
};

if (resource === 'classes') {
    if (existing) {
        candidate.code = existing.code;
    } else {
        const section = String(candidate.name || '')
            .split(' – ')
            .at(-1);

        const prefix = section
            .normalize('NFKD')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 3)
            .toUpperCase() || 'CLS';

        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let attempts = 0;

        do {
            candidate.code = prefix + '-' + String(candidate.grade)
                + Array.from(
                    { length: 4 },
                    () => alphabet[randomInt(alphabet.length)]
                ).join('');

            if (++attempts > 20) {
                throw new HttpError(
                    503,
                    'Could not allocate a unique class code. Try again.'
                );
            }
        } while (data.classes.some(c => c.code === candidate.code));
    }
}

const record = parse(schema, candidate);
        if (resource === 'guardians' && record.email)
            parse(z.email(), record.email);
        if (resource === 'students' && record.passcode !== (existing?.passcode || ''))
            throw new HttpError(400, 'Use the passcode endpoint to set passcodes.');
        if (resource === 'teachers' && existing)
            data.classes.filter(c => c.teacher === existing.name).forEach(c => c.teacher = record.name);
        if (resource === 'students' && existing)
            data.guardians.filter(g => g.classId === existing.classId && g.student === existing.name).forEach(g => { g.student = record.name; g.classId = record.classId; });
        if (existing)
            data[resource][data[resource].findIndex(r => r.id === recordId)] = record;
        else
            data[resource].push(record);
    }
    return { data, action: `${method === 'DELETE' ? 'Deleted' : existing ? 'Updated' : 'Created'} ${resource} record`, type: resource === 'teachers' ? 'Teacher access' : 'Accounts and rosters' };
}

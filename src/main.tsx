import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, type User } from 'firebase/auth';
import { GraduationCap } from 'lucide-react';
import Dashboard from './dashboard';
import { auth, configured } from './firebase';
import { friendlyError, apiRequest } from './school-store';
import './styles.css';
function App() {
    const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(configured), [allowed, setAllowed] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
    useEffect(() => { if (!auth)
        return; let generation = 0; const stop = onAuthStateChanged(auth, async (current) => { const mine = ++generation; setUser(current); setAllowed(false); setError(''); setLoading(true); try {
        if (current) {
            await apiRequest('/me');
            if (mine !== generation)
                return;
            setAllowed(true);
        }
    }
    catch (e) {
        if (mine === generation)
            setError(friendlyError(e));
    }
    finally {
        if (mine === generation)
            setLoading(false);
    } }); return () => { generation++; stop(); }; }, []);
    async function logout() { try {
        await signOut(auth!);
        setMessage('');
    }
    catch (e) {
        setError(friendlyError(e));
    } }
    if (!configured)
        return <div className="loading"><GraduationCap size={44}/><h2>Connect your Firebase project</h2><p className="setup-help">Copy .env.example to .env.local, fill in your Firebase web app configuration, then restart npm run dev. Follow START_HERE.md for website and backend setup.</p></div>;
    if (loading)
        return <div className="loading"><GraduationCap size={44}/><h2>Opening EduLearn…</h2></div>;
    if (user && allowed)
        return <Dashboard key={user.uid} email={user.email} onSignOut={logout}/>;
    return <div className="signin"><section><div className="brand"><GraduationCap size={44}/><strong>EDULEARN</strong><small>ADMIN PANEL</small></div><h1>Keep every class ready<br />to learn.</h1><p>Import rosters from the registrar, generate class codes and student passcodes, and manage teacher access.</p><small>Administrator accounts only.</small></section><article><h2>{user ? 'Administrator access required' : 'Administrator sign in'}</h2><p>Use your school administrator account.</p>{error && <p className="alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}{user ? <><p>{user.email}</p><p>Account UID: <code className="uid">{user.uid}</code></p><button onClick={logout}>Sign out</button><button className="secondary" onClick={() => location.reload()}>Check access again</button></> : <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError(''); setMessage(''); try {
        await signInWithEmailAndPassword(auth!, String(f.get('email')).trim(), String(f.get('password')));
    }
    catch (e) {
        setError(friendlyError(e));
    }
    finally {
        setBusy(false);
    } }}><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<div className="password-field"><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required/><button className="secondary" type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></div></label><button disabled={busy} className="button" type="submit">{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="link" disabled={busy} onClick={async (e) => { const form = e.currentTarget.form!; const input = form.elements.namedItem('email') as HTMLInputElement; if (!input.reportValidity())
        return; setBusy(true); setError(''); setMessage(''); try {
        await sendPasswordResetEmail(auth!, input.value.trim());
        setMessage('If this account exists, a password reset email will be sent.');
    }
    catch (e) {
        setError(friendlyError(e));
    }
    finally {
        setBusy(false);
    } }}>Forgot password?</button><p className="notice">School records are accessible only to approved administrators.</p></form>}</article></div>;
}
createRoot(document.getElementById('root')!).render(<App />);

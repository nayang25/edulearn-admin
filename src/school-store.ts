import { auth } from './firebase';
export async function apiRequest(endpoint: string, method = 'GET', body?: unknown) {
    const user = auth?.currentUser;
    if (!user)
        throw Error('Please sign in.');
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch('/api' + endpoint, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: controller.signal,
        });
        if (!(response.headers.get('content-type') || '').includes('application/json'))
            throw Error('Start the backend with npm run dev:server in a second terminal.');
        const result = await response.json();
        if (!response.ok)
            throw Error(result.error || 'The backend request failed.');
        return result;
    }
    catch (error) {
        if (controller.signal.aborted)
            throw Error('The backend took too long to respond. Check that it is running and can reach Firebase.');
        if (error instanceof TypeError)
            throw Error('Cannot reach the backend. Run npm run dev:server in a second terminal.');
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
export const loadSchool = () => apiRequest('/school');
export const saveSchool = (data: unknown, revision: number) => apiRequest('/school', 'PUT', { data, revision });
export const generateStudentPasscodes = (classId: string, revision: number, studentId?: string) => apiRequest('/passcodes', 'POST', { classId, revision, studentId });
export const importStudentRoster = (classId: string, file: string, rows: unknown[], revision: number) => apiRequest('/rosters/import', 'POST', { classId, file, rows, revision });
export const updateRecord = (resource: string, id: string, record: unknown, revision: number) => apiRequest(`/records/${resource}/${encodeURIComponent(id)}`, 'PATCH', { record, revision });
export const createRecord = (resource: string, record: unknown, revision: number) => apiRequest(`/records/${resource}`, 'POST', { record, revision });
export const deleteRecord = (resource: string, id: string, revision: number) => apiRequest(`/records/${resource}/${encodeURIComponent(id)}`, 'DELETE', { revision });
export function friendlyError(error: unknown) {
    const code = (error as {
        code?: string;
    })?.code;
    const messages: Record<string, string> = {
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
        'auth/network-request-failed': 'Unable to connect. Check your internet connection.',
        'auth/user-disabled': 'This account is disabled.',
        'auth/operation-not-allowed': 'Enable Email/Password sign-in in Firebase.',
        'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Check the Firebase API key in .env.local.',
        'auth/invalid-api-key': 'Check the Firebase API key in .env.local.'
    };
    return messages[code || ''] || (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}

import { FieldValue } from 'firebase-admin/firestore';
import { HttpError } from './errors.mjs';
import { emptySchool, validateSchool } from './validation.mjs';
export function firestoreRepository(db) {
    const reference = db.doc('edulearnSchool/main');
    return {
        async isAdmin(uid) { const admin = await db.doc(`edulearnAdmins/${uid}`).get(); return admin.exists && admin.data().enabled === true; },
        async read() { const snap = await reference.get(); return snap.exists ? { data: JSON.parse(snap.data().data), revision: snap.data().revision } : { data: null, revision: 0 }; },
        async change(expected, user, operation) {
            const auditRef = db.collection('edulearnAudit').doc();
            return db.runTransaction(async (tx) => {
                const admin = await tx.get(db.doc(`edulearnAdmins/${user.uid}`));
                if (!admin.exists || admin.data().enabled !== true)
                    throw new HttpError(403, 'Administrator access is required.');
                const snap = await tx.get(reference), revision = snap.exists ? snap.data().revision : 0;
                if (revision !== expected)
                    throw new HttpError(409, 'School records changed in another window. Reload before saving.');
                const previous = snap.exists ? JSON.parse(snap.data().data) : emptySchool(user.email || 'Administrator');
                const result = operation(structuredClone(previous));
                const log = { date: new Date().toISOString(), who: user.email || user.uid, type: result.type || 'Accounts and rosters', action: result.action };
                const data = validateSchool({ ...result.data, logs: [log, ...previous.logs].slice(0, 1000) });
                tx.set(reference, { data: JSON.stringify(data), revision: revision + 1, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() });
                tx.create(auditRef, { ...log, uid: user.uid, revision: revision + 1, createdAt: FieldValue.serverTimestamp() });
                return { data, revision: revision + 1, ...(result.summary ? { summary: result.summary } : {}) };
            }, { maxAttempts: 3 });
        }
    };
}

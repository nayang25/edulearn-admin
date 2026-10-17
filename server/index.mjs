import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app.mjs';
import { firestoreRepository } from './repository.mjs';
const projectId = process.env.FIREBASE_PROJECT_ID, production = process.env.NODE_ENV === 'production';
if (!projectId)
    throw Error('Set FIREBASE_PROJECT_ID in server/.env before starting the backend.');
if (production && !process.env.APP_ORIGIN)
    throw Error('Set APP_ORIGIN to the deployed HTTPS website origin.');
const firebase = initializeApp({ credential: applicationDefault(), projectId });
const app = createApp({ verifyToken: token => getAuth(firebase).verifyIdToken(token, true), repository: firestoreRepository(getFirestore(firebase)), production, origin: process.env.APP_ORIGIN || '' });
const port = Number(process.env.PORT || 3001), host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(port, host, () => console.log(`EduLearn backend: http://${host}:${port} (${production ? 'production' : 'development'})`));
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Backend port is already in use. Stop the old server or choose another PORT.' : 'Backend could not start.'); process.exit(1); });
for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });

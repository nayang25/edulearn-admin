import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HttpError } from './errors.mjs';
import { parse, revisionSchema, emptySchool } from './validation.mjs';
import { replaceSchool, generatePasscodes, importRoster, changeRecord } from './operations.mjs';
export function createApp({ verifyToken, repository, production = false, origin = '', staticDirectory = path.resolve('dist') }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet({ strictTransportSecurity: production ? undefined : false, contentSecurityPolicy: production ? { directives: { connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseio.com', 'https://*.firebaseapp.com'], upgradeInsecureRequests: null } } : false }));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'edulearn-admin-api' }));
    app.use('/api', rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Wait a minute and try again.' } }));
    app.use('/api', async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '');
        if (!match)
            throw new HttpError(401, 'Please sign in.');
        try {
            req.user = await verifyToken(match[1]);
            if (!req.user?.uid)
                throw new HttpError(401, 'Invalid sign-in token.');
        }
        catch (e) {
            if (e.status)
                throw e;
            if (String(e.code).startsWith('auth/') && !['auth/internal-error', 'auth/insufficient-permission'].includes(e.code))
                throw new HttpError(401, 'Your session expired or was revoked. Sign in again.');
            throw new HttpError(503, 'Login verification is unavailable. Check the backend Firebase configuration.');
        }
        if (!await repository.isAdmin(req.user.uid))
            throw new HttpError(403, 'This account is not an approved school administrator.');
        if (!['GET', 'HEAD'].includes(req.method)) {
            const received = req.get('origin');
            const allowed = production ? [origin] : ['http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${process.env.PORT || 3001}`, `http://127.0.0.1:${process.env.PORT || 3001}`];
            if (received && !allowed.includes(received))
                throw new HttpError(403, 'This website origin is not permitted.');
            if (!req.is('application/json'))
                throw new HttpError(415, 'Send an application/json request.');
        }
        next();
    });
    app.use('/api', express.json({ limit: '900kb', strict: true }));
    app.get('/api/me', (req, res) => res.json({ uid: req.user.uid, email: req.user.email || '', role: 'administrator' }));
    app.get('/api/school', async (req, res) => { const value = await repository.read(); res.json({ ...value, data: value.data || emptySchool(req.user.email || 'Administrator') }); });
    app.put('/api/school', async (req, res) => { const revision = parse(revisionSchema, req.body?.revision); res.json(await repository.change(revision, req.user, previous => replaceSchool(previous, req.body?.data))); });
    app.post('/api/passcodes', async (req, res) => { const revision = parse(revisionSchema, req.body?.revision); res.json(await repository.change(revision, req.user, data => generatePasscodes(data, req.body))); });
    app.post('/api/rosters/import', async (req, res) => { const revision = parse(revisionSchema, req.body?.revision); res.json(await repository.change(revision, req.user, data => importRoster(data, req.body))); });
    for (const method of ['post', 'patch', 'delete']) {
        app[method](method === 'post' ? '/api/records/:resource' : '/api/records/:resource/:id', async (req, res) => {
            const revision = parse(revisionSchema, req.body?.revision);
            const result = await repository.change(revision, req.user, data => changeRecord(data, req.params.resource, req.params.id, req.method, req.body.record));
            res.status(method === 'post' ? 201 : 200).json(result);
        });
    }
    app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
    if (production && existsSync(path.join(staticDirectory, 'index.html'))) {
        app.use(express.static(staticDirectory, { dotfiles: 'deny', index: false }));
        app.get('/{*rest}', (req, res) => { if (req.path.includes('.'))
            return res.sendStatus(404); res.set('Cache-Control', 'no-cache').sendFile(path.join(staticDirectory, 'index.html')); });
    }
    app.use((error, _req, res, _next) => {
        if (error.type === 'entity.too.large')
            return res.status(413).json({ error: 'Request is too large.' });
        if (error.type === 'entity.parse.failed')
            return res.status(400).json({ error: 'Request contains invalid JSON.' });
        if (error instanceof HttpError)
            return res.status(error.status).json({ error: error.message });
        console.error('API operation failed:', error.code || error.name || 'unknown');
        res.status(503).json({ error: 'The school database is unavailable. Check the backend connection and try again.' });
    });
    return app;
}

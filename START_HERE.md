# START HERE — EduLearn website + Express backend

This is the new full-stack version. Keep your working edulearn-firebase folder as a backup. Teacher/student application integration remains your teammate's task.

## 1. Open the new project

Extract this ZIP into a NEW folder, such as E:\KALAT\edulearn-admin-fullstack. Open it in VS Code. You should see package.json, src and server.

Copy your existing .env.local from the old edulearn-firebase folder into this new root folder. This retains your four VITE_FIREBASE_ settings. Do not copy old source or package files over this version.

In a terminal in the new project root run:

```powershell
npm install
```

## 2. Set up private backend credentials

The web API key is not enough for Firebase Admin SDK. The backend needs a private server credential.

In your Firebase Console open EduLearn > Project settings > Service accounts > Firebase Admin SDK > Generate new private key. This downloads a JSON file. Create a folder named .secrets in the NEW project root, move the downloaded JSON into it, and rename the file service-account.json.

The local path should be E:\KALAT\edulearn-admin-fullstack\.secrets\service-account.json.

Never share this file in chat, commit it to Git, or put it in src, public or dist. The included .gitignore excludes .secrets. If your organization blocks service-account keys, use an authorized Application Default Credential instead; do not bypass organization policy.

## 3. Configure the server

Run from the new project root:

```powershell
Copy-Item server/.env.example server/.env
```

Open server/.env. Confirm FIREBASE_PROJECT_ID matches the projectId from your browser configuration. The supplied example uses edulearn-933b2. The private credential must belong to that project too.

Keep these local settings:

```env
FIREBASE_PROJECT_ID=edulearn-933b2
GOOGLE_APPLICATION_CREDENTIALS=.secrets/service-account.json
PORT=3001
HOST=127.0.0.1
NODE_ENV=development
```

Private credentials belong only on the server. Never put them in VITE_ variables, which are bundled into the browser.

## 4. Start both parts

Terminal 1, from the project root:

```powershell
npm run dev:server
```

Expected message: EduLearn backend: http://127.0.0.1:3001 (development).

Open a SECOND terminal in the same project root:

```powershell
npm run dev
```

Open http://localhost:5173 and use your existing administrator email/password. Keep both terminals running. Stop the old website first so port 5173 stays available. Browser writes from unexpected development ports are blocked.

Your edulearnAdmins/{UID} document with boolean enabled=true is retained. Existing edulearnSchool/main records are read in place, without deletion or copying.

http://127.0.0.1:3001/api/health returning status ok proves only that the server process is running. Signing in checks credentials, Firebase connectivity and administrator membership.

## 5. Close direct browser access

After this NEW version successfully signs in and loads records, open the supplied firestore.rules, copy its contents into Firebase > Firestore > Rules, and Publish. Refresh the NEW website: it should still work through Express.

The OLD browser-only version stops working after this rules change. Keep it as a source backup. The backend bypasses browser rules through Admin SDK and checks access itself.

These rules cover only the current admin collections. When your teammate integrates other apps, design their authorization separately. Do not add broad browser access to school records, administrator memberships or audit entries.

## Editing your own school data

- Settings: edit school, department, school year and displayed administrator name.
- Teachers & Access: add/manage/delete teachers. Deleting a teacher unassigns their classes.
- Classes & Codes: create/edit/delete classes. Move/remove students and guardian contacts before deleting their class.
- Students & Passcodes: Add student, or click the student's NAME to edit/delete. Manage resets or locks access. Deleting a student removes guardian contacts matched to that student name and class.
- Guardians: Add guardian, or click a guardian NAME to edit/delete the whole contact. Email and consent controls remain available.
- Rosters: download the CSV template, choose a class, check the file, then import. Server validates rows and skips duplicate names within the class. Limit: 1000 rows per import.
- Passcodes: generation/reset runs on the server using secure randomness. Generic saves cannot introduce or change passcodes.
- Logs: successful backend changes record the verified actor and server time; client-supplied logs cannot forge audit history.

New databases start empty. Existing records, including samples, are preserved until you edit/delete them. Student counts are recalculated from actual stored student rows on save; old example totals may change.

## Troubleshooting

- Cannot reach backend: run npm run dev:server in a second terminal and leave it running.
- Missing server/.env: run the Step 3 copy command from the project root.
- Credential file not found: check .secrets/service-account.json and GOOGLE_APPLICATION_CREDENTIALS.
- Verification/database unavailable: check project IDs, credential validity, connection and Firestore availability. Do not share private keys or login tokens when reporting errors.
- Access denied: verify edulearnAdmins/{your Authentication UID}.enabled is boolean true, then Check access again.
- Revision conflict: another tab/admin saved first. Reload before applying your change again. If a response was lost, reload to check whether the write succeeded.
- Validation error on old data: correct the field in the message, such as an invalid teacher email or missing class reference.

## Verification and production

```powershell
npm test
npm run build
npm audit
```

Tests use simulated identity verification and an in-memory transaction adapter. Real Firebase credentials, login and database access must still be tested on your computer.

Deployment is a later step. Express can serve the built dist folder and API together on a Node-capable host. Firebase Hosting alone cannot execute Express. Build with npm run build and start with npm start.

Production needs NODE_ENV=production, FIREBASE_PROJECT_ID, APP_ORIGIN=https://your-deployed-domain, HOST=0.0.0.0 and the host's PORT. Use HTTPS. Supply private credentials through a mounted secret file or an attached service account/Application Default Credentials. Never bake the private key into a browser bundle or container image. This archive is not deployed.

## Remaining capstone work

- Teacher/student integration is deferred to your teammate.
- Email sending remains disconnected; teacher invitations remain drafts.
- Learning analytics remain marked sample pending the learning app's data.
- Student passcodes are administration records, not Firebase Authentication accounts. The later student portal requires its own credential-verification design; students must never access admin APIs.
- Teacher access status is metadata and does not provision/disable accounts in another app.
- One school per Firebase project; this is not a multi-school tenant system.
- The existing 750 KB school-document limit is preserved for data compatibility. Larger datasets require per-record collections and pagination before rollout.
- The UI shows the latest 1000 logs. New backend audits also persist separately in edulearnAudit. Firebase project owners can modify the database; this is not a tamper-proof compliance archive.
- Rate limiting is per process. Multiple backend instances need shared limits and reviewed proxy settings.

Official references: https://firebase.google.com/docs/admin/setup and https://firebase.google.com/docs/auth/admin/verify-id-tokens

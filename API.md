# Admin API contract

Scope: administrator website only. Teacher/student integration is deferred.

All /api routes except GET /api/health require Authorization: Bearer followed by a Firebase ID token. Admin SDK verifies the token with revocation checking. Each request checks edulearnAdmins/{UID}.enabled=true. Writes check membership again in the Firestore transaction.

Passwords are handled by Firebase Authentication, not Express. Vite proxies /api to port 3001 during development. Production Express serves the compiled website and API on the same origin.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Public process liveness |
| GET | /api/me | Verified administrator identity |
| GET | /api/school | School records and revision |
| PUT | /api/school | Validated school snapshot |
| POST | /api/passcodes | Generate missing class passcodes or reset one student |
| POST | /api/rosters/import | Validate/import checked CSV rows |
| POST | /api/records/:resource | Create class, teacher, student or guardian |
| PATCH | /api/records/:resource/:id | Update record |
| DELETE | /api/records/:resource/:id | Delete with dependency checks |

Valid resources: classes, teachers, students, guardians. See server/validation.mjs for full schemas.

Each write requires revision from the most recent GET /api/school. Success returns canonical data and the next revision. Replace local data with the response. A 409 means reload before retrying; stale writes never overwrite newer records.

## Examples

PUT /api/school takes {revision, data}. The complete data object includes settings, classes, students, teachers, guardians, imports and logs. Client logs are ignored. Passcodes cannot be introduced or changed by this endpoint.

POST /api/passcodes:

```json
{"revision":3,"classId":"c1"}
```

Add studentId to reset that specific student's code. Otherwise only missing passcodes are generated. Summary returns generated count. Codes use Node crypto randomInt and are unique within the school.

POST /api/rosters/import:

```json
{"revision":3,"classId":"c1","file":"roster.csv","rows":[{"name":"Student name","guardianName":"Parent name","email":"parent@example.com"}]}
```

Browser parses/previews CSV; server validates every row, skips duplicate names within a class and commits all new records atomically. Guardian name/email may be empty. Nonempty emails must be valid. Summary returns added and skipped counts.

POST /api/records/students:

```json
{"revision":3,"record":{"name":"Student name","classId":"c1"}}
```

PATCH /api/records/students/ID:

```json
{"revision":4,"record":{"name":"Corrected name"}}
```

DELETE /api/records/students/ID:

```json
{"revision":5}
```

Class codes, IDs and passcodes must be unique. Students/guardians must reference existing classes. Student names are unique per class and teacher names are unique, because inherited relationships currently match names. Student counts are server-calculated.

Student rename/move updates matched guardian references. Student deletion removes matched guardian contacts. Teacher deletion unassigns their classes. Class deletion is blocked while students/guardians reference it. Teacher record status does not create or disable a separate app's Firebase user.

## Errors and limits

200 success; 201 created; 400 validation; 401 missing/invalid/revoked token; 403 membership/origin denied; 404 missing resource; 409 revision/dependency conflict; 413 too large; 415 wrong content type; 429 rate limit; 503 database/identity provider unavailable.

Errors return an error string, without private stacks or credential details. Body limit 900 KB; canonical school state 750 KB; roster import 1000 rows. UI shows latest 1000 logs; new backend audit documents remain separately stored.

## Storage boundary

- edulearnAdmins/{uid}: owner-managed enabled boolean.
- edulearnSchool/main: serialized data, revision, updatedBy and updatedAt. Existing layout is preserved.
- edulearnAudit/{id}: backend action, actor, UID, date, type, revision and createdAt.

Only the admin backend has access to these paths. Agree separately on teacher/student data before integration. Never put Admin SDK credentials in browser/mobile code.

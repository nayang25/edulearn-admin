import { z } from 'zod';
import { HttpError } from './errors.mjs';
const label = z.string().trim().min(1).max(160);
const id = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const email = z.string().max(254); // Legacy contacts can be incomplete; the review screen flags them.
export const schemas = {
    classes: z.object({ id, name: label, grade: z.number().int().min(4).max(6), teacher: z.string().max(160), count: z.number().int().min(0).default(0), code: z.string().regex(/^[A-Z0-9-]{3,24}$/), completion: z.number().min(0).max(100).default(0), score: z.number().min(0).max(100).default(0), attendance: z.number().min(0).max(100).default(0), status: z.enum(['Active', 'Archived']).default('Active') }),
    students: z.object({ id, name: label, classId: id, passcode: z.string().max(32).default(''), status: z.enum(['No passcode', 'Active', 'Locked']).default('No passcode'), last: z.string().max(80).default('Never') }),
    teachers: z.object({ id, name: label, email: z.email().max(254), subject: label, status: z.enum(['Active', 'Suspended', 'Draft invitation']) }),
    guardians: z.object({ id, name: label, student: label, classId: id, email, report: z.string().max(80), consent: z.enum(['Pending', 'Recorded']), consentDate: z.string().max(30).optional(), consentNote: z.string().max(500).optional() })
};
const school = z.object({
    settings: z.object({ school: label, department: label, year: z.string().regex(/^\d{4}[-–]\d{4}$/), name: label, day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
    classes: z.array(schemas.classes).max(500), students: z.array(schemas.students).max(5000), teachers: z.array(schemas.teachers).max(500), guardians: z.array(schemas.guardians).max(5000),
    imports: z.array(z.object({ date: z.string().max(80), file: z.string().max(200), classId: id, added: z.number().int().min(0), skipped: z.number().int().min(0) })).max(1000),
    logs: z.array(z.object({ date: z.string().max(80), who: z.string().max(254), type: z.string().max(80), action: z.string().max(500) })).max(1000)
});
export const revisionSchema = z.number().int().min(0);
export function parse(schema, value) { const parsed = schema.safeParse(value); if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, `Invalid ${issue.path.join('.') || 'request'}: ${issue.message}`);
} return parsed.data; }
export function validateSchool(value) {
    const data = parse(school, value), classIds = new Set(data.classes.map(c => c.id));
    for (const key of ['classes', 'students', 'teachers', 'guardians']) {
        const ids = data[key].map(r => r.id);
        if (new Set(ids).size !== ids.length)
            throw new HttpError(400, `Duplicate IDs in ${key}.`);
    }
    const codes = data.classes.map(c => c.code);
    if (new Set(codes).size !== codes.length)
        throw new HttpError(400, 'Class codes must be unique.');
    const teacherNames = data.teachers.map(t => t.name.toLowerCase());
    if (new Set(teacherNames).size !== teacherNames.length)
        throw new HttpError(400, 'Teacher names must be unique so class assignments stay unambiguous.');
    const studentNames = data.students.map(s => s.classId + '|' + s.name.toLowerCase());
    if (new Set(studentNames).size !== studentNames.length)
        throw new HttpError(400, 'A student with this name already exists in the selected class.');
    const passcodes = data.students.filter(s => s.passcode).map(s => s.passcode);
    if (new Set(passcodes).size !== passcodes.length)
        throw new HttpError(400, 'Student passcodes must be unique.');
    for (const record of [...data.students, ...data.guardians])
        if (!classIds.has(record.classId))
            throw new HttpError(400, 'Every student and guardian must reference an existing class.');
    for (const student of data.students)
        if ((student.status === 'Active' && !student.passcode) || (student.status === 'No passcode' && student.passcode))
            throw new HttpError(400, 'Student access status must match their passcode.');
    for (const c of data.classes)
        c.count = data.students.filter(s => s.classId === c.id).length;
    const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    if (size > 750000)
        throw new HttpError(413, 'School records exceed the 750 KB limit. Export a backup before archiving older records.');
    return data;
}
export function emptySchool(email) { const year = new Date().getFullYear(); return { settings: { school: 'Your school', department: 'Elementary Department', year: `${year}–${year + 1}`, name: email.split('@')[0] || 'Administrator', day: 'Friday', time: '16:00' }, classes: [], teachers: [], students: [], guardians: [], imports: [], logs: [] }; }

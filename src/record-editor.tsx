import { useState } from 'react';
export default function RecordEditor({ resource, record, data, onSave, onDelete, onCancel, busy }: any) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const student = resource === 'students';
    return <form onSubmit={async (e) => { e.preventDefault(); const fields = Object.fromEntries(new FormData(e.currentTarget)); const value = student ? { name: fields.name, classId: fields.classId } : { name: fields.name, student: fields.student, classId: fields.classId, email: fields.email, report: record?.report || 'Not sent', consent: record?.consent || 'Pending' }; await onSave(value); }}>
 <h2>{record ? 'Edit' : 'Add'} {student ? 'student' : 'guardian contact'}</h2>
 <label>{student ? 'Student name' : 'Guardian name'}<input autoFocus name="name" required maxLength={160} defaultValue={record?.name}/></label>
 {!student && <label>Student name<input name="student" required maxLength={160} defaultValue={record?.student}/></label>}
 <label>Class<select name="classId" required defaultValue={record?.classId || data.classes[0]?.id}><option value="">Select a class</option>{data.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 {!student && <label>Email address<input name="email" type="email" maxLength={254} defaultValue={record?.email}/></label>}
 {student && record && <p>Existing passcodes and account status are kept. Use Manage to reset or lock access.</p>}
 {record && <div className="delete-area">{confirmDelete ? <><p>{student ? 'Deleting this student also removes guardian contacts matched to this student and class.' : 'This removes the guardian contact and their saved consent record.'}</p><button type="button" disabled={busy} onClick={onDelete}>Confirm deletion</button><button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>Keep record</button></> : <button type="button" className="link" onClick={() => setConfirmDelete(true)}>Delete this {student ? 'student' : 'guardian contact'}</button>}</div>}
 <div className="modal-footer"><button className="secondary" type="button" onClick={onCancel}>Cancel</button><button disabled={busy || !data.classes.length}>Save record</button></div>
 </form>;
}

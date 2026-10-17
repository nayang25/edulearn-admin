export const MAX_RECORD_BYTES = 750000;
export function serializeRecords(data: any) {
    if (!data || !data.settings || !['classes', 'students', 'teachers', 'guardians', 'imports', 'logs'].every(k => Array.isArray(data[k])))
        throw Error('School records are invalid.');
    const text = JSON.stringify(data);
    if (new TextEncoder().encode(text).length > MAX_RECORD_BYTES)
        throw Error('School records have reached the size limit. Export a backup and archive old records before adding more.');
    return text;
}
export function nextRevision(current: number, expected: number) {
    if (!Number.isSafeInteger(expected) || expected < 0)
        throw Error('Invalid record revision.');
    if (current !== expected)
        throw Error('School records changed in another window. Reload before saving to avoid overwriting them.');
    return current + 1;
}

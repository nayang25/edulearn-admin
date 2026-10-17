export function initials(name: string) {
    const words = name.trim().replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean);
    return words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() : 'AD';
}
export function greeting(date = new Date()) {
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(date));
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
export function scheduleTime(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value || '');
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
        return value || 'Time not set';
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

import crypto from 'crypto';

export function createPlainToken() { return crypto.randomBytes(32).toString('base64url'); }
export function hashToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
export function addHours(hours: number) { return new Date(Date.now() + hours * 60 * 60 * 1000); }

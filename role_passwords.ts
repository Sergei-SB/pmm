import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';

const derive = promisify(scrypt);
const roles = ['developer', 'admin', 'moderator'] as const;
type Role = typeof roles[number];

export function installRolePasswordRoute(
  app: Express,
  canUsePersonalPassword: (id: string, role: Role) => boolean,
  env = process.env
) {
  const salt = randomBytes(16);
  const credentials = new Map<Role, Buffer>();
  const personal = new Map<string, Buffer>();
  for (const role of roles) {
    const password = env[`PMM_${role.toUpperCase()}_PASSWORD`];
    if (!password) continue;
    credentials.set(role, scryptSync(password, salt, 32));
  }
  if (env.PMM_PERSONAL_PASSWORDS) {
    let configured: unknown;
    try {
      configured = JSON.parse(env.PMM_PERSONAL_PASSWORDS);
    } catch {
      throw new Error('Invalid PMM_PERSONAL_PASSWORDS configuration');
    }
    if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
      throw new Error('Invalid PMM_PERSONAL_PASSWORDS configuration');
    }
    for (const [id, password] of Object.entries(configured)) {
      if (!/^\d+$/.test(id) || typeof password !== 'string' || !password || password.length > 256) {
        throw new Error('Invalid personal password entry');
      }
      personal.set(id, scryptSync(password, salt, 32));
    }
  }

  const attempts = new Map<string, number[]>();
  let activeChecks = 0;
  app.post('/api/auth/role', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!roles.every(role => credentials.has(role))) {
      res.status(503).json({ ok: false });
      return;
    }
    const { role, password } = req.body || {};
    const credential = credentials.get(role);
    if (!credential || typeof password !== 'string' || !password || password.length > 256) {
      res.status(400).json({ ok: false });
      return;
    }
    const cutoff = Date.now() - 60_000;
    for (const [client, timestamps] of attempts) {
      if (timestamps.at(-1)! < cutoff) attempts.delete(client);
    }
    const client = req.ip || req.socket.remoteAddress || '';
    const timestamps = (attempts.get(client) || []).filter(time => time >= cutoff);
    if (timestamps.length >= 6 || activeChecks >= 4 || (attempts.size >= 2048 && !attempts.has(client))) {
      res.status(429).json({ ok: false });
      return;
    }
    attempts.set(client, [...timestamps, Date.now()]);
    activeChecks++;
    try {
      const hash = await derive(password, salt, 32) as Buffer;
      const personalMatch = role !== 'developer' && [...personal].some(([id, candidate]) =>
        timingSafeEqual(hash, candidate) && canUsePersonalPassword(id, role));
      if (timingSafeEqual(hash, credential) || personalMatch) {
        attempts.delete(client);
        res.json({ ok: true });
      } else {
        res.status(401).json({ ok: false });
      }
    } catch {
      res.status(503).json({ ok: false });
    } finally {
      activeChecks--;
    }
  });
}

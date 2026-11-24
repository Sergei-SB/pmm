import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';

const derive = promisify(scrypt);
export type CabinetAccount = { id: string; login: string; salt: string; hash: string };
const digest = (value: string) => createHash('sha256').update(value).digest();
const validPassword = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

export function installCabinetAuth(
  app: Express,
  read: () => Promise<CabinetAccount[]>,
  update: (change: (accounts: CabinetAccount[]) => CabinetAccount[]) => Promise<CabinetAccount[]>,
  developerPassword = process.env.PMM_DEVELOPER_PASSWORD
) {
  const attempts = new Map<string, { count: number; expires: number }>();
  let running = 0;
  for (const action of ['login', 'list', 'save'] as const) {
    app.post('/api/personal-cabinets/' + action, async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const body = req.body ?? {};
      const password = action === 'login' ? body.password : body.developerPassword;
      if (!validPassword(password)) return void res.sendStatus(400);
      const now = Date.now();
      for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
      const key = (req.ip || req.socket.remoteAddress || '') + (action === 'login' ? ':login' : ':manage');
      const attempt = attempts.get(key) ?? {count: 0, expires: now + 60_000};
      if (attempt.count >= 6 || running >= 4 || (!attempts.has(key) && attempts.size >= 2048)) {
        return void res.sendStatus(429);
      }
      attempts.set(key, {...attempt, count: attempt.count + 1});
      running++;
      try {
        const login = typeof body.login === 'string' ? body.login.trim() : '';
        if (action === 'login') {
          const account = (await read()).find(entry => entry.login === login);
          const actual = await derive(password, account?.salt ?? 'invalid-cabinet-account', 32) as Buffer;
          if (!account || !timingSafeEqual(actual, Buffer.from(account.hash, 'hex'))) return void res.sendStatus(401);
          attempts.delete(key);
          return void res.json({login: account.login});
        }
        if (!developerPassword || !timingSafeEqual(digest(password), digest(developerPassword))) {
          return void res.sendStatus(401);
        }
        let accounts: CabinetAccount[];
        if (action === 'save') {
          const id = typeof body.id === 'string' ? body.id : '';
          const newPassword = body.password;
          if (!login || login.length > 64 || ((!id || newPassword) && !validPassword(newPassword))) {
            return void res.sendStatus(400);
          }
          const salt = newPassword ? randomBytes(16).toString('hex') : '';
          const hash = newPassword ? (await derive(newPassword, salt, 32) as Buffer).toString('hex') : '';
          accounts = await update(existing => {
            if ((id && !existing.some(entry => entry.id === id)) ||
                existing.some(entry => entry.id !== id && entry.login === login)) throw new RangeError('Invalid cabinet');
            if (!id) return [...existing, {id: randomBytes(16).toString('hex'), login, salt, hash}];
            return existing.map(entry => entry.id === id
              ? {...entry, login, ...(hash ? {salt, hash} : {})} : entry);
          });
        } else {
          accounts = await read();
        }
        attempts.delete(key);
        res.json({accounts: accounts.map(({id, login}) => ({id, login}))});
      } catch (error) {
        res.sendStatus(error instanceof RangeError ? 400 : 503);
      } finally {
        running--;
      }
    });
  }
}

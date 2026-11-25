import { randomBytes, createHash } from 'node:crypto';
import type { Express } from 'express';

const recipients = ['admin', 'moderator', 'user'] as const;
type Recipient = typeof recipients[number];
type Role = Recipient | 'developer';
type Snapshot = {topFields: Record<string, unknown>; rows: unknown[]};
export type CardDrafts = Record<string, Partial<Record<Role, Snapshot>>>;
export type SharedCards = Record<string, Partial<Record<Recipient, {snapshot: Snapshot; sentAt: string}>>>;

export function installCardSharing(app: Express, storage: {
  read: (carId: string, period: string) => Promise<{drafts: CardDrafts; shared: SharedCards; legacyDraft?: Snapshot | null}>;
  change: (update: (data: {drafts: CardDrafts; shared: SharedCards}) => void) => Promise<void>;
}) {
  const sessions = new Map<string, {role: Exclude<Role, 'user'>; expires: number}>();
  const path = '/api/vehicle-cards/:carId/:period';

  app.use('/api/vehicle-cards', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.post(path, async (req, res) => {
    const {carId, period} = req.params;
    if (!/^\d{1,12}$/.test(carId) || !/^\d{1,2}\.\d{1,2}(?:\.\d{4})?-\d{1,2}\.\d{1,2}(?:\.\d{4})?$/.test(period)) {
      res.sendStatus(400);
      return;
    }
    const {action, session, recipient, snapshot, viewRole, baseVersion} = req.body ?? {};
    const authenticated = typeof session === 'string' ? sessions.get(session) : undefined;
    if (session && (!authenticated || authenticated.expires <= Date.now())) {
      res.sendStatus(401);
      return;
    }
    const authenticatedRole = authenticated?.role ?? 'user';
    const role: Role = authenticatedRole === 'developer' && recipients.includes(viewRole)
      ? viewRole : authenticatedRole;
    const key = carId + ':' + period;
    const version = (value: unknown) => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
    const current = (data: {drafts: CardDrafts; shared: SharedCards}) =>
      data.drafts[key]?.[role] ?? (role !== 'developer' ? data.shared[key]?.[role]?.snapshot : null) ?? null;
    try {
      if (action === 'read') {
        const {drafts, shared, legacyDraft} = await storage.read(carId, period);
        res.json({
          draft: current({drafts, shared}) ?? (role === 'developer' ? legacyDraft ?? null : null),
          version: version(current({drafts, shared})),
        });
      } else if (action === 'save') {
        if (!snapshot || !snapshot.topFields || typeof snapshot.topFields !== 'object' ||
            Array.isArray(snapshot.topFields) || !Array.isArray(snapshot.rows) ||
            snapshot.rows.length > 1000 || JSON.stringify(snapshot).length > 500_000) {
          res.sendStatus(400);
          return;
        }
        let conflict = false;
        await storage.change(data => {
          if (baseVersion !== version(current(data))) { conflict = true; return; }
          const {drafts} = data;
          (drafts[key] ??= {})[role] = snapshot;
        });
        if (conflict) res.status(409).json({error:'card_conflict'});
        else res.json({ok: true, version: version(snapshot)});
      } else if (action === 'send') {
        if (role !== 'developer') {
          res.sendStatus(403);
          return;
        }
        if (!recipients.includes(recipient)) {
          res.sendStatus(400);
          return;
        }
        let sent = false;
        await storage.change(({drafts, shared}) => {
          const draft = drafts[key]?.developer;
          if (!draft) return;
          (shared[key] ??= {})[recipient as Recipient] = {
            snapshot: structuredClone(draft), sentAt: new Date().toISOString(),
          };
          (drafts[key] ??= {})[recipient as Recipient] = structuredClone(draft);
          sent = true;
        });
        if (sent) res.json({ok: true});
        else res.sendStatus(404);
      } else {
        res.sendStatus(400);
      }
    } catch {
      res.sendStatus(503);
    }
  });

  return (role: Exclude<Role, 'user'>) => {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expires <= now) sessions.delete(token);
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, {role, expires: now + 8 * 60 * 60 * 1000});
    return token;
  };
}

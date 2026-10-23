// =========================================================================
// server.ts — СЕРВЕР СПІЛЬНОЇ СИНХРОНІЗАЦІЇ (Express + Vite middleware)
// =========================================================================
// Виправлено: CORS, пер-ключові ревізії, атомарний запис, tombstones,
// інкрементальний pull, контрольоване стартове наповнення, DATA_DIR.
// Жодного типу any / оператора void / маршруту app.get('*') — щоб IDE
// (WebStorm / tsc) не підкреслювала код.
//
// Потрібні типи (один раз у папці проєкту):
//     npm i -D @types/node @types/express
//
// Persistent storage: private GitHub repository (PMM_GITHUB_REPOSITORY,
// PMM_GITHUB_TOKEN), or a hosting persistent disk through DATA_DIR.
//
// Сумісність: новий клієнт Shared_sync.js працює і зі старим сервером
// (він читає поле storage), але повноцінна робота (ревізії, tombstones)
// потребує саме цього файлу.
// =========================================================================

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { archiveSnapshot, writeSnapshotWithBackup, registryChangeBlocked } from './storage_backups.ts';
import { configuredGitHubStorage } from './github_storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'shared_site_storage.json');
const TMP_FILE = path.join(DATA_DIR, 'shared_site_storage.json.tmp');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BODY = '80mb';

interface KeyRecord {
  value: string;
  rev: number;
  updatedAt: number;
  updatedByRole: string;
  deviceId: string;
  deleted: boolean;
}

interface FileRecord {
  id: string;
  fileDataUrl: string;
  fileName: string;
  updatedAt: number;
  rev: number;
  deleted: boolean;
}

interface Store {
  schemaVersion: number;
  revision: number;
  changedAt: string;
  keys: Record<string, KeyRecord>;
  files: Record<string, FileRecord>;
  filesVersion: number;
  filesChangedAt: string;
  bans: BanRecord[];
}

interface OnlineSession {
  id: string;
  deviceId: string;
  ip: string;
  role: string;
  userName: string;
  subdivision: string;
  currentView: string;
  lastSeen: number;
}

interface BanRecord {
  id: string;
  targetType: 'ip' | 'device' | 'user';
  targetValue: string;
  targetName?: string;
  reason: string;
  bannedAt: number;
  bannedBy: string;
}

const BANS_FILE = path.join(DATA_DIR, 'banned_clients.json');
let activeBans: BanRecord[] = [];

function loadBansFromDisk(): void {
  try {
    if (fs.existsSync(BANS_FILE)) {
      const raw = fs.readFileSync(BANS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) activeBans = parsed;
    }
  } catch (e) {
    console.error('Помилка читання файлу банів:', e);
  }
}

loadBansFromDisk();

const onlineSessions = new Map<string, OnlineSession>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const sock = req.socket?.remoteAddress;
  if (sock) {
    if (sock.startsWith('::ffff:')) return sock.slice(7);
    return sock;
  }
  return req.ip || '127.0.0.1';
}

function isTargetBanned(ip: string, deviceId: string, userName: string): { banned: boolean; reason?: string } {
  const cleanIp = (ip || '').trim();
  const cleanDev = (deviceId || '').trim();
  const cleanUser = (userName || '').trim().toLowerCase();

  for (const b of activeBans) {
    if (b.targetType === 'ip' && cleanIp && b.targetValue === cleanIp) {
      return { banned: true, reason: b.reason || 'Вас забанив розробник зверніться до нього' };
    }
    if (b.targetType === 'device' && cleanDev && b.targetValue === cleanDev) {
      return { banned: true, reason: b.reason || 'Вас забанив розробник зверніться до нього' };
    }
    if (b.targetType === 'user' && cleanUser && b.targetValue.toLowerCase() === cleanUser) {
      return { banned: true, reason: b.reason || 'Вас забанив розробник зверніться до нього' };
    }
  }
  return { banned: false };
}

interface NormalizedChange {
  value: string;
  baseRev: number;
}

interface RejectedRecord {
  value?: string;
  rev: number;
  deleted: boolean;
  safetyBlocked?: boolean;
}

interface ApplyResult {
  applied: Record<string, number>;
  rejected: Record<string, RejectedRecord>;
  changedCount: number;
}

type JsonObject = Record<string, unknown>;

// --- Локальні (неспільні) ключі ------------------------------------------
const LOCAL_ONLY_KEYS = [
  'currentrole',
  'userrole',
  'role',
  'isdeveloperloggedin',
  'last_active_car_id',
  'last_active_car_period',
  'last_active_report_period',
  'dev_role_time_stats',
];
const LOCAL_ONLY_PREFIXES = ['lastreadbroadcastid_', '__sync_'];
const VERSION_MARKER_SUFFIX = '_data_version';

function isSyncableKey(key: unknown): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  const k = key.toLowerCase();
  if (k.indexOf('__sync_') === 0) return false;
  if (LOCAL_ONLY_KEYS.indexOf(k) !== -1) return false;
  for (const prefix of LOCAL_ONLY_PREFIXES) {
    if (k.indexOf(prefix) === 0) return false;
  }
  // Маркери версій обладнання (*_data_version) спільними бути не мусять:
  // через них один ПК міг перезаписати список бензопил/вебасто дефолтом.
  if (k.length >= VERSION_MARKER_SUFFIX.length && k.slice(-VERSION_MARKER_SUFFIX.length) === VERSION_MARKER_SUFFIX) return false;
  return true;
}

// --- Безпечне читання довільних даних із тіла запиту ---------------------
function asObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Server error';
}

// --- Сховище --------------------------------------------------------------
function emptyStore(): Store {
  return {
    schemaVersion: 2,
    revision: 0,
    changedAt: new Date().toISOString(),
    keys: {},
    files: {},
    filesVersion: 0,
    filesChangedAt: new Date().toISOString(),
    bans: activeBans.map(ban => ({ ...ban })),
  };
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Не вдалося створити каталог даних:', err);
  }
}

function normalizeStore(parsed: JsonObject): Store {
  const store = emptyStore();
  store.revision = asNumber(parsed.revision);
  store.changedAt = asString(parsed.changedAt, store.changedAt);
  store.filesVersion = asNumber(parsed.filesVersion);
  store.filesChangedAt = asString(parsed.filesChangedAt, store.filesChangedAt);
  if (Array.isArray(parsed.bans)) store.bans = parsed.bans.filter((ban): ban is BanRecord => {
    const record = asObject(ban);
    return typeof record.id === 'string' && typeof record.targetValue === 'string'
      && ['ip', 'device', 'user'].includes(asString(record.targetType, ''));
  });

  const rawKeys = asObject(parsed.keys);
  for (const key of Object.keys(rawKeys)) {
    const rec = asObject(rawKeys[key]);
    const value = rec.value;
    if (typeof value !== 'string') continue;
    store.keys[key] = {
      value,
      rev: asNumber(rec.rev),
      updatedAt: asNumber(rec.updatedAt) || Date.now(),
      updatedByRole: asString(rec.updatedByRole, 'system'),
      deviceId: asString(rec.deviceId, 'unknown'),
      deleted: rec.deleted === true,
    };
  }

  const rawFiles = asObject(parsed.files);
  for (const id of Object.keys(rawFiles)) {
    const rec = asObject(rawFiles[id]);
    if (typeof rec.fileDataUrl !== 'string') continue;
    store.files[id] = {
      id,
      fileDataUrl: rec.fileDataUrl,
      fileName: asString(rec.fileName, ''),
      updatedAt: asNumber(rec.updatedAt) || Date.now(),
      rev: asNumber(rec.rev),
      deleted: rec.deleted === true,
    };
  }

  return store;
}

// Старий формат файлу: { version, updatedAt, updatedByRole, storage: { key: value } }
function migrateLegacy(parsed: JsonObject): Store {
  const store = emptyStore();
  const migratedAt = Date.parse(asString(parsed.updatedAt, '')) || Date.now();
  const storage = asObject(parsed.storage);
  let counter = asNumber(parsed.version);

  for (const key of Object.keys(storage)) {
    const value = storage[key];
    if (typeof value !== 'string') continue;
    counter += 1;
    store.keys[key] = {
      value,
      rev: counter,
      updatedAt: migratedAt,
      updatedByRole: asString(parsed.updatedByRole, 'system'),
      deviceId: 'legacy-file',
      deleted: false,
    };
  }

  store.revision = counter;
  console.log('Міграція сховища у формат v2 виконана. Ключів:', Object.keys(store.keys).length);
  return store;
}

function loadStore(): Store {
  ensureDataDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as unknown;
      const root = asObject(parsed);
      if (root.schemaVersion !== undefined || Object.keys(asObject(root.keys)).length > 0) {
        return normalizeStore(root);
      }
      if (Object.keys(asObject(root.storage)).length > 0) {
        return migrateLegacy(root);
      }
    }
  } catch (err) {
    console.error('Файл сховища пошкоджено, стартуємо з порожнього стану:', err);
  }
  return emptyStore();
}

const store: Store = loadStore();
const githubStorage = configuredGitHubStorage();
const updateClients = new Set<express.Response>();

function notifySharedUpdate(): void {
  const event = 'data: ' + JSON.stringify({ revision: store.revision, filesVersion: store.filesVersion }) + '\n\n';
  for (const client of updateClients) {
    try { client.write(event); } catch { updateClients.delete(client); }
  }
}

let revCounter = Math.max(store.revision || 0, store.filesVersion || 0);
for (const file of Object.values(store.files)) revCounter = Math.max(revCounter, file.rev || 0);
for (const key of Object.keys(store.keys)) {
  const rev = asNumber(store.keys[key].rev);
  if (rev > revCounter) revCounter = rev;
}

function nextRev(): number {
  revCounter += 1;
  return revCounter;
}

// --- Атомарний запис файлу -----------------------------------------------
let writeQueue: Promise<void> = Promise.resolve();

async function writeSnapshot(snapshot: string): Promise<void> {
  if (githubStorage) {
    // GitHub history is the backup. A full/ephemeral cache must not prevent a
    // shared save or undo an already confirmed remote commit.
    await githubStorage.save(snapshot);
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(TMP_FILE, snapshot, 'utf8');
      await fs.promises.rename(TMP_FILE, STORE_FILE);
    } catch { console.warn('GitHub save confirmed; local cache unavailable'); }
    return;
  }
  await writeSnapshotWithBackup(STORE_FILE, TMP_FILE, BACKUP_DIR, snapshot);
}

function persist(): Promise<void> {
  const snapshot = JSON.stringify(store, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(() => writeSnapshot(snapshot));
  return writeQueue;
}

// Serialize mutations: acknowledge only after disk write, and roll back memory
// on failure without undoing changes from a concurrent request.
let mutationQueue: Promise<unknown> = Promise.resolve();
function durableChange<T>(change: () => T): Promise<T> {
  const operation = mutationQueue.catch(() => {}).then(async () => {
    const previous = JSON.stringify(store);
    const previousCounter = revCounter;
    try {
      const result = change();
      await persist();
      if (previous !== JSON.stringify(store)) notifySharedUpdate();
      return result;
    } catch (error) {
      Object.assign(store, JSON.parse(previous));
      revCounter = previousCounter;
      throw error;
    }
  });
  mutationQueue = operation;
  return operation;
}

// --- Застосування змін ---------------------------------------------------
function normalizeChange(entry: unknown): NormalizedChange | null {
  if (typeof entry === 'string') return { value: entry, baseRev: 0 };
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const obj = entry as JsonObject;
    const rawValue = obj.value;
    if (rawValue === undefined || rawValue === null) return null;
    return {
      value: typeof rawValue === 'string' ? rawValue : String(rawValue),
      baseRev: asNumber(obj.baseRev),
    };
  }
  return null;
}

function applyChanges(body: unknown, options: { seedAllowed: boolean }): ApplyResult {
  const payload = asObject(body);
  const deviceId = asString(payload.deviceId, 'unknown');
  const role = asString(payload.role, 'user');
  const changes = asObject(payload.changes);
  const deletedKeys = Array.isArray(payload.deletedKeys) ? payload.deletedKeys : [];
  const seedAllowed = options.seedAllowed;

  const applied: Record<string, number> = {};
  const rejected: Record<string, RejectedRecord> = {};
  let changedCount = 0;

  for (const key of Object.keys(changes)) {
    if (!isSyncableKey(key)) continue;
    const entry = normalizeChange(changes[key]);
    if (!entry) continue;

    const existing = store.keys[key];
    if (registryChangeBlocked(key, existing && !existing.deleted ? existing.value : undefined, entry.value)) {
      rejected[key] = { value: existing && !existing.deleted ? existing.value : undefined,
        rev: existing ? existing.rev : 0, deleted: !existing || existing.deleted, safetyBlocked: true };
      continue;
    }
    if (existing && !seedAllowed) {
      // Приймаємо зміну лише коли вона зроблена на основі актуальної ревізії.
      if (entry.baseRev < existing.rev) {
        rejected[key] = {
          value: existing.deleted ? undefined : existing.value,
          rev: existing.rev,
          deleted: existing.deleted,
        };
        continue;
      }
      if (!existing.deleted && existing.value === entry.value) {
        applied[key] = existing.rev;
        continue;
      }
    }

    const rev = nextRev();
    store.keys[key] = {
      value: entry.value,
      rev,
      updatedAt: Date.now(),
      updatedByRole: role,
      deviceId,
      deleted: false,
    };
    applied[key] = rev;
    changedCount += 1;
  }

  for (const rawKey of deletedKeys) {
    const key = String(rawKey);
    if (!isSyncableKey(key)) continue;
    const existing = store.keys[key];
    if (!existing) continue;
    if (registryChangeBlocked(key, existing.value, undefined)) {
      rejected[key] = { value: existing.value, rev: existing.rev, deleted: existing.deleted, safetyBlocked: true };
      continue;
    }
    if (existing.deleted) {
      applied[key] = existing.rev;
      continue;
    }
    const rev = nextRev();
    store.keys[key] = {
      value: existing.value,
      rev,
      updatedAt: Date.now(),
      updatedByRole: role,
      deviceId,
      deleted: true,
    };
    applied[key] = rev;
    changedCount += 1;
  }

  if (changedCount > 0) {
    store.revision = nextRev();
    store.changedAt = new Date().toISOString();
  }

  return { applied, rejected, changedCount };
}

// --- Сервер ---------------------------------------------------------------
async function startServer(): Promise<void> {
  const app = express();

  // 1) CORS — перед усіма маршрутами
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Device');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: MAX_BODY }));

  // 2) Перевірка живості
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      revision: store.revision,
      keysCount: Object.keys(store.keys).length,
      filesCount: Object.keys(store.files).length,
      dataDir: DATA_DIR,
      backupEnabled: true,
      persistentStorage: githubStorage ? 'github' : 'local-disk',
      githubRevision: githubStorage?.revisionHash,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  // Notify connected users immediately after the shared save is confirmed.
  // Existing polling remains available if a proxy or browser blocks SSE.
  app.get('/api/shared-events', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    updateClients.add(res);
    res.write('retry: 4000\n\ndata: ' + JSON.stringify({ revision: store.revision, filesVersion: store.filesVersion }) + '\n\n');
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000);
    res.on('close', () => { clearInterval(heartbeat); updateClients.delete(res); });
  });

  // 3) Легке опитування версії
  app.get('/api/shared-version', async (_req, res) => {
    await mutationQueue.catch(() => {});
    res.json({
      revision: store.revision,
      changedAt: store.changedAt,
      keysCount: Object.keys(store.keys).length,
      filesVersion: store.filesVersion,
      filesCount: Object.keys(store.files).length,
      serverTime: Date.now(),
    });
  });

  // 4) Стан: повний (без since) або лише зміни (?since=rev)
  app.get('/api/shared-state', async (req, res) => {
    await mutationQueue.catch(() => {});
    const since = asNumber(req.query.since);
    const keys: Record<string, RejectedRecord & { updatedAt: number }> = {};
    for (const key of Object.keys(store.keys)) {
      const rec = store.keys[key];
      if (since > 0 && rec.rev <= since) continue;
      keys[key] = {
        value: rec.deleted ? undefined : rec.value,
        rev: rec.rev,
        updatedAt: rec.updatedAt,
        deleted: rec.deleted,
      };
    }
    res.json({
      revision: store.revision,
      changedAt: store.changedAt,
      filesVersion: store.filesVersion,
      keys,
    });
  });

  // 5) Збереження змін
  app.post('/api/shared-state', async (req, res) => {
    try {
      const payload = asObject(req.body);
      const result = await durableChange(() => {
        const bulkSeed = payload.isInitialSeed === true && Object.keys(store.keys).length === 0;
        return applyChanges(payload, { seedAllowed: bulkSeed });
      });
      res.json({
        ok: true,
        applied: result.applied,
        rejected: result.rejected,
        changedCount: result.changedCount,
        revision: store.revision,
        changedAt: store.changedAt,
        keysCount: Object.keys(store.keys).length,
      });
    } catch (err: unknown) {
      console.error('Помилка POST /api/shared-state:', err);
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 6) Контрольоване стартове наповнення — лише коли сервер порожній
  app.post('/api/shared-state/seed', async (req, res) => {
    try {
      const result = await durableChange(() => {
        if (Object.keys(store.keys).length > 0) return null;
        return applyChanges(req.body, { seedAllowed: true });
      });
      if (!result) {
        res.status(403).json({ ok: false, error: 'Сервер не порожній — стартове наповнення заборонено' });
        return;
      }
      res.json({
        ok: true,
        applied: result.applied,
        rejected: result.rejected,
        changedCount: result.changedCount,
        revision: store.revision,
        keysCount: Object.keys(store.keys).length,
      });
    } catch (err: unknown) {
      console.error('Помилка POST /api/shared-state/seed:', err);
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // Manual save creates an additional dated server JSON even if values match.
  app.post('/api/shared-backup', async (req, res) => {
    try {
      const role = asString(asObject(req.body).role, '').toLowerCase();
      if (!['admin', 'developer', 'dev'].includes(role)) {
        res.status(403).json({ ok: false, error: 'Недостатньо прав' });
        return;
      }
      const operation = mutationQueue.catch(() => {}).then(async () => {
        await writeQueue;
        const name = githubStorage ? 'shared_site_storage.json'
          : await archiveSnapshot(BACKUP_DIR, JSON.stringify(store, null, 2), 'manual-save');
        return { ok: true, fileName: name, revision: store.revision, createdAt: new Date().toISOString(),
          persistentStorage: githubStorage ? 'github' : 'local-disk', githubRevision: githubStorage?.revisionHash };
      });
      mutationQueue = operation;
      res.json(await operation);
    } catch (err) {
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });
  // Backup archives must not be served by Vite's development file handler.
  app.use('/data/backups', (_req, res) => { res.sendStatus(404); });

  // 7) Файли документів (IndexedDB -> сервер)
  app.get('/api/shared-idb', async (_req, res) => {
    await mutationQueue.catch(() => {});
    res.json({
      version: store.filesVersion,
      updatedAt: store.filesChangedAt,
      files: Object.keys(store.files).map((id) => store.files[id]),
    });
  });

  app.post('/api/shared-idb', async (req, res) => {
    try {
      const payload = asObject(req.body);
      const role = asString(payload.role, 'user').toLowerCase().trim();
      const files = Array.isArray(payload.files) ? payload.files : [];
      const deletedFileIds = Array.isArray(payload.deletedFileIds) ? payload.deletedFileIds : [];
      const allowWrite =
        role === 'admin' ||
        role === 'developer' ||
        role === 'dev' ||
        (payload.isInitialSeed === true && Object.keys(store.files).length === 0);

      if (!allowWrite) {
        res.status(403).json({ ok: false, error: 'Недостатньо прав для збереження файлів документів' });
        return;
      }

      const result = await durableChange(() => {
        let modifiedCount = 0;
        const applied: Record<string, number> = {};
        const rejected: Record<string, { rev: number; deleted: boolean }> = {};
        for (const rawFile of files) {
          const f = asObject(rawFile);
          const id = asString(f.id, '');
          const fileDataUrl = typeof f.fileDataUrl === 'string' ? f.fileDataUrl : '';
          if (!id || !fileDataUrl) continue;
          const prev = store.files[id];
          const fileName = asString(f.fileName, '');
          if (prev && !prev.deleted && prev.fileDataUrl === fileDataUrl && prev.fileName === fileName) { applied[id] = prev.rev; continue; }
          if (prev && asNumber(f.baseRev) < prev.rev) { rejected[id] = { rev: prev.rev, deleted: prev.deleted }; continue; }
          const rev = nextRev();
          store.files[id] = { id, fileDataUrl, fileName, updatedAt: Date.now(), rev, deleted: false };
          applied[id] = rev;
          modifiedCount += 1;
        }
        for (const rawId of deletedFileIds) {
          const deletion = asObject(rawId);
          const id = typeof rawId === 'string' ? rawId : asString(deletion.id, '');
          const prev = store.files[id];
          if (!prev) { applied[id] = 0; continue; }
          if (prev.deleted) { applied[id] = prev.rev; continue; }
          if (asNumber(deletion.baseRev) < prev.rev) { rejected[id] = { rev: prev.rev, deleted: false }; continue; }
          const rev = nextRev();
          store.files[id] = { ...prev, rev, updatedAt: Date.now(), deleted: true };
          applied[id] = rev;
          modifiedCount += 1;
        }
        if (modifiedCount > 0) { store.filesVersion = nextRev(); store.filesChangedAt = new Date().toISOString(); }
        return { modifiedCount, applied, rejected };
      });

      res.json({
        ok: true,
        ...result,
        version: store.filesVersion,
        filesCount: Object.keys(store.files).length,
      });
    } catch (err: unknown) {
      console.error('Помилка POST /api/shared-idb:', err);
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7b) Завантаження фавікона сайту
  app.post('/api/upload-favicon', (req, res) => {
    try {
      const { dataUrl } = req.body || {};
      if (typeof dataUrl === 'string' && dataUrl.includes(',')) {
        const base64Data = dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const targetPath = path.join(__dirname, 'fhjnd4dd4ww11.jfif');
        fs.writeFileSync(targetPath, buffer);
        
        const distDir = path.join(__dirname, 'dist');
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'fhjnd4dd4ww11.jfif'), buffer);
        }
        res.json({ ok: true, message: 'Фавікон успішно збережено на сервері' });
        return;
      }
      res.status(400).json({ ok: false, error: 'Некоректні дані файлу' });
    } catch (err: unknown) {
      console.error('Помилка збереження фавікона:', err);
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7c) Відстеження онлайн-сесій та перевірка бана (Heartbeat)
  app.post('/api/presence/heartbeat', (req, res) => {
    try {
      const payload = asObject(req.body);
      const deviceId = asString(payload.deviceId, 'dev_' + Math.random().toString(36).slice(2));
      const role = asString(payload.role, 'user');
      const userName = asString(payload.userName, '');
      const subdivision = asString(payload.subdivision, '');
      const currentView = asString(payload.currentView, 'base');
      const ip = getClientIp(req);

      const banCheck = isTargetBanned(ip, deviceId, userName);

      onlineSessions.set(deviceId, {
        id: deviceId,
        deviceId,
        ip,
        role,
        userName,
        subdivision,
        currentView,
        lastSeen: Date.now(),
      });

      res.json({
        ok: true,
        isBanned: banCheck.banned,
        reason: banCheck.reason || 'Вас забанив розробник зверніться до нього',
        clientIp: ip,
        serverTime: Date.now(),
      });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7d) Список активних онлайн-сесій на сайті
  app.get('/api/presence/online', (_req, res) => {
    try {
      const now = Date.now();
      const cutoff = now - 45000; // 45 секунд без зв'язку — сесія неактивна
      const active: Array<OnlineSession & { isBanned: boolean; banReason: string; online: boolean }> = [];

      for (const [id, sess] of onlineSessions.entries()) {
        if (sess.lastSeen < cutoff) {
          onlineSessions.delete(id);
        } else {
          const banCheck = isTargetBanned(sess.ip, sess.deviceId, sess.userName);
          active.push({
            ...sess,
            isBanned: banCheck.banned,
            banReason: banCheck.reason || '',
            online: true,
          });
        }
      }

      active.sort((a, b) => b.lastSeen - a.lastSeen);

      res.json({
        ok: true,
        onlineCount: active.length,
        sessions: active,
        bansCount: activeBans.length,
      });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7e) Додавання IP, пристрою або користувача в бан
  app.post('/api/presence/ban', async (req, res) => {
    try {
      const payload = asObject(req.body);
      const targetType = asString(payload.targetType, 'ip') as 'ip' | 'device' | 'user';
      const targetValue = asString(payload.targetValue, '').trim();
      const targetName = asString(payload.targetName, targetValue);
      const reason = asString(payload.reason, 'Вас забанив розробник зверніться до нього');
      const bannedBy = asString(payload.bannedBy, 'Розробник');

      if (!targetValue) {
        res.status(400).json({ ok: false, error: 'Не вказано обʼєкт для блокування' });
        return;
      }

      await durableChange(() => {
        const existingIndex = store.bans.findIndex(b => b.targetType === targetType && b.targetValue === targetValue);
        if (existingIndex !== -1) return;
        store.bans = store.bans.concat({
          id: 'ban_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          targetType,
          targetValue,
          targetName,
          reason,
          bannedAt: Date.now(),
          bannedBy,
        });
        store.revision = nextRev();
        store.changedAt = new Date().toISOString();
      });
      activeBans = store.bans;

      res.json({ ok: true, bansCount: activeBans.length, bans: activeBans });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7f) Зняття бану
  app.post('/api/presence/unban', async (req, res) => {
    try {
      const payload = asObject(req.body);
      const targetValue = asString(payload.targetValue, '').trim();

      if (!targetValue) {
        res.status(400).json({ ok: false, error: 'Не вказано обʼєкт для розблокування' });
        return;
      }

      await durableChange(() => {
        const remaining = store.bans.filter(b => b.targetValue !== targetValue && b.id !== targetValue);
        if (remaining.length === store.bans.length) return;
        store.bans = remaining;
        store.revision = nextRev();
        store.changedAt = new Date().toISOString();
      });
      activeBans = store.bans;

      res.json({ ok: true, bansCount: activeBans.length, bans: activeBans });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 7g) Список активних банів
  app.get('/api/presence/bans', (_req, res) => {
    res.json({ ok: true, bans: activeBans });
  });

  // 8) Роздача застосунку: Vite у dev, dist у production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/backups/**'] } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    // Замість app.get('*') — звичайний middleware (працює і в Express 4, і в 5)
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер синхронізації слухає http://0.0.0.0:${PORT}`);
    console.log(`Каталог даних: ${DATA_DIR}`);
    console.log(`Ключів у сховищі: ${Object.keys(store.keys).length}, ревізія: ${store.revision}`);
  });
}

// GitHub is authoritative after a restart; an unavailable remote must never
// silently fall back to empty/default data or acknowledge uncommitted saves.
async function initializeStorage(): Promise<void> {
  if (githubStorage) {
    const snapshot = await githubStorage.load();
    if (snapshot === null) throw new Error('Initialize private GitHub storage with the verified shared_site_storage.json before starting');
    Object.assign(store, normalizeStore(asObject(JSON.parse(snapshot))));
    revCounter = Math.max(store.revision, store.filesVersion,
      ...Object.values(store.keys).map(record => record.rev), ...Object.values(store.files).map(record => record.rev));
  }
  activeBans = store.bans;
  await persist();
}
initializeStorage().then(() => startServer()).catch((err: unknown) => {
  console.error('Не вдалося запустити сервер:', err);
  process.exitCode = 1;
});

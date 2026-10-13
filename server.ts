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
// Render: щоб дані не зникали при сні/передеплої, створіть Persistent Disk
// і задайте змінну середовища DATA_DIR (напр. /var/data).
// =========================================================================

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'shared_site_storage.json');
const TMP_FILE = path.join(DATA_DIR, 'shared_site_storage.json.tmp');
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
}

interface Store {
  schemaVersion: number;
  revision: number;
  changedAt: string;
  keys: Record<string, KeyRecord>;
  files: Record<string, FileRecord>;
  filesVersion: number;
  filesChangedAt: string;
}

interface NormalizedChange {
  value: string;
  baseRev: number;
}

interface RejectedRecord {
  value?: string;
  rev: number;
  deleted: boolean;
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

let revCounter = store.revision || 0;
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
  try {
    ensureDataDir();
    await fs.promises.writeFile(TMP_FILE, snapshot, 'utf-8');
    await fs.promises.rename(TMP_FILE, STORE_FILE);
  } catch (err) {
    console.error('Помилка запису файлу сховища:', err);
  }
}

function persist(): void {
  const snapshot = JSON.stringify(store, null, 2);
  writeQueue = writeQueue.then(() => writeSnapshot(snapshot)).catch((err: unknown) => {
    console.error('Черга запису сховища:', err);
  });
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
    persist();
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
      uptimeSec: Math.round(process.uptime()),
    });
  });

  // 3) Легке опитування версії
  app.get('/api/shared-version', (_req, res) => {
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
  app.get('/api/shared-state', (req, res) => {
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
  app.post('/api/shared-state', (req, res) => {
    try {
      const payload = asObject(req.body);
      const bulkSeed = payload.isInitialSeed === true && Object.keys(store.keys).length === 0;
      const result = applyChanges(payload, { seedAllowed: bulkSeed });
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
  app.post('/api/shared-state/seed', (req, res) => {
    try {
      if (Object.keys(store.keys).length > 0) {
        res.status(403).json({ ok: false, error: 'Сервер не порожній — стартове наповнення заборонено' });
        return;
      }
      const result = applyChanges(req.body, { seedAllowed: true });
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

  // 7) Файли документів (IndexedDB -> сервер)
  app.get('/api/shared-idb', (_req, res) => {
    res.json({
      version: store.filesVersion,
      updatedAt: store.filesChangedAt,
      files: Object.keys(store.files).map((id) => store.files[id]),
    });
  });

  app.post('/api/shared-idb', (req, res) => {
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

      let modifiedCount = 0;

      for (const rawFile of files) {
        const f = asObject(rawFile);
        const id = asString(f.id, '');
        const fileDataUrl = typeof f.fileDataUrl === 'string' ? f.fileDataUrl : '';
        if (!id || !fileDataUrl) continue;

        const rec: FileRecord = {
          id,
          fileDataUrl,
          fileName: asString(f.fileName, ''),
          updatedAt: asNumber(f.updatedAt) || Date.now(),
        };
        const prev = store.files[id];
        if (!prev || prev.fileDataUrl !== rec.fileDataUrl || prev.fileName !== rec.fileName) {
          store.files[id] = rec;
          modifiedCount += 1;
        }
      }

      for (const rawId of deletedFileIds) {
        const id = String(rawId);
        if (store.files[id]) {
          delete store.files[id];
          modifiedCount += 1;
        }
      }

      if (modifiedCount > 0) {
        store.filesVersion = nextRev();
        store.filesChangedAt = new Date().toISOString();
        persist();
      }

      res.json({
        ok: true,
        modifiedCount,
        version: store.filesVersion,
        filesCount: Object.keys(store.files).length,
      });
    } catch (err: unknown) {
      console.error('Помилка POST /api/shared-idb:', err);
      res.status(500).json({ ok: false, error: errorMessage(err) });
    }
  });

  // 8) Роздача застосунку: Vite у dev, dist у production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

persist(); // одразу зберігаємо файл у форматі v2 (у т.ч. після міграції)
startServer().catch((err: unknown) => {
  console.error('Не вдалося запустити сервер:', err);
});
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'shared_site_storage.json');
const IDB_FILE = path.join(DATA_DIR, 'shared_idb_files.json');

interface SharedStateFile {
  version: number;
  updatedAt: string;
  updatedByRole: string;
  storage: Record<string, string>;
}

interface SharedIdbFile {
  version: number;
  updatedAt: string;
  files: Array<{
    id: string;
    fileDataUrl: string;
    fileName?: string;
    updatedAt?: number;
  }>;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSharedStorage(): SharedStateFile {
  ensureDataDir();
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.storage === 'object') {
        return {
          version: Number(parsed.version) || 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedByRole: parsed.updatedByRole || 'system',
          storage: parsed.storage || {},
        };
      }
    }
  } catch (err) {
    console.error('Error reading shared_site_storage.json:', err);
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedByRole: 'system',
    storage: {},
  };
}

function writeSharedStorage(data: SharedStateFile) {
  ensureDataDir();
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing shared_site_storage.json:', err);
  }
}

function readSharedIdb(): SharedIdbFile {
  ensureDataDir();
  try {
    if (fs.existsSync(IDB_FILE)) {
      const raw = fs.readFileSync(IDB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.files)) {
        return {
          version: Number(parsed.version) || 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          files: parsed.files,
        };
      }
    }
  } catch (err) {
    console.error('Error reading shared_idb_files.json:', err);
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    files: [],
  };
}

function writeSharedIdb(data: SharedIdbFile) {
  ensureDataDir();
  try {
    fs.writeFileSync(IDB_FILE, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error('Error writing shared_idb_files.json:', err);
  }
}

// Ключі, які синхронізуються між усіма користувачами сайту
function isSharedStorageKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  // Локальні ключі поточної сесії ролі не перезаписують роль іншого користувача
  const localOnlyKeys = new Set([
    'currentRole',
    'userRole',
    'role',
    'isDeveloperLoggedIn',
    'last_active_car_id',
    'last_active_car_period',
    'last_active_report_period',
  ]);
  return !localOnlyKeys.has(key);
}

// Перевірка прав на збереження ключа (дозволяє зберігати всі спільні дані сайту)
function canRoleModifyKey(role: string, key: string, isInitialSeed: boolean): boolean {
  if (!isSharedStorageKey(key)) return false;
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '80mb' }));

  // 1. Перевірка версії бази (легкий запит для швидкого опитування)
  app.get('/api/shared-version', (_req, res) => {
    const state = readSharedStorage();
    const idb = readSharedIdb();
    res.json({
      version: state.version,
      idbVersion: idb.version,
      updatedAt: state.updatedAt,
      updatedByRole: state.updatedByRole,
      keysCount: Object.keys(state.storage).length,
      filesCount: idb.files.length,
    });
  });

  // 2. Отримання всіх спільних даних (Звіти, Маршрути, Картки авто, Документи А4, База авто)
  app.get('/api/shared-state', (_req, res) => {
    const state = readSharedStorage();
    const idb = readSharedIdb();
    res.json({
      version: state.version,
      idbVersion: idb.version,
      updatedAt: state.updatedAt,
      updatedByRole: state.updatedByRole,
      storage: state.storage,
    });
  });

  // 3. Отримання бінарних файлів документів (PDF, DOCX, XLSX з IndexedDB)
  app.get('/api/shared-idb', (_req, res) => {
    const idb = readSharedIdb();
    res.json({
      version: idb.version,
      updatedAt: idb.updatedAt,
      files: idb.files,
    });
  });

  // 4. Збереження змін на сервері від користувачів, які мають відповідні права
  app.post('/api/shared-state', (req, res) => {
    try {
      const { role = 'user', changes = {}, deletedKeys = [], isInitialSeed = false } = req.body || {};
      const state = readSharedStorage();
      const storageIsEmpty = Object.keys(state.storage).length === 0;
      const allowSeed = Boolean(isInitialSeed && storageIsEmpty);

      let modifiedCount = 0;

      if (changes && typeof changes === 'object') {
        for (const [key, val] of Object.entries(changes)) {
          if (val === undefined || val === null) continue;
          if (!canRoleModifyKey(role, key, allowSeed)) continue;
          const strVal = typeof val === 'string' ? val : JSON.stringify(val);
          if (state.storage[key] !== strVal) {
            state.storage[key] = strVal;
            modifiedCount++;
          }
        }
      }

      if (Array.isArray(deletedKeys)) {
        for (const key of deletedKeys) {
          if (!canRoleModifyKey(role, key, false)) continue;
          if (key in state.storage) {
            delete state.storage[key];
            modifiedCount++;
          }
        }
      }

      if (modifiedCount > 0) {
        state.version += 1;
        state.updatedAt = new Date().toISOString();
        state.updatedByRole = String(role || 'user');
        writeSharedStorage(state);
      }

      res.json({
        ok: true,
        modifiedCount,
        version: state.version,
        updatedAt: state.updatedAt,
      });
    } catch (err: any) {
      console.error('Error in POST /api/shared-state:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Server error' });
    }
  });

  // 5. Збереження бінарних файлів документів (IndexedDB -> Сервер)
  app.post('/api/shared-idb', (req, res) => {
    try {
      const { role = 'user', files = [], deletedFileIds = [], isInitialSeed = false } = req.body || {};
      const r = String(role || 'user').toLowerCase().trim();
      const idb = readSharedIdb();
      const allowWrite = r === 'admin' || r === 'developer' || r === 'dev' || (isInitialSeed && idb.files.length === 0);

      if (!allowWrite) {
        res.status(403).json({ ok: false, error: 'Недостатньо прав для збереження файлів документів' });
        return;
      }

      const fileMap = new Map<string, any>();
      for (const f of idb.files) {
        if (f && f.id) fileMap.set(String(f.id), f);
      }

      let modifiedCount = 0;
      if (Array.isArray(files)) {
        for (const f of files) {
          if (!f || !f.id || !f.fileDataUrl) continue;
          const existing = fileMap.get(String(f.id));
          if (!existing || existing.fileDataUrl !== f.fileDataUrl || existing.fileName !== f.fileName) {
            fileMap.set(String(f.id), {
              id: String(f.id),
              fileDataUrl: String(f.fileDataUrl),
              fileName: String(f.fileName || ''),
              updatedAt: Number(f.updatedAt) || Date.now(),
            });
            modifiedCount++;
          }
        }
      }

      if (Array.isArray(deletedFileIds)) {
        for (const id of deletedFileIds) {
          if (fileMap.has(String(id))) {
            fileMap.delete(String(id));
            modifiedCount++;
          }
        }
      }

      if (modifiedCount > 0) {
        idb.files = Array.from(fileMap.values());
        idb.version += 1;
        idb.updatedAt = new Date().toISOString();
        writeSharedIdb(idb);
      }

      res.json({
        ok: true,
        modifiedCount,
        version: idb.version,
        filesCount: idb.files.length,
      });
    } catch (err: any) {
      console.error('Error in POST /api/shared-idb:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Server error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

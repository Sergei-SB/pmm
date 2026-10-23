import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function archiveSnapshot(directory: string, snapshot: string, reason: string): Promise<string> {
    const data = JSON.parse(snapshot) as { revision?: number };
    await fs.mkdir(directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${reason}_${stamp}_rev-${Number(data.revision) || 0}_${randomUUID()}.json`;
    await fs.writeFile(path.join(directory, name), snapshot, { encoding: 'utf8', flag: 'wx' });
    return name;
}

// A failed archive must stop the replacement. The previous file remains intact.
export async function writeSnapshotWithBackup(file: string, temporary: string, directory: string, snapshot: string): Promise<void> {
    JSON.parse(snapshot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    let previous: string | undefined;
    try { previous = await fs.readFile(file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (previous === snapshot) return;
    if (previous !== undefined) await archiveSnapshot(directory, previous, 'before-save');
    await fs.writeFile(temporary, snapshot, 'utf8');
    await fs.rename(temporary, file);
}

export function registryChangeBlocked(key: string, previous: string | undefined, next: string | undefined): boolean {
    if (key !== 'user_cars_database_v2' && key !== 'cars_modifications_data') return false;
    try {
        const oldValue = previous === undefined ? (key === 'user_cars_database_v2' ? [] : {}) : JSON.parse(previous);
        const newValue = next === undefined ? null : JSON.parse(next);
        const isArray = key === 'user_cars_database_v2';
        if (isArray && (!Array.isArray(oldValue) || !Array.isArray(newValue))) return true;
        if (!isArray && (!newValue || typeof newValue !== 'object' || Array.isArray(newValue))) return true;
        const oldIds: string[] = isArray ? oldValue.map((car: { id: unknown }) => String(car.id)) : Object.keys(oldValue);
        const newIds: string[] = isArray ? newValue.map((car: { id: unknown }) => String(car.id)) : Object.keys(newValue);
        if (new Set(newIds).size !== newIds.length || newIds.includes('undefined') || newIds.includes('null')) return true;
        const ids = new Set(newIds);
        return oldIds.filter(id => !ids.has(id)).length > 1 || (oldIds.length > 0 && newIds.length === 0);
    } catch { return true; }
}

import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type Lock = { id: string; by: 'developer' | 'admin' };

function parseRoute(raw?: string): { rows: Row[]; [key: string]: unknown } | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (value && Array.isArray(value.rows) && value.rows.every((row: unknown) => row && typeof row === 'object' && !Array.isArray(row))) return value;
  } catch { /* Older or malformed records are handled by the existing storage path. */ }
  return null;
}

function rowLock(row?: Row): Lock | undefined {
  const lock = row?.routeLock as Partial<Lock> | undefined;
  if (lock && typeof lock.id === 'string' && lock.id && (lock.by === 'developer' || lock.by === 'admin')) return lock as Lock;
}

function editableRow(row: Row): string {
  const inputs = Array.isArray(row.inputs) ? row.inputs : [];
  // The last cell and (for trucks) T-км are display calculations.
  const editable = inputs.length === 10 ? inputs.slice(0, 8) : inputs.slice(0, 7);
  return JSON.stringify([row.name, row.time, editable, row.driverOdometer ?? '', row.driverManualTotal ?? '']);
}

function isPlaceholder(row: Row): boolean {
  const inputs = Array.isArray(row.inputs) ? row.inputs : [];
  return (row.name === 'Виконання БЗ Харків' || !row.name) && (row.time === '8:30' || !row.time)
    && !row.driverOdometer && [2, 3, 4, 5, 7].every(index => (index !== 7 || inputs.length === 10) ? !String(inputs[index] ?? '').trim() : true)
    && (!inputs[6] || inputs[6] === 'о/с');
}

export function protectRouteRows(previous: string | undefined, incoming: string | undefined, role: string): { blocked: boolean; value?: string } {
  const oldRoute = parseRoute(previous);
  const nextRoute = parseRoute(incoming);
  const oldRows = oldRoute?.rows || [];
  const by = role === 'dev' ? 'developer' : role;
  const privileged = by === 'developer' || by === 'admin';
  const previousLocks = new Map(oldRows.flatMap(row => {
    const lock = rowLock(row);
    return lock ? [[lock.id, row] as const] : [];
  }));

  if (!privileged) {
    const nextRows = nextRoute?.rows || [];
    let restoredLock = false;
    for (const [id, original] of previousLocks) {
      let matches = nextRows.filter(row => rowLock(row)?.id === id);
      if (!matches.length) {
        const samePosition = nextRows[oldRows.indexOf(original)];
        // A stale tab may omit server metadata. Retain it only if the row
        // at the original position still contains the same editable values.
        if (samePosition && samePosition.routeLock === undefined && editableRow(samePosition) === editableRow(original)) {
          samePosition.routeLock = rowLock(original);
          matches = [samePosition];
          restoredLock = true;
        }
      }
      if (matches.length !== 1 || rowLock(matches[0])?.by !== rowLock(original)?.by || editableRow(matches[0]) !== editableRow(original)) return {blocked: true};
    }
    if (nextRows.some(row => row.routeLock !== undefined && !previousLocks.has(rowLock(row)?.id || ''))) return {blocked: true};
    return {blocked: false, value: restoredLock ? JSON.stringify(nextRoute) : incoming};
  }
  if (!nextRoute) return {blocked: false, value: incoming};

  let changed = false;
  const used = new Set<string>();
  nextRoute.rows.forEach((row, index) => {
    const submittedLock = rowLock(row);
    const known = submittedLock && previousLocks.get(submittedLock.id);
    const previousRow = known || oldRows[index];
    const previousLock = known ? rowLock(known) : (previousRow && editableRow(previousRow) === editableRow(row) ? rowLock(previousRow) : undefined);
    const edited = previousRow ? editableRow(previousRow) !== editableRow(row) : !isPlaceholder(row);
    const lock = previousLock && !used.has(previousLock.id) ? previousLock : (edited ? { id: randomUUID(), by } : undefined);
    if (lock) used.add(lock.id);
    if (JSON.stringify(row.routeLock) !== JSON.stringify(lock)) {
      changed = true;
      if (lock) row.routeLock = lock;
      else delete row.routeLock;
    }
  });
  return {blocked: false, value: changed ? JSON.stringify(nextRoute) : incoming};
}

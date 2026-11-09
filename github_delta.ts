import { createHash } from 'node:crypto';

type RecordMap = Record<string, unknown>;
type Change = [string] | [string, unknown];
type Delta = {
    metadata: Change[];
    keys: Change[];
    files: Change[];
    activity?: {drop: number; append: unknown[]};
    indent: number;
    hash: string;
};

function diff(before: RecordMap, after: RecordMap): Change[] {
    const changes: Change[] = [];
    for (const key of Object.keys(before)) {
        if (!Object.hasOwn(after, key)) changes.push([key]);
    }
    for (const [key, value] of Object.entries(after)) {
        if (!Object.hasOwn(before, key) || JSON.stringify(before[key]) !== JSON.stringify(value)) {
            changes.push([key, value]);
        }
    }
    return changes;
}

function apply(target: RecordMap, changes: Change[]) {
    for (const change of changes) {
        if (!Array.isArray(change) || typeof change[0] !== 'string' || change.length < 1 || change.length > 2) {
            throw new Error('Invalid GitHub delta record');
        }
        if (change.length === 1) delete target[change[0]];
        else Object.defineProperty(target, change[0], {value: change[1], enumerable: true, writable: true, configurable: true});
    }
}

function hash(snapshot: string) {
    return createHash('sha256').update(snapshot).digest('hex');
}

export function replayGitHubDelta(snapshot: string, delta: Delta): string {
    if ((delta.indent !== 0 && delta.indent !== 2) || !Array.isArray(delta.metadata) ||
        !Array.isArray(delta.keys) || !Array.isArray(delta.files) ||
        delta.metadata.some(([key]) => key === 'keys' || key === 'files')) throw new Error('Invalid GitHub delta');
    const data = JSON.parse(snapshot);
    apply(data, delta.metadata);
    apply(data.keys, delta.keys);
    apply(data.files, delta.files);
    if (delta.activity) {
        const {drop, append} = delta.activity;
        if (!Array.isArray(data.activity) || !Number.isInteger(drop) || drop < 0 ||
            drop > data.activity.length || !Array.isArray(append)) throw new Error('Invalid GitHub activity delta');
        data.activity = data.activity.slice(drop).concat(append);
    }
    const restored = JSON.stringify(data, null, delta.indent);
    if (hash(restored) !== delta.hash) throw new Error('GitHub delta checksum mismatch');
    return restored;
}

export function buildGitHubDelta(previous: string, next: string): Delta | null {
    const {keys: beforeKeys, files: beforeFiles, ...before} = JSON.parse(previous);
    const {keys: afterKeys, files: afterFiles, ...after} = JSON.parse(next);
    const delta: Delta = {
        metadata: diff(before, after),
        keys: diff(beforeKeys, afterKeys),
        files: diff(beforeFiles, afterFiles),
        indent: next.startsWith('{\n') ? 2 : 0,
        hash: hash(next)
    };
    if (Array.isArray(before.activity) && before.activity.length && Array.isArray(after.activity)) {
        const last = JSON.stringify(before.activity.at(-1));
        const kept = after.activity.findIndex((event: unknown) => JSON.stringify(event) === last) + 1;
        if (kept > 0 && kept <= before.activity.length &&
            JSON.stringify(before.activity.slice(-kept)) === JSON.stringify(after.activity.slice(0, kept))) {
            delta.metadata = delta.metadata.filter(([key]) => key !== 'activity');
            if (kept !== before.activity.length || kept !== after.activity.length) {
                delta.activity = {drop: before.activity.length - kept, append: after.activity.slice(kept)};
            }
        }
    }
    try {
        replayGitHubDelta(previous, delta);
        return delta;
    } catch {
        // Preserve the complete snapshot if serialization order or format changed.
        return null;
    }
}

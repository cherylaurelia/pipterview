// Your data, all of which lives in this browser: download it as a file, bring it back from one (on another browser or
// after clearing this one), or delete it. Everything the app keeps is under these key prefixes.

const PREFIXES = ["extraview:", "mock-interviewer:", "pip:"];
const APP = "pipterview";

interface Backup {
  app: string;
  version: 1;
  exported: string;
  data: Record<string, string>;
}

const ours = (key: string) => PREFIXES.some((p) => key.startsWith(p));

function keys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k && ours(k));
}

/** Everything this app has stored, as a JSON file's contents. */
export function exportData(storage: Storage = window.localStorage): string {
  const data = Object.fromEntries(keys(storage).map((k) => [k, storage.getItem(k) ?? ""]));
  const backup: Backup = { app: APP, version: 1, exported: new Date().toISOString(), data };
  return JSON.stringify(backup, null, 2);
}

/** Restores a file made by exportData, replacing what's here. Ignores anything that isn't this app's. */
export function importData(json: string, storage: Storage = window.localStorage): { ok: true; count: number } | { ok: false; error: string } {
  let backup: Backup;
  try {
    backup = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't a pipterview backup (it isn't JSON)." };
  }
  if (backup?.app !== APP || backup.version !== 1 || typeof backup.data !== "object" || !backup.data) {
    return { ok: false, error: "That file isn't a pipterview backup." };
  }
  const entries = Object.entries(backup.data).filter(([k, v]) => ours(k) && typeof v === "string");
  for (const k of keys(storage)) storage.removeItem(k);
  for (const [k, v] of entries) storage.setItem(k, v);
  return { ok: true, count: entries.length };
}

/** Deletes everything this app has stored in this browser. */
export function deleteAllData(storage: Storage = window.localStorage) {
  for (const k of keys(storage)) storage.removeItem(k);
}

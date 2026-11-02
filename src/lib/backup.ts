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

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const BLOCKED = "This browser isn't letting pipterview use its storage (a private window, or site data blocked?).";

/** Everything this app has stored, as a JSON file's contents. */
export function exportData(given?: Storage): Result<{ json: string }> {
  try {
    const storage = given ?? window.localStorage; // inside the try: just reading it throws where storage is blocked
    const data = Object.fromEntries(keys(storage).map((k) => [k, storage.getItem(k) ?? ""]));
    const backup: Backup = { app: APP, version: 1, exported: new Date().toISOString(), data };
    return { ok: true, json: JSON.stringify(backup, null, 2) };
  } catch {
    return { ok: false, error: BLOCKED };
  }
}

/**
 * Restores a file made by exportData, replacing what's here. Ignores anything that isn't this app's. Checks the whole
 * file before touching anything, and if a write fails part way (storage full), puts back exactly what was here before.
 */
export function importData(json: string, given?: Storage): Result<{ count: number }> {
  let backup: Backup;
  try {
    backup = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't a pipterview backup (it isn't JSON)." };
  }
  const data: unknown = backup?.data;
  if (backup?.app !== APP || backup.version !== 1 || typeof data !== "object" || !data || Array.isArray(data)) {
    return { ok: false, error: "That file isn't a pipterview backup." };
  }
  const entries = Object.entries(data).filter(([k]) => ours(k));
  if (entries.some(([, v]) => typeof v !== "string")) return { ok: false, error: "That backup file is damaged, so nothing was changed." };

  let storage: Storage, before: [string, string][];
  try {
    storage = given ?? window.localStorage;
    before = keys(storage).map((k) => [k, storage.getItem(k) ?? ""]);
  } catch {
    return { ok: false, error: BLOCKED };
  }
  try {
    for (const [k] of before) storage.removeItem(k);
    for (const [k, v] of entries as [string, string][]) storage.setItem(k, v);
  } catch {
    try {
      for (const k of keys(storage)) storage.removeItem(k);
      for (const [k, v] of before) storage.setItem(k, v);
    } catch {
      return { ok: false, error: "That backup couldn't be restored, and some of what was here couldn't be put back. Try restoring a backup file again." };
    }
    return { ok: false, error: "There wasn't room to restore that backup, so your data was left as it was." };
  }
  return { ok: true, count: entries.length };
}

/** Deletes everything this app has stored in this browser. */
export function deleteAllData(given?: Storage): Result {
  try {
    const storage = given ?? window.localStorage;
    for (const k of keys(storage)) storage.removeItem(k);
    return { ok: true };
  } catch {
    return { ok: false, error: BLOCKED };
  }
}

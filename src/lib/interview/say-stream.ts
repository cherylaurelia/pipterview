/**
 * Pulls the "say" string out of the interviewer's structured JSON reply while
 * it's still streaming, so speech can start on the first sentence instead of
 * waiting for the whole reply. Feed it raw text deltas; it returns whatever
 * new spoken text has arrived (decoded from JSON escapes).
 */
export function createSayExtractor(key = "say") {
  let buffer = "";
  let pos = -1; // index of the next unread character inside the string value
  let done = false;
  const start = new RegExp(`"${key}"\\s*:\\s*"`);

  const ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

  return function push(chunk: string): string {
    if (done) return "";
    buffer += chunk;
    if (pos < 0) {
      const match = start.exec(buffer);
      if (!match) return "";
      pos = match.index + match[0].length;
    }
    let out = "";
    while (pos < buffer.length) {
      const ch = buffer[pos];
      if (ch === '"') {
        done = true;
        break;
      }
      if (ch !== "\\") {
        out += ch;
        pos += 1;
        continue;
      }
      // An escape: wait until all of it has arrived.
      const next = buffer[pos + 1];
      if (next === undefined) break;
      if (next === "u") {
        const hex = buffer.slice(pos + 2, pos + 6);
        if (hex.length < 4) break;
        out += String.fromCharCode(parseInt(hex, 16));
        pos += 6;
      } else {
        out += ESCAPES[next] ?? next;
        pos += 2;
      }
    }
    return out;
  };
}

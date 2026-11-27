/**
 * Synchronous OpenAI-compatible SSE delta scanner for the thought translator stream.
 *
 * - Zero per-chunk Promise / microtask overhead (pure sync `push`).
 * - No regex line splitting: `indexOf('\n')` walk + char-code `data:` prefix scan.
 * - Lossless EOF: `push(null, true)` drains TextDecoder tail bytes (split UTF-8) and a
 *   trailing `data:` line that arrived without a terminating newline.
 * - Tracks `sawAngleTag` so callers can skip `<think>` stripping on the (common) tag-free path.
 */
export function createSseDeltaScanner({ maxBytes, maxChars }) {
  const decoder = new TextDecoder();
  let buf = '';
  let totalBytes = 0;
  const s = { acc: '', sawAngleTag: false };

  // 0 = ignored, 1 = appended delta, 2 = [DONE]
  const parseLine = (raw) => {
    let start = 0;
    let end = raw.length;
    while (start < end && raw.charCodeAt(start) <= 32) start++;
    while (end > start && raw.charCodeAt(end - 1) <= 32) end--;
    if (end - start < 5 || !raw.startsWith('data:', start)) return 0;
    let p = start + 5;
    while (p < end && raw.charCodeAt(p) <= 32) p++;
    if (p >= end) return 0;
    const payload = raw.slice(p, end);
    if (payload === '[DONE]') return 2;
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content ?? obj?.choices?.[0]?.message?.content ?? '';
      if (delta) {
        if (!s.sawAngleTag && delta.indexOf('<') !== -1) s.sawAngleTag = true;
        s.acc += delta;
        return 1;
      }
    } catch {}
    return 0;
  };

  /** @returns {{ appended: boolean, done: boolean, full: boolean, error: Error|null }} */
  s.push = (chunk, isFinalFlush = false) => {
    if (!isFinalFlush) {
      totalBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk?.byteLength ?? chunk?.length ?? 0;
      if (totalBytes > maxBytes) {
        return { appended: false, done: false, full: false, error: new Error(`AI stream exceeded size limit (${maxBytes} bytes)`) };
      }
      buf += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    } else {
      const tail = decoder.decode();
      if (tail) buf += tail;
    }
    if (buf.length > maxChars) buf = buf.slice(0, maxChars);

    let appended = false;
    let done = false;
    let lineStart = 0;
    let nl = buf.indexOf('\n');
    while (nl !== -1) {
      const lineEnd = nl > lineStart && buf.charCodeAt(nl - 1) === 13 ? nl - 1 : nl;
      const st = parseLine(buf.slice(lineStart, lineEnd));
      if (st === 1) appended = true;
      else if (st === 2) {
        done = true;
        break;
      }
      lineStart = nl + 1;
      nl = buf.indexOf('\n', lineStart);
    }
    buf = done ? '' : lineStart > 0 ? buf.slice(lineStart) : buf;
    if (isFinalFlush && buf.length > 0) {
      const st = parseLine(buf);
      if (st === 1) appended = true;
      else if (st === 2) done = true;
      buf = '';
    }

    let full = false;
    if (s.acc.length >= maxChars) {
      s.acc = s.acc.slice(0, maxChars);
      full = true;
    }
    return { appended, done, full, error: null };
  };

  return s;
}

export function pick(res, paths, fallback) {
  const data = res && res.data;
  const candidates = Array.isArray(paths) ? paths : [paths];

  for (const p of candidates) {
    const parts = String(p).split('.').filter(Boolean);
    let cur = data;
    let ok = true;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
        cur = cur[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined) return cur;
  }

  return fallback;
}

export function pickArray(res, paths) {
  const v = pick(res, paths, []);
  return Array.isArray(v) ? v : [];
}

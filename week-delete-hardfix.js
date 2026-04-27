// week-delete-hardfix.js
// Dernier filet de sécurité: supprime les heures d'une ligne swipée en couvrant les formats
// les plus probables: objet par date, tableau d'entrées, objet par mois/jour, et valeurs d'heure directes.
(() => {
  if (window.__weekDeleteHardfixLoaded) return;
  window.__weekDeleteHardfixLoaded = true;

  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, oct:9, nov:10, dec:11 };
  const DAY_NAMES = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.y}-${pad(d.m)}-${pad(d.d)}`;

  function getYearMonth() {
    const input = document.querySelector('input[type="date"]');
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth() + 1;
    if (input?.value) {
      const p = input.value.split('-').map(Number);
      if (p.length >= 2) { y = p[0]; m = p[1]; }
    }
    const title = norm(document.querySelector('.cal-month')?.textContent || '');
    const yy = title.match(/20\d{2}/)?.[0];
    if (yy) y = Number(yy);
    Object.keys(MONTHS).forEach(k => { if (title.includes(k)) m = MONTHS[k] + 1; });
    return { y, m };
  }

  function rowDate(wrap) {
    const sub = norm(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const label = norm(wrap?.querySelector('.week-day-label')?.textContent || '');
    const match = sub.match(/(\d{1,2})\s+([a-z]+)/);
    if (match) {
      const base = getYearMonth();
      let m = MONTHS[match[2]] == null ? base.m : MONTHS[match[2]] + 1;
      let y = base.y;
      if (base.m === 1 && m === 12) y -= 1;
      if (base.m === 12 && m === 1) y += 1;
      return { y, m, d: Number(match[1]), weekday: label };
    }
    return null;
  }

  function variants(d) {
    if (!d) return [];
    const iso = keyOf(d), slash = `${d.y}/${pad(d.m)}/${pad(d.d)}`, compact = `${d.y}${pad(d.m)}${pad(d.d)}`;
    const fr = `${d.d}/${d.m}/${d.y}`;
    const monthKey = `${d.y}-${pad(d.m)}`;
    return Array.from(new Set([iso, slash, compact, fr, monthKey, String(d.d), pad(d.d), d.weekday].filter(Boolean).map(norm)));
  }

  function maybeDateMatch(value, d, vars) {
    const s = norm(value);
    if (!s) return false;
    if (s.includes(keyOf(d)) || s.includes(`${d.y}/${pad(d.m)}/${pad(d.d)}`) || s.includes(`${d.y}${pad(d.m)}${pad(d.d)}`)) return true;
    if (s === String(d.d) || s === pad(d.d)) return true;
    if (d.weekday && s === norm(d.weekday)) return true;
    return false;
  }

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function writeJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function isEntryForDate(obj, d) {
    if (!obj || typeof obj !== 'object') return false;
    const dateFields = ['date','day','key','id','entryDate','workDate','selectedDate','createdFor'];
    return dateFields.some(f => maybeDateMatch(obj[f], d, variants(d)));
  }

  function cleanNode(node, d, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 9) return { value: node, removed: 0, changed: false };

    if (Array.isArray(node)) {
      let removed = 0, changed = false;
      const next = [];
      node.forEach(item => {
        if (isEntryForDate(item, d)) { removed++; changed = true; return; }
        const r = cleanNode(item, d, depth + 1);
        removed += r.removed; changed = changed || r.changed; next.push(r.value);
      });
      return { value: next, removed, changed };
    }

    const out = { ...node };
    let removed = 0, changed = false;

    Object.keys(out).forEach(k => {
      const child = out[k];
      const nk = norm(k);

      // Direct date key or day key inside a month object.
      if (maybeDateMatch(k, d, variants(d))) {
        delete out[k]; removed++; changed = true; return;
      }

      // Month object: { "2026-04": { "13": {...} } }
      if ((nk === `${d.y}-${pad(d.m)}` || nk === `${d.y}/${pad(d.m)}` || nk === `${d.y}${pad(d.m)}`) && child && typeof child === 'object') {
        [''+d.d, pad(d.d), keyOf(d)].forEach(dayKey => {
          if (Object.prototype.hasOwnProperty.call(child, dayKey)) {
            delete child[dayKey]; removed++; changed = true;
          }
        });
        out[k] = child;
      }

      if (child && typeof child === 'object') {
        if (isEntryForDate(child, d)) { delete out[k]; removed++; changed = true; return; }
        const r = cleanNode(child, d, depth + 1);
        if (r.changed) { out[k] = r.value; removed += r.removed; changed = true; }
      }
    });

    return { value: out, removed, changed };
  }

  function clearVisibleLine(wrap) {
    const hours = wrap?.querySelector('.week-day-hours');
    const extra = wrap?.querySelector('.week-day-extra');
    if (hours) { hours.textContent = '—'; hours.classList.add('empty'); hours.classList.remove('overtime'); }
    if (extra) extra.textContent = '';
    wrap?.classList.remove('revealed','revealed-left','deleting');
  }

  function deleteDate(d) {
    let removed = 0;
    const changedKeys = [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (k) keys.push(k);
    }

    keys.forEach(k => {
      if (maybeDateMatch(k, d, variants(d))) { localStorage.removeItem(k); removed++; changedKeys.push(k); return; }
      const data = readJSON(k);
      if (!data || typeof data !== 'object') return;
      const r = cleanNode(data, d);
      if (r.changed) { writeJSON(k, r.value); removed += r.removed; changedKeys.push(k); }
    });

    const result = { date: keyOf(d), removed, changedKeys, at: new Date().toISOString() };
    localStorage.setItem('weekDeleteHardfixLastRun', JSON.stringify(result));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: result }));
    return result;
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-delete-row-swipe]');
    if (!btn) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const wrap = btn.closest('.week-row-swipe-wrap');
    const d = rowDate(wrap);
    if (!d) { toast('Date introuvable'); return; }
    const result = deleteDate(d);
    clearVisibleLine(wrap);
    toast(result.removed ? 'Journée supprimée' : 'Ligne vidée');
    setTimeout(() => location.reload(), 400);
  }, true);
})();

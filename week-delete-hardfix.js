// week-delete-hardfix.js
// Supprime une ligne swipée, incluant les journées avec overtime.
(() => {
  if (window.__weekDeleteHardfixLoaded) return;
  window.__weekDeleteHardfixLoaded = true;

  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, oct:9, nov:10, dec:11 };
  const DATE_FIELDS = ['date','day','key','id','entryDate','workDate','selectedDate','createdFor','startDate','endDate'];
  const HOUR_FIELDS = ['hours','totalHours','workedHours','duration','regularHours','overtime','overtimeHours','extraHours','supHours','heures','heuresSup','heuresSupplementaires','start','end','startTime','endTime','debut','fin','meal','mealMinutes','pause','break'];

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
    if (!match) return null;
    const base = getYearMonth();
    let m = MONTHS[match[2]] == null ? base.m : MONTHS[match[2]] + 1;
    let y = base.y;
    if (base.m === 1 && m === 12) y -= 1;
    if (base.m === 12 && m === 1) y += 1;
    return { y, m, d: Number(match[1]), weekday: label };
  }

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function writeJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function dateStrings(d) {
    return [
      keyOf(d),
      `${d.y}/${pad(d.m)}/${pad(d.d)}`,
      `${d.y}${pad(d.m)}${pad(d.d)}`,
      `${d.d}/${d.m}/${d.y}`,
      `${pad(d.d)}/${pad(d.m)}/${d.y}`
    ].map(norm);
  }

  function valueMatchesDate(value, d) {
    const s = norm(value);
    if (!s) return false;
    return dateStrings(d).some(x => s.includes(x));
  }

  function keyMatchesDate(key, d) {
    const k = norm(key);
    if (valueMatchesDate(k, d)) return true;
    if (k === String(d.d) || k === pad(d.d)) return true;
    return false;
  }

  function objectHasDate(obj, d) {
    if (!obj || typeof obj !== 'object') return false;
    return DATE_FIELDS.some(f => valueMatchesDate(obj[f], d));
  }

  function clearHourFields(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    let changed = false;
    Object.keys(obj).forEach(k => {
      const nk = norm(k);
      const isHourField = HOUR_FIELDS.some(f => nk === norm(f) || nk.includes(norm(f))) || nk.includes('overtime') || nk.includes('sup');
      if (isHourField) {
        if (typeof obj[k] === 'number') obj[k] = 0;
        else if (typeof obj[k] === 'string') obj[k] = '';
        else if (typeof obj[k] === 'boolean') obj[k] = false;
        else if (obj[k] && typeof obj[k] === 'object') obj[k] = Array.isArray(obj[k]) ? [] : {};
        changed = true;
      }
    });
    return changed;
  }

  function cleanNode(node, d, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 10) return { value: node, removed: 0, changed: false };

    if (Array.isArray(node)) {
      let removed = 0, changed = false;
      const next = [];
      node.forEach(item => {
        if (objectHasDate(item, d)) { removed++; changed = true; return; }
        const r = cleanNode(item, d, depth + 1);
        removed += r.removed; changed = changed || r.changed; next.push(r.value);
      });
      return { value: next, removed, changed };
    }

    const out = { ...node };
    let removed = 0, changed = false;

    // Object itself represents the selected date: clear its hour fields too, for overtime structures that are reused.
    if (objectHasDate(out, d)) {
      if (clearHourFields(out)) changed = true;
    }

    Object.keys(out).forEach(k => {
      const child = out[k];
      const nk = norm(k);

      if (keyMatchesDate(k, d)) {
        delete out[k]; removed++; changed = true; return;
      }

      // Month bucket like { "2026-04": { "16": {...} } }
      if ((nk === `${d.y}-${pad(d.m)}` || nk === `${d.y}/${pad(d.m)}` || nk === `${d.y}${pad(d.m)}`) && child && typeof child === 'object') {
        [String(d.d), pad(d.d), keyOf(d)].forEach(dayKey => {
          if (Object.prototype.hasOwnProperty.call(child, dayKey)) {
            delete child[dayKey]; removed++; changed = true;
          }
        });
        out[k] = child;
      }

      if (child && typeof child === 'object') {
        if (objectHasDate(child, d)) {
          delete out[k]; removed++; changed = true; return;
        }
        const r = cleanNode(child, d, depth + 1);
        if (r.changed) { out[k] = r.value; removed += r.removed; changed = true; }
      }
    });

    return { value: out, removed, changed };
  }

  function clearNativeInputsForDate(d) {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      dateInput.value = keyOf(d);
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTimeout(() => {
      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.type === 'date') return;
        const text = norm(`${el.id} ${el.name} ${el.placeholder} ${el.className}`);
        if (HOUR_FIELDS.some(f => text.includes(norm(f))) || text.includes('sup') || text.includes('overtime')) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }, 80);
  }

  function clearVisibleLine(wrap) {
    const hours = wrap?.querySelector('.week-day-hours');
    const extra = wrap?.querySelector('.week-day-extra');
    const quick = wrap?.querySelector('.week-day-quick');
    if (hours) { hours.textContent = '—'; hours.classList.add('empty'); hours.classList.remove('overtime'); }
    if (extra) extra.textContent = '';
    if (quick) quick.remove();
    wrap?.classList.remove('revealed','revealed-left','deleting');
  }

  function deleteDate(d) {
    let removed = 0;
    const changedKeys = [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k); }

    keys.forEach(k => {
      if (keyMatchesDate(k, d)) { localStorage.removeItem(k); removed++; changedKeys.push(k); return; }
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
    clearNativeInputsForDate(d);
    const result = deleteDate(d);
    clearVisibleLine(wrap);
    toast('Journée supprimée');
    setTimeout(() => location.reload(), 650);
  }, true);
})();

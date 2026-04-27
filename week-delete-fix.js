// week-delete-fix.js
// Correctif robuste: supprime les vraies entrées d'heures dans localStorage,
// même si l'app principale utilise une clé ou structure différente.
(() => {
  if (window.__weekDeleteFixLoaded) return;
  window.__weekDeleteFixLoaded = true;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const MONTHS = {
    janv: 0, janvier: 0,
    fevr: 1, fevrier: 1, févr: 1, février: 1,
    mars: 2,
    avr: 3, avril: 3,
    mai: 4,
    juin: 5,
    juil: 6, juillet: 6,
    aout: 7, août: 7,
    sept: 8, septembre: 8,
    oct: 9, octobre: 9,
    nov: 10, novembre: 10,
    dec: 11, décembre: 11, decembre: 11
  };

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  }

  function dkey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseISODate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function selectedDate() {
    const input = document.querySelector('input[type="date"]');
    const d = parseISODate(input?.value);
    if (d) return d;
    const selectedDay = document.querySelector('.cal-day.selected:not(.empty) .cal-day-num, .cal-day.selected:not(.empty)');
    const n = Number((selectedDay?.textContent || '').match(/\d+/)?.[0]);
    if (n) {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), n);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function weekKeys() {
    const d = selectedDate();
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => dkey(addDays(d, i)));
  }

  function calendarVisibleYearMonth() {
    const selected = selectedDate();
    const title = document.querySelector('.cal-month')?.textContent || '';
    const t = normalize(title);
    const yearMatch = t.match(/20\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : selected.getFullYear();
    let month = selected.getMonth();
    Object.keys(MONTHS).forEach(name => {
      if (t.includes(name)) month = MONTHS[name];
    });
    return { year, month };
  }

  function parseRowVisibleDate(wrap) {
    const sub = normalize(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const m = sub.match(/(\d{1,2})\s+([a-zA-Zéûûîïôàèùç]+)/i);
    if (!m) return null;
    const day = Number(m[1]);
    const monthName = normalize(m[2]);
    const ym = calendarVisibleYearMonth();
    const month = MONTHS[monthName] ?? ym.month;
    let year = ym.year;

    // Si la semaine traverse janvier/décembre, ajuste l'année autour du mois visible.
    if (ym.month === 0 && month === 11) year -= 1;
    if (ym.month === 11 && month === 0) year += 1;

    if (!day || month == null) return null;
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return dkey(d);
  }

  function rowKey(wrap) {
    const visible = parseRowVisibleDate(wrap);
    if (visible) return visible;
    const rows = Array.from(document.querySelectorAll('.week-list > .week-row-swipe-wrap'));
    const index = rows.indexOf(wrap);
    return index >= 0 ? weekKeys()[index] : null;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function hasValue(v) {
    if (v == null) return false;
    if (typeof v !== 'object') return true;
    return Object.keys(v).length > 0;
  }

  function itemDateKey(item) {
    if (!item || typeof item !== 'object') return null;
    const fields = ['date', 'day', 'key', 'id', 'entryDate', 'workDate', 'selectedDate', 'createdFor'];
    for (const f of fields) {
      const v = item[f];
      if (!v) continue;
      const s = String(v).slice(0, 10);
      if (DATE_RE.test(s)) return s;
    }
    return null;
  }

  function deleteDeep(value, keysSet, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8) return { value, removed: 0, changed: false };

    if (Array.isArray(value)) {
      let removedNested = 0;
      let changedNested = false;
      const kept = [];

      value.forEach(item => {
        const itemKey = itemDateKey(item);
        if (itemKey && keysSet.has(itemKey)) {
          removedNested++;
          changedNested = true;
          return;
        }
        const res = deleteDeep(item, keysSet, depth + 1);
        removedNested += res.removed;
        changedNested = changedNested || res.changed;
        kept.push(res.value);
      });

      return { value: kept, removed: removedNested, changed: changedNested };
    }

    let removed = 0;
    let changed = false;
    const out = { ...value };

    Object.keys(out).forEach(prop => {
      const propDate = prop.slice(0, 10);
      if (keysSet.has(propDate) && hasValue(out[prop])) {
        delete out[prop];
        removed++;
        changed = true;
        return;
      }

      const child = out[prop];
      if (child && typeof child === 'object') {
        const childDate = itemDateKey(child);
        if (childDate && keysSet.has(childDate)) {
          delete out[prop];
          removed++;
          changed = true;
          return;
        }

        const res = deleteDeep(child, keysSet, depth + 1);
        if (res.changed) {
          out[prop] = res.value;
          removed += res.removed;
          changed = true;
        }
      }
    });

    return { value: out, removed, changed };
  }

  function deleteFromStorage(dateKeys) {
    const keysSet = new Set(dateKeys);
    let removed = 0;
    const changedKeys = [];

    const storageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) storageKeys.push(k);
    }

    storageKeys.forEach(storageKey => {
      const data = readJson(storageKey);
      if (!data || typeof data !== 'object') return;

      const res = deleteDeep(data, keysSet);
      if (res.changed) {
        writeJson(storageKey, res.value);
        removed += res.removed;
        changedKeys.push(storageKey);
      }
    });

    localStorage.setItem('weekDeleteFixLastRun', JSON.stringify({
      dateKeys,
      removed,
      changedKeys,
      at: new Date().toISOString()
    }));

    return { removed, changedKeys, dateKeys };
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function refresh(result) {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: { source: 'week-delete-fix', result } }));
    document.dispatchEvent(new Event('week-tools-refresh'));
    toast(result.removed ? `Supprimé (${result.removed})` : `Aucune donnée trouvée (${(result.dateKeys || []).join(', ')})`);
    setTimeout(() => location.reload(), 450);
  }

  document.addEventListener('click', e => {
    const rowDelete = e.target.closest('[data-delete-row-swipe]');
    if (rowDelete) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const wrap = rowDelete.closest('.week-row-swipe-wrap');
      const key = rowKey(wrap);
      if (!key) return refresh({ removed: 0, changedKeys: [], dateKeys: [] });
      wrap?.classList.add('deleting');
      return refresh(deleteFromStorage([key]));
    }

    const weekBtn = e.target.closest('#deleteCurrentWeekBtn');
    if (!weekBtn) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (weekBtn.dataset.confirmDeleteWeek !== '1') {
      weekBtn.dataset.confirmDeleteWeek = '1';
      weekBtn.classList.add('confirm');
      weekBtn.textContent = 'Confirmer la suppression';
      setTimeout(() => {
        weekBtn.dataset.confirmDeleteWeek = '0';
        weekBtn.classList.remove('confirm');
        weekBtn.textContent = 'Supprimer les heures de cette semaine';
      }, 3000);
      return;
    }

    refresh(deleteFromStorage(weekKeys()));
  }, true);
})();

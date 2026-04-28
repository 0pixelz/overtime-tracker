// week-direct-clear.js
// Supprime une ligne de Ma semaine en déclenchant le même bouton natif
// que "Effacer cette journée" dans le formulaire du haut.
(() => {
  if (window.__weekDirectClearLoaded) return;
  window.__weekDirectClearLoaded = true;

  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, oct:9, nov:10, novembre:10, dec:11, decembre:11 };
  let busy = false;

  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.y}-${pad(d.m)}-${pad(d.d)}`;

  function currentYearMonth() {
    const input = document.querySelector('input[type="date"]');
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
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

  function dateFromRow(wrap) {
    const sub = norm(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const match = sub.match(/(\d{1,2})\s+([a-z]+)/);
    if (!match) return null;
    const base = currentYearMonth();
    let m = MONTHS[match[2]] == null ? base.m : MONTHS[match[2]] + 1;
    let y = base.y;
    if (base.m === 1 && m === 12) y -= 1;
    if (base.m === 12 && m === 1) y += 1;
    return { y, m, d: Number(match[1]) };
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function selectDate(key) {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      dateInput.value = key;
      fire(dateInput);
    }

    const day = String(Number(key.slice(8, 10)));
    const candidates = Array.from(document.querySelectorAll('.cal-day:not(.empty)'));
    const target = candidates.find(el => {
      const txt = el.querySelector('.cal-day-num')?.textContent || el.textContent || '';
      return (txt.match(/\d+/)?.[0] || '') === day;
    });
    if (target) target.click();
  }

  function parseHours(text) {
    const n = Number(String(text || '').replace(',', '.').match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function formatHours(n) {
    return `${n.toFixed(2).replace('.', ',')} h`;
  }

  function clearVisibleRow(wrap) {
    const hours = wrap?.querySelector('.week-day-hours');
    const extra = wrap?.querySelector('.week-day-extra');
    const quick = wrap?.querySelector('.week-day-quick');
    if (hours) {
      hours.textContent = '—';
      hours.classList.add('empty');
      hours.classList.remove('overtime', 'leave');
    }
    if (extra) extra.textContent = '';
    if (quick) quick.remove();
    wrap?.classList.remove('revealed', 'revealed-left', 'deleting');
  }

  function updateWeekTotal(removedHours) {
    const totalEl = document.querySelector('.week-total .mono, .week-total-value, .week-total-hours');
    if (!totalEl) return;
    const current = parseHours(totalEl.textContent);
    const next = Math.max(0, current - removedHours);
    totalEl.textContent = formatHours(next);
  }

  function removeCalendarDot(key) {
    const day = String(Number(key.slice(8, 10)));
    const selectedMonth = Number(key.slice(5, 7));
    const ym = currentYearMonth();
    if (ym.m !== selectedMonth) return;

    Array.from(document.querySelectorAll('.cal-day:not(.empty)')).forEach(el => {
      const txt = el.querySelector('.cal-day-num')?.textContent || el.textContent || '';
      const n = (txt.match(/\d+/)?.[0] || '');
      if (n !== day) return;
      el.classList.remove('has-entry', 'leave');
      el.querySelectorAll('.cal-dot').forEach(dot => dot.remove());
    });
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
    setTimeout(() => el.classList.remove('show'), 1200);
  }

  function findNativeClearButton() {
    const byClass = document.querySelector('.clear-day-btn');
    if (byClass) return byClass;

    return Array.from(document.querySelectorAll('button')).find(btn => {
      const t = norm(btn.textContent);
      return t.includes('effacer') && (t.includes('journee') || t.includes('journée'));
    }) || null;
  }

  function clickNativeClearButton(done) {
    const btn = findNativeClearButton();
    if (!btn) {
      done(false);
      return;
    }

    btn.click();

    // Même effet que l'utilisateur: premier clic active la confirmation,
    // deuxième clic confirme "Effacer cette journée".
    setTimeout(() => {
      const confirmBtn = document.querySelector('.clear-day-btn.confirm') || findNativeClearButton();
      if (confirmBtn) confirmBtn.click();
      setTimeout(() => done(true), 260);
    }, 180);
  }

  function handle(e) {
    const btn = e.target?.closest?.('[data-delete-row-swipe]');
    if (!btn || busy) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    busy = true;

    const wrap = btn.closest('.week-row-swipe-wrap');
    const d = dateFromRow(wrap);
    if (!d) {
      toast('Date introuvable');
      busy = false;
      return;
    }

    const key = keyOf(d);
    const removedHours = parseHours(wrap?.querySelector('.week-day-hours')?.textContent || '0');
    localStorage.setItem('weekDirectClearLastDate', key);

    // Feedback instantané.
    clearVisibleRow(wrap);
    updateWeekTotal(removedHours);
    removeCalendarDot(key);
    toast('Journée supprimée');

    // Sélectionne la journée, attend que le formulaire du haut soit chargé,
    // puis déclenche exactement le bouton natif Effacer cette journée.
    selectDate(key);
    setTimeout(() => {
      clickNativeClearButton(() => {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: { key, source: 'week-direct-clear-native' } }));
        document.dispatchEvent(new Event('week-tools-refresh'));
        setTimeout(() => location.reload(), 180);
      });
    }, 320);
  }

  window.addEventListener('click', handle, true);
})();

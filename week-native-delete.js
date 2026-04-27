// week-native-delete.js
// Supprime une ligne de semaine en utilisant le bouton natif "Effacer cette journée".
(() => {
  if (window.__weekNativeDeleteLoaded) return;
  window.__weekNativeDeleteLoaded = true;

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

  function rowDate(wrap) {
    const sub = norm(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const m = sub.match(/(\d{1,2})\s+([a-z]+)/);
    if (!m) return null;
    const base = currentYearMonth();
    let month = MONTHS[m[2]] == null ? base.m : MONTHS[m[2]] + 1;
    let year = base.y;
    if (base.m === 1 && month === 12) year -= 1;
    if (base.m === 12 && month === 1) year += 1;
    return { y: year, m: month, d: Number(m[1]) };
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
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  function selectDate(key) {
    const input = document.querySelector('input[type="date"]');
    if (input) {
      input.value = key;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const day = String(Number(key.slice(8, 10)));
    const candidates = Array.from(document.querySelectorAll('.cal-day:not(.empty)'));
    const target = candidates.find(el => {
      const txt = el.querySelector('.cal-day-num')?.textContent || el.textContent || '';
      return (txt.match(/\d+/)?.[0] || '') === day;
    });
    if (target) target.click();
  }

  function clickNativeClear(done) {
    const btn = document.querySelector('.clear-day-btn');
    if (!btn) return false;
    btn.click();
    setTimeout(() => {
      const confirm = document.querySelector('.clear-day-btn.confirm') || document.querySelector('.clear-day-btn');
      if (confirm) confirm.click();
      setTimeout(done, 350);
    }, 220);
    return true;
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

  function handle(e) {
    const btn = e.target?.closest?.('[data-delete-row-swipe]');
    if (!btn || busy) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    busy = true;

    const wrap = btn.closest('.week-row-swipe-wrap');
    const d = rowDate(wrap);
    if (!d) {
      busy = false;
      toast('Date introuvable');
      return;
    }

    const key = keyOf(d);
    localStorage.removeItem('deletedWeekDatesV2');
    localStorage.setItem('weekNativeDeleteLastDate', key);

    selectDate(key);
    setTimeout(() => {
      const ok = clickNativeClear(() => {
        clearVisibleRow(wrap);
        toast('Journée supprimée');
        setTimeout(() => location.reload(), 350);
      });
      if (!ok) {
        busy = false;
        toast('Bouton Effacer introuvable');
      }
    }, 350);
  }

  window.addEventListener('click', handle, true);
})();

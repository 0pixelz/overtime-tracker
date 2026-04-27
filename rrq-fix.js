// rrq-fix.js
// Ajoute le suivi RRQ 2026 dans le profil de paie.
(() => {
  if (window.__rrqFixLoaded) return;
  window.__rrqFixLoaded = true;

  const RRQ_MAX_2026 = 4895;
  const $ = (id) => document.getElementById(id);
  const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  const weeks = (v) => v == null || Number.isNaN(Number(v)) ? '—' : `${Math.ceil(v).toLocaleString('fr-CA')} sem.`;

  function readProfile() {
    try { return JSON.parse(localStorage.getItem('paystubProfile') || '{}') || {}; }
    catch { return {}; }
  }

  function valueOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function getWeekStart(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  }

  function formatDate(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatMonth(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
  }

  function finishInfo(weeksRemaining) {
    if (weeksRemaining == null || Number.isNaN(Number(weeksRemaining))) return { week: '—', month: '—' };
    const roundedWeeks = Math.ceil(Number(weeksRemaining));
    const start = getWeekStart();
    const finishWeekStart = addDays(start, roundedWeeks * 7);
    const finishWeekEnd = addDays(finishWeekStart, 6);
    return {
      week: `${formatDate(finishWeekStart)} au ${formatDate(finishWeekEnd)}`,
      month: formatMonth(finishWeekStart)
    };
  }

  function getProfileCard() {
    const labels = [...document.querySelectorAll('.card-label')];
    const label = labels.find(el => (el.textContent || '').toLowerCase().includes('profil de paie'));
    return label ? label.closest('.card') : null;
  }

  function createRow(id, label) {
    const row = document.createElement('div');
    row.className = 'payroll-row rrq-row';
    row.innerHTML = `<span>${label}</span><strong id="${id}">—</strong>`;
    return row;
  }

  function ensureRows() {
    if ($('rrqYtdValue')) return;
    const card = getProfileCard();
    if (!card) return;

    const anchor = $('payImportedNet')?.closest('.payroll-row') || card.querySelector('.payroll-row:last-of-type');
    const rows = [
      createRow('rrqYtdValue', 'RRQ accumulé'),
      createRow('rrqMaxValue', 'Maximum RRQ 2026'),
      createRow('rrqRemainingValue', 'RRQ restant à payer'),
      createRow('rrqWeeklyValue', 'RRQ par semaine'),
      createRow('rrqWeeksRemainingValue', 'Semaines restantes RRQ'),
      createRow('rrqFinishWeekValue', 'Semaine estimée fin RRQ'),
      createRow('rrqFinishMonthValue', 'Mois estimé fin RRQ')
    ];

    if (anchor) rows.reverse().forEach(r => anchor.insertAdjacentElement('afterend', r));
    else rows.forEach(r => card.appendChild(r));
  }

  function render() {
    ensureRows();
    const p = readProfile();

    const rrqYtd = valueOrNull(p.rrqYtd);
    const rrqWeekly = valueOrNull(p.rrq);
    const remaining = rrqYtd != null ? Math.max(0, RRQ_MAX_2026 - rrqYtd) : null;
    const weeksRemaining = remaining != null && rrqWeekly ? remaining / rrqWeekly : null;
    const finish = finishInfo(weeksRemaining);

    if ($('rrqYtdValue')) $('rrqYtdValue').textContent = money(rrqYtd);
    if ($('rrqMaxValue')) $('rrqMaxValue').textContent = money(RRQ_MAX_2026);
    if ($('rrqRemainingValue')) $('rrqRemainingValue').textContent = money(remaining);
    if ($('rrqWeeklyValue')) $('rrqWeeklyValue').textContent = money(rrqWeekly);
    if ($('rrqWeeksRemainingValue')) $('rrqWeeksRemainingValue').textContent = weeks(weeksRemaining);
    if ($('rrqFinishWeekValue')) $('rrqFinishWeekValue').textContent = finish.week;
    if ($('rrqFinishMonthValue')) $('rrqFinishMonthValue').textContent = finish.month;
  }

  function init() {
    render();
    setInterval(render, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

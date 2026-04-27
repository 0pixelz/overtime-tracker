// stats-projection-fix.js
// Corrige la projection annuelle pour utiliser une semaine normale de 37,5 h sans overtime.
(() => {
  if (window.__statsProjectionFixLoaded) return;
  window.__statsProjectionFixLoaded = true;

  const BASE_WEEKLY_HOURS = 37.5;
  const DEFAULT_HOURLY_RATE = 39.743;
  const WEEKS_PER_YEAR = 52;

  // Référence réelle d'une paie normale 37,5 h.
  const REF_NORMAL = {
    hours: 37.5,
    gross: 1490.36,
    deductions: 486.85,
    net: 1003.51
  };

  const NORMAL_DEDUCTION_RATE = REF_NORMAL.deductions / REF_NORMAL.gross;

  const $ = (id) => document.getElementById(id);

  function money(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function hours(value) {
    return Number(value || 0).toLocaleString('fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' h';
  }

  function readProfile() {
    try { return JSON.parse(localStorage.getItem('paystubProfile') || '{}') || {}; }
    catch { return {}; }
  }

  function hourlyRate() {
    const manual = Number(localStorage.getItem('payrollHourlyRate') || 0);
    if (manual > 0) return manual;
    const p = readProfile();
    const imported = Number(p.hourlyRate || 0);
    if (imported > 0) return imported;
    return DEFAULT_HOURLY_RATE;
  }

  function updateProjection() {
    const statsView = $('statsViewFix');
    if (!statsView || !statsView.classList.contains('show')) return;

    const rate = hourlyRate();
    const weeklyGross = BASE_WEEKLY_HOURS * rate;
    const weeklyDeductions = weeklyGross * NORMAL_DEDUCTION_RATE;
    const weeklyNet = weeklyGross - weeklyDeductions;

    const annualHours = BASE_WEEKLY_HOURS * WEEKS_PER_YEAR;
    const annualGross = weeklyGross * WEEKS_PER_YEAR;
    const annualNet = weeklyNet * WEEKS_PER_YEAR;

    if ($('statsProjHours')) $('statsProjHours').textContent = hours(annualHours);
    if ($('statsProjOt')) $('statsProjOt').textContent = hours(0);
    if ($('statsProjGross')) $('statsProjGross').textContent = money(annualGross);
    if ($('statsProjNet')) $('statsProjNet').textContent = money(annualNet);

    const projectionCard = $('statsProjHours')?.closest('.card');
    if (projectionCard && !document.getElementById('statsProjectionBaseNote')) {
      const note = document.createElement('div');
      note.id = 'statsProjectionBaseNote';
      note.className = 'stats-small';
      note.style.marginTop = '12px';
      note.textContent = 'Projection basée sur 37,5 h/semaine, sans overtime.';
      projectionCard.appendChild(note);
    }
  }

  function init() {
    updateProjection();
    setInterval(updateProjection, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

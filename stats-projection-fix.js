// stats-projection-fix.js
// Corrige la projection annuelle pour utiliser une semaine normale de 37,5 h sans overtime.
// Version anti-glitch: corrige la projection immédiatement quand stats-fix.js la réécrit.
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
  let applying = false;

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

  function expectedProjection() {
    const rate = hourlyRate();
    const weeklyGross = BASE_WEEKLY_HOURS * rate;
    const weeklyDeductions = weeklyGross * NORMAL_DEDUCTION_RATE;
    const weeklyNet = weeklyGross - weeklyDeductions;

    return {
      annualHours: BASE_WEEKLY_HOURS * WEEKS_PER_YEAR,
      annualOvertime: 0,
      annualGross: weeklyGross * WEEKS_PER_YEAR,
      annualNet: weeklyNet * WEEKS_PER_YEAR
    };
  }

  function setText(id, value) {
    const el = $(id);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function updateProjection() {
    const statsView = $('statsViewFix');
    if (!statsView || !statsView.classList.contains('show') || applying) return;

    applying = true;
    const p = expectedProjection();

    setText('statsProjHours', hours(p.annualHours));
    setText('statsProjOt', hours(p.annualOvertime));
    setText('statsProjGross', money(p.annualGross));
    setText('statsProjNet', money(p.annualNet));

    const projectionCard = $('statsProjHours')?.closest('.card');
    if (projectionCard && !document.getElementById('statsProjectionBaseNote')) {
      const note = document.createElement('div');
      note.id = 'statsProjectionBaseNote';
      note.className = 'stats-small';
      note.style.marginTop = '12px';
      note.textContent = 'Projection basée sur 37,5 h/semaine, sans overtime.';
      projectionCard.appendChild(note);
    }

    applying = false;
  }

  function observeProjection() {
    const target = document.body;
    const observer = new MutationObserver(() => updateProjection());
    observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function init() {
    updateProjection();
    observeProjection();
    window.addEventListener('storage', updateProjection);
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'payHourlyRateInput') setTimeout(updateProjection, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

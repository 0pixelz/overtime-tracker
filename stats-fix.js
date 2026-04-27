// stats-fix.js
// Correctif simple pour ouvrir la page Statistiques sans bloquer le hamburger menu.
(() => {
  if (window.__statsFixLoaded) return;
  window.__statsFixLoaded = true;

  const $ = (id) => document.getElementById(id);
  const fmt = (v) => Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { return {}; }
  }

  function getEntries() {
    for (const key of ['heuressup.v1', 'heuresData', 'entries', 'timeEntries']) {
      const data = readJson(key);
      if (data && typeof data === 'object' && Object.keys(data).length) return data;
    }
    return {};
  }

  function entryHours(e) {
    if (!e || e.type === 'leave') return 0;
    const direct = Number(e.hours || e.totalHours || e.total || e.duration || 0);
    if (direct > 0) return direct;
    const start = e.start || e.startTime || e.debut;
    const end = e.end || e.endTime || e.fin;
    if (!start || !end) return 0;
    const [sh, sm = 0] = String(start).split(':').map(Number);
    const [eh, em = 0] = String(end).split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return 0;
    let a = sh * 60 + sm;
    let b = eh * 60 + em;
    if (b < a) b += 1440;
    return Math.max(0, (b - a - Number(e.meal || e.mealMinutes || e.pause || 0)) / 60);
  }

  function createStyles() {
    if ($('statsFixStyles')) return;
    const st = document.createElement('style');
    st.id = 'statsFixStyles';
    st.textContent = `
      #statsViewFix{display:none}#statsViewFix.show{display:block}.stats-hidden{display:none!important}
      .stats-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1;margin-bottom:8px}
      .stats-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:18px}
      .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
      .stats-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
      .stats-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:8px}
      .stats-value{font-family:var(--font-display);font-style:italic;font-size:32px;color:var(--accent-text);line-height:1}
      .stats-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}
      .stats-row:last-child{border-bottom:0}.stats-row span{color:var(--text-dim);font-size:13px}.stats-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}
      @media(max-width:430px){.stats-grid{grid-template-columns:1fr}.stats-title{font-size:30px}}
    `;
    document.head.appendChild(st);
  }

  function createView() {
    if ($('statsViewFix')) return;
    const v = document.createElement('main');
    v.id = 'statsViewFix';
    v.innerHTML = `
      <div class="stats-title">Statistiques</div>
      <div class="stats-sub">Résumé de tes heures</div>
      <div class="stats-grid">
        <div class="stats-card"><div class="stats-label">Total heures</div><div class="stats-value" id="statsTotalHoursFix">0,00 h</div></div>
        <div class="stats-card"><div class="stats-label">Jours travaillés</div><div class="stats-value" id="statsWorkedDaysFix">0</div></div>
      </div>
      <div class="card">
        <div class="card-label">Détails</div>
        <div class="stats-row"><span>Heures régulières estimées</span><strong id="statsRegularHoursFix">0,00 h</strong></div>
        <div class="stats-row"><span>Heures à taux 1.5 estimées</span><strong id="statsOvertimeHoursFix">0,00 h</strong></div>
        <div class="stats-row"><span>Jours de congé</span><strong id="statsLeaveDaysFix">0</strong></div>
      </div>
    `;
    const header = document.querySelector('header');
    if (header) header.insertAdjacentElement('afterend', v);
    else document.body.prepend(v);
  }

  function contentNodes() {
    const header = document.querySelector('header');
    if (!header) return [];
    const out = [];
    let n = header.nextElementSibling;
    while (n) {
      const next = n.nextElementSibling;
      const isSystem = ['SCRIPT', 'STYLE'].includes(n.tagName) ||
        n.id === 'sideMenu' || n.id === 'sideBackdrop' ||
        n.classList.contains('sheet') || n.classList.contains('sheet-backdrop');
      if (!isSystem && n.id !== 'statsViewFix' && n.id !== 'payrollView') out.push(n);
      n = next;
    }
    return out;
  }

  function renderStats() {
    const entries = getEntries();
    let total = 0, workedDays = 0, leaveDays = 0;
    Object.values(entries).forEach(e => {
      if (!e) return;
      if (e.type === 'leave') { leaveDays++; return; }
      const h = entryHours(e);
      if (h > 0) { total += h; workedDays++; }
    });
    const regular = Math.min(total, workedDays * 40);
    const overtime = Math.max(0, total - workedDays * 40);
    if ($('statsTotalHoursFix')) $('statsTotalHoursFix').textContent = `${fmt(total)} h`;
    if ($('statsWorkedDaysFix')) $('statsWorkedDaysFix').textContent = String(workedDays);
    if ($('statsRegularHoursFix')) $('statsRegularHoursFix').textContent = `${fmt(regular)} h`;
    if ($('statsOvertimeHoursFix')) $('statsOvertimeHoursFix').textContent = `${fmt(overtime)} h`;
    if ($('statsLeaveDaysFix')) $('statsLeaveDaysFix').textContent = String(leaveDays);
  }

  function closeMenu() {
    $('sideMenu')?.classList.remove('open');
    $('sideBackdrop')?.classList.remove('open');
    document.body.classList.remove('menu-open', 'drawer-open');
  }

  function setActiveMenu(page) {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    const keywords = page === 'stats' ? ['statistique'] : page === 'payroll' ? ['paie', 'calendrier'] : ['accueil'];
    menu.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const txt = (el.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isActive = keywords.some(k => txt.includes(k));
      el.classList.toggle('active', isActive);
      if (isActive) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  function showStats() {
    createStyles();
    createView();
    $('payrollView')?.classList.remove('show');
    document.querySelectorAll('.payroll-hidden').forEach(n => n.classList.remove('payroll-hidden'));
    contentNodes().forEach(n => n.classList.add('stats-hidden'));
    $('statsViewFix')?.classList.add('show');
    renderStats();
    setActiveMenu('stats');
    closeMenu();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHome() {
    $('statsViewFix')?.classList.remove('show');
    $('payrollView')?.classList.remove('show');
    document.querySelectorAll('.stats-hidden,.payroll-hidden').forEach(n => {
      n.classList.remove('stats-hidden');
      n.classList.remove('payroll-hidden');
    });
    setActiveMenu('home');
  }

  function watchPageState() {
    setInterval(() => {
      if ($('payrollView')?.classList.contains('show')) setActiveMenu('payroll');
      else if ($('statsViewFix')?.classList.contains('show')) setActiveMenu('stats');
    }, 700);
  }

  function bindMenu() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a, [role="button"]');
      if (!btn) return;
      const txt = (btn.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (txt.includes('statistique')) {
        e.preventDefault();
        showStats();
        return;
      }

      if (txt.includes('accueil')) {
        showHome();
        return;
      }

      if (txt.includes('calendrier') && txt.includes('paie')) {
        $('statsViewFix')?.classList.remove('show');
        document.querySelectorAll('.stats-hidden').forEach(n => n.classList.remove('stats-hidden'));
        setTimeout(() => setActiveMenu('payroll'), 100);
      }
    });
  }

  function init() {
    createStyles();
    createView();
    bindMenu();
    watchPageState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

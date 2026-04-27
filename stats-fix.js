// stats-fix.js
// Page Statistiques avancée: périodes, projection annuelle et tableau graphique.
(() => {
  if (window.__statsFixLoaded) return;
  window.__statsFixLoaded = true;

  const $ = (id) => document.getElementById(id);
  const BASE_REGULAR_HOURS = 37.5;
  const REGULAR_PAY_LIMIT = 40;
  const DEFAULT_HOURLY_RATE = 39.743;
  const REF_NORMAL = { hours: 37.5, gross: 1490.36, deductions: 486.85, net: 1003.51 };
  const REF_OT = { hours: 40.5, gross: 1619.53, deductions: 543.34, net: 1076.19 };
  const NORMAL_DEDUCTION_RATE = REF_NORMAL.deductions / REF_NORMAL.gross;
  const OT_DEDUCTION_RATE = REF_OT.deductions / REF_OT.gross;
  const MARGINAL_DEDUCTION_RATE = (REF_OT.deductions - REF_NORMAL.deductions) / (REF_OT.gross - REF_NORMAL.gross);

  const fmt = (v) => Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

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

  function parseDateKey(key) {
    const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dkey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfWeek(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  }

  function endOfWeek(date = new Date()) { return addDays(startOfWeek(date), 6); }
  function startOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function endOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
  function startOfYear(date = new Date()) { return new Date(date.getFullYear(), 0, 1); }
  function endOfYear(date = new Date()) { return new Date(date.getFullYear(), 11, 31); }

  function formatDate(date) {
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function periodState() {
    const mode = localStorage.getItem('statsPeriodMode') || 'week';
    const offset = Number(localStorage.getItem('statsPeriodOffset') || 0);
    return { mode, offset: Number.isFinite(offset) ? offset : 0 };
  }

  function setPeriodMode(mode) {
    localStorage.setItem('statsPeriodMode', mode);
    localStorage.setItem('statsPeriodOffset', '0');
    renderStats();
  }

  function movePeriod(delta) {
    const s = periodState();
    if (s.mode === 'all') return;
    localStorage.setItem('statsPeriodOffset', String(s.offset + delta));
    renderStats();
  }

  function currentRange() {
    const { mode, offset } = periodState();
    const now = new Date();
    let anchor = new Date(now);
    if (mode === 'week') anchor = addDays(anchor, offset * 7);
    if (mode === 'month') anchor = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    if (mode === 'year') anchor = new Date(anchor.getFullYear() + offset, 0, 1);

    if (mode === 'week') return { mode, offset, start: startOfWeek(anchor), end: endOfWeek(anchor), label: `${formatDate(startOfWeek(anchor))} au ${formatDate(endOfWeek(anchor))}` };
    if (mode === 'month') return { mode, offset, start: startOfMonth(anchor), end: endOfMonth(anchor), label: anchor.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }) };
    if (mode === 'year') return { mode, offset, start: startOfYear(anchor), end: endOfYear(anchor), label: String(anchor.getFullYear()) };
    return { mode: 'all', offset: 0, start: null, end: null, label: 'Toutes les données' };
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

  function splitHours(hours) {
    const worked = Math.max(0, Number(hours || 0));
    return {
      worked,
      baseRegular: Math.min(worked, BASE_REGULAR_HOURS),
      totalOvertime: Math.max(0, worked - BASE_REGULAR_HOURS),
      simpleOvertime: Math.min(Math.max(0, worked - BASE_REGULAR_HOURS), REGULAR_PAY_LIMIT - BASE_REGULAR_HOURS),
      premiumOvertime: Math.max(0, worked - REGULAR_PAY_LIMIT),
      payAtOne: Math.min(worked, REGULAR_PAY_LIMIT)
    };
  }

  function payrollProfile() {
    const p = readJson('paystubProfile');
    const savedRate = Number(localStorage.getItem('payrollHourlyRate') || 0);
    const hourly = savedRate > 0 ? savedRate : Number(p.hourlyRate || DEFAULT_HOURLY_RATE);
    return { hourly: hourly > 0 ? hourly : DEFAULT_HOURLY_RATE };
  }

  function metroDeductionEstimate(hoursValue, gross) {
    const h = Number(hoursValue || 0), g = Number(gross || 0);
    if (!g) return 0;
    if (Math.abs(h - REF_NORMAL.hours) < 0.01) return REF_NORMAL.deductions;
    if (Math.abs(h - REF_OT.hours) < 0.01) return REF_OT.deductions;
    if (h <= REF_NORMAL.hours) return g * NORMAL_DEDUCTION_RATE;
    if (h <= REF_OT.hours) return REF_NORMAL.deductions + Math.max(0, g - REF_NORMAL.gross) * MARGINAL_DEDUCTION_RATE;
    return REF_OT.deductions + Math.max(0, g - REF_OT.gross) * OT_DEDUCTION_RATE;
  }

  function estimateWeek(hours) {
    const h = splitHours(hours);
    const hourly = payrollProfile().hourly;
    const gross = h.payAtOne * hourly + h.premiumOvertime * hourly * 1.5;
    const deductions = metroDeductionEstimate(h.worked, gross);
    return { ...h, gross, deductions, net: gross - deductions };
  }

  function collectRows() {
    const range = currentRange();
    const rows = [];
    const entries = getEntries();
    Object.entries(entries).forEach(([key, e]) => {
      const date = parseDateKey(key);
      if (!date) return;
      if (range.start && date < range.start) return;
      if (range.end && date > range.end) return;
      const h = entryHours(e);
      const leave = e && e.type === 'leave';
      rows.push({ key, date, hours: h, leave });
    });
    rows.sort((a, b) => a.date - b.date);
    return { range, rows };
  }

  function groupWeeks(rows) {
    const map = new Map();
    rows.forEach(r => {
      const ws = startOfWeek(r.date);
      const key = dkey(ws);
      if (!map.has(key)) map.set(key, { start: ws, end: addDays(ws, 6), hours: 0, days: 0, leave: 0 });
      const w = map.get(key);
      if (r.leave) w.leave += 1;
      if (r.hours > 0) { w.hours += r.hours; w.days += 1; }
    });
    return [...map.values()].sort((a, b) => a.start - b.start);
  }

  function summarize() {
    const { range, rows } = collectRows();
    const weeks = groupWeeks(rows);
    let total = 0, workedDays = 0, leaveDays = 0, gross = 0, net = 0, deductions = 0;
    let baseRegular = 0, otTotal = 0, otSimple = 0, otPremium = 0;

    weeks.forEach(w => {
      const est = estimateWeek(w.hours);
      gross += est.gross;
      net += est.net;
      deductions += est.deductions;
      baseRegular += est.baseRegular;
      otTotal += est.totalOvertime;
      otSimple += est.simpleOvertime;
      otPremium += est.premiumOvertime;
    });

    rows.forEach(r => {
      total += r.hours;
      if (r.hours > 0) workedDays += 1;
      if (r.leave) leaveDays += 1;
    });

    const activeWeeks = weeks.filter(w => w.hours > 0).length || 1;
    const avgWeeklyHours = total / activeWeeks;
    const avgWeeklyGross = gross / activeWeeks;
    const avgWeeklyNet = net / activeWeeks;
    const projected = {
      hours: avgWeeklyHours * 52,
      gross: avgWeeklyGross * 52,
      net: avgWeeklyNet * 52,
      overtime: (otTotal / activeWeeks) * 52
    };

    const bestWeek = weeks.reduce((best, w) => !best || w.hours > best.hours ? w : best, null);
    return { range, rows, weeks, total, workedDays, leaveDays, gross, net, deductions, baseRegular, otTotal, otSimple, otPremium, avgWeeklyHours, projected, bestWeek };
  }

  function createStyles() {
    if ($('statsFixStyles')) return;
    const st = document.createElement('style');
    st.id = 'statsFixStyles';
    st.textContent = `
      #statsViewFix{display:none}#statsViewFix.show{display:block}.stats-hidden{display:none!important}
      .stats-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1;margin-bottom:8px}.stats-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:18px}
      .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.stats-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.stats-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:8px}.stats-value{font-family:var(--font-display);font-style:italic;font-size:32px;color:var(--accent-text);line-height:1}.stats-small{font-size:12px;color:var(--text-dim);margin-top:7px}.stats-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}.stats-row:last-child{border-bottom:0}.stats-row span{color:var(--text-dim);font-size:13px}.stats-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}.stats-period{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.stats-period button,.stats-nav button{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:10px 8px;font-size:12px;font-weight:800;cursor:pointer}.stats-period button.active{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text)}.stats-nav{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}.stats-range{display:inline-flex;margin-bottom:14px;padding:6px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.stats-bars{display:flex;flex-direction:column;gap:12px}.stats-bar-row{display:grid;grid-template-columns:82px 1fr 58px;gap:10px;align-items:center}.stats-bar-label{font-size:11px;color:var(--text-dim);line-height:1.25}.stats-bar-track{height:16px;border-radius:999px;background:var(--bg-elev-2);border:1px solid var(--border);overflow:hidden;display:flex}.stats-bar-base{background:rgba(255,255,255,.28)}.stats-bar-simple{background:rgba(244,184,110,.55)}.stats-bar-premium{background:rgba(229,107,107,.65)}.stats-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.stats-legend span{font-size:11px;color:var(--text-dim)}.stats-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;background:var(--border-strong)}.stats-dot.simple{background:rgba(244,184,110,.75)}.stats-dot.premium{background:rgba(229,107,107,.8)}@media(max-width:430px){.stats-grid,.stats-period{grid-template-columns:1fr 1fr}.stats-title{font-size:30px}.stats-bar-row{grid-template-columns:72px 1fr 52px}}
    `;
    document.head.appendChild(st);
  }

  function createView() {
    if ($('statsViewFix')) return;
    const v = document.createElement('main');
    v.id = 'statsViewFix';
    v.innerHTML = `
      <div class="stats-title">Statistiques</div>
      <div class="stats-sub">Tableau de bord</div>
      <div class="card">
        <div class="card-label">Période</div>
        <div class="stats-period">
          <button id="statsModeWeek" type="button">Semaine</button>
          <button id="statsModeMonth" type="button">Mois</button>
          <button id="statsModeYear" type="button">Année</button>
          <button id="statsModeAll" type="button">Tout</button>
        </div>
        <div class="stats-nav"><button id="statsPrevPeriod" type="button">← Préc.</button><button id="statsCurrentPeriod" type="button">Actuel</button><button id="statsNextPeriod" type="button">Suiv. →</button></div>
        <div id="statsRangeLabel" class="stats-range">—</div>
      </div>
      <div class="stats-grid">
        <div class="stats-card"><div class="stats-label">Total heures</div><div class="stats-value" id="statsTotalHoursFix">0,00 h</div><div class="stats-small" id="statsAvgWeek">Moy. —</div></div>
        <div class="stats-card"><div class="stats-label">Net estimé</div><div class="stats-value" id="statsNetFix">—</div><div class="stats-small">selon ton profil de paie</div></div>
        <div class="stats-card"><div class="stats-label">Overtime total</div><div class="stats-value" id="statsOtTotalFix">0,00 h</div><div class="stats-small">au-dessus de 37,5 h</div></div>
        <div class="stats-card"><div class="stats-label">Jours travaillés</div><div class="stats-value" id="statsWorkedDaysFix">0</div><div class="stats-small" id="statsLeaveDaysSmall">0 congé</div></div>
      </div>
      <div class="card">
        <div class="card-label">Détails de la période</div>
        <div class="stats-row"><span>Base régulière</span><strong id="statsBaseRegularFix">0,00 h</strong></div>
        <div class="stats-row"><span>Overtime temps simple</span><strong id="statsSimpleOtFix">0,00 h</strong></div>
        <div class="stats-row"><span>Overtime taux 1.5</span><strong id="statsPremiumOtFix">0,00 h</strong></div>
        <div class="stats-row"><span>Brut estimé</span><strong id="statsGrossFix">—</strong></div>
        <div class="stats-row"><span>Retenues estimées</span><strong id="statsDeductionsFix">—</strong></div>
        <div class="stats-row"><span>Meilleure semaine</span><strong id="statsBestWeekFix">—</strong></div>
      </div>
      <div class="card">
        <div class="card-label">Projection annuelle</div>
        <div class="stats-row"><span>Heures projetées</span><strong id="statsProjHours">0,00 h</strong></div>
        <div class="stats-row"><span>Overtime projeté</span><strong id="statsProjOt">0,00 h</strong></div>
        <div class="stats-row"><span>Brut projeté</span><strong id="statsProjGross">—</strong></div>
        <div class="stats-row"><span>Net projeté</span><strong id="statsProjNet">—</strong></div>
      </div>
      <div class="card">
        <div class="card-label">Graphique par semaine</div>
        <div id="statsBars" class="stats-bars"></div>
        <div class="stats-legend"><span><i class="stats-dot"></i>Base</span><span><i class="stats-dot simple"></i>OT simple</span><span><i class="stats-dot premium"></i>OT 1.5</span></div>
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
      const isSystem = ['SCRIPT', 'STYLE'].includes(n.tagName) || n.id === 'sideMenu' || n.id === 'sideBackdrop' || n.classList.contains('sheet') || n.classList.contains('sheet-backdrop');
      if (!isSystem && n.id !== 'statsViewFix' && n.id !== 'payrollView') out.push(n);
      n = next;
    }
    return out;
  }

  function renderBars(weeks) {
    const wrap = $('statsBars');
    if (!wrap) return;
    const visible = weeks.slice(-8);
    const max = Math.max(40, ...visible.map(w => w.hours));
    if (!visible.length) { wrap.innerHTML = '<div class="stats-small">Aucune donnée pour cette période.</div>'; return; }
    wrap.innerHTML = visible.map(w => {
      const s = splitHours(w.hours);
      const b = Math.max(0, s.baseRegular / max * 100);
      const simple = Math.max(0, s.simpleOvertime / max * 100);
      const premium = Math.max(0, s.premiumOvertime / max * 100);
      return `<div class="stats-bar-row"><div class="stats-bar-label">${formatDate(w.start).replace(' 2026','')}</div><div class="stats-bar-track"><div class="stats-bar-base" style="width:${b}%"></div><div class="stats-bar-simple" style="width:${simple}%"></div><div class="stats-bar-premium" style="width:${premium}%"></div></div><strong>${fmt(w.hours)} h</strong></div>`;
    }).join('');
  }

  function renderStats() {
    const s = summarize();
    const mode = periodState().mode;
    ['Week','Month','Year','All'].forEach(name => {
      const btn = $(`statsMode${name}`);
      if (btn) btn.classList.toggle('active', mode === name.toLowerCase());
    });
    if ($('statsRangeLabel')) $('statsRangeLabel').textContent = s.range.label;
    if ($('statsTotalHoursFix')) $('statsTotalHoursFix').textContent = `${fmt(s.total)} h`;
    if ($('statsWorkedDaysFix')) $('statsWorkedDaysFix').textContent = String(s.workedDays);
    if ($('statsLeaveDaysSmall')) $('statsLeaveDaysSmall').textContent = `${s.leaveDays} congé`;
    if ($('statsAvgWeek')) $('statsAvgWeek').textContent = `Moy. ${fmt(s.avgWeeklyHours)} h / sem.`;
    if ($('statsOtTotalFix')) $('statsOtTotalFix').textContent = `${fmt(s.otTotal)} h`;
    if ($('statsNetFix')) $('statsNetFix').textContent = money(s.net);
    if ($('statsBaseRegularFix')) $('statsBaseRegularFix').textContent = `${fmt(s.baseRegular)} h`;
    if ($('statsSimpleOtFix')) $('statsSimpleOtFix').textContent = `${fmt(s.otSimple)} h`;
    if ($('statsPremiumOtFix')) $('statsPremiumOtFix').textContent = `${fmt(s.otPremium)} h`;
    if ($('statsGrossFix')) $('statsGrossFix').textContent = money(s.gross);
    if ($('statsDeductionsFix')) $('statsDeductionsFix').textContent = money(s.deductions);
    if ($('statsBestWeekFix')) $('statsBestWeekFix').textContent = s.bestWeek ? `${formatDate(s.bestWeek.start)} · ${fmt(s.bestWeek.hours)} h` : '—';
    if ($('statsProjHours')) $('statsProjHours').textContent = `${fmt(s.projected.hours)} h`;
    if ($('statsProjOt')) $('statsProjOt').textContent = `${fmt(s.projected.overtime)} h`;
    if ($('statsProjGross')) $('statsProjGross').textContent = money(s.projected.gross);
    if ($('statsProjNet')) $('statsProjNet').textContent = money(s.projected.net);
    renderBars(s.weeks);
  }

  function closeMenu() { $('sideMenu')?.classList.remove('open'); $('sideBackdrop')?.classList.remove('open'); document.body.classList.remove('menu-open', 'drawer-open'); }

  function setActiveMenu(page) {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    const keywords = page === 'stats' ? ['statistique'] : page === 'payroll' ? ['paie', 'calendrier'] : ['accueil'];
    menu.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const txt = (el.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isActive = keywords.some(k => txt.includes(k));
      el.classList.toggle('active', isActive);
      if (isActive) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }

  function showStats() {
    createStyles(); createView();
    $('payrollView')?.classList.remove('show');
    document.querySelectorAll('.payroll-hidden').forEach(n => n.classList.remove('payroll-hidden'));
    contentNodes().forEach(n => n.classList.add('stats-hidden'));
    $('statsViewFix')?.classList.add('show');
    renderStats(); setActiveMenu('stats'); closeMenu(); scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHome() {
    $('statsViewFix')?.classList.remove('show'); $('payrollView')?.classList.remove('show');
    document.querySelectorAll('.stats-hidden,.payroll-hidden').forEach(n => { n.classList.remove('stats-hidden'); n.classList.remove('payroll-hidden'); });
    setActiveMenu('home');
  }

  function bindControls() {
    $('statsModeWeek')?.addEventListener('click', () => setPeriodMode('week'));
    $('statsModeMonth')?.addEventListener('click', () => setPeriodMode('month'));
    $('statsModeYear')?.addEventListener('click', () => setPeriodMode('year'));
    $('statsModeAll')?.addEventListener('click', () => setPeriodMode('all'));
    $('statsPrevPeriod')?.addEventListener('click', () => movePeriod(-1));
    $('statsCurrentPeriod')?.addEventListener('click', () => { localStorage.setItem('statsPeriodOffset', '0'); renderStats(); });
    $('statsNextPeriod')?.addEventListener('click', () => movePeriod(1));
  }

  function watchPageState() { setInterval(() => { if ($('payrollView')?.classList.contains('show')) setActiveMenu('payroll'); else if ($('statsViewFix')?.classList.contains('show')) { setActiveMenu('stats'); renderStats(); } }, 1200); }

  function bindMenu() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a, [role="button"]'); if (!btn) return;
      const txt = (btn.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (txt.includes('statistique')) { e.preventDefault(); showStats(); return; }
      if (txt.includes('accueil')) { showHome(); return; }
      if (txt.includes('calendrier') && txt.includes('paie')) { $('statsViewFix')?.classList.remove('show'); document.querySelectorAll('.stats-hidden').forEach(n => n.classList.remove('stats-hidden')); setTimeout(() => setActiveMenu('payroll'), 100); }
    });
  }

  function init() {
    createStyles(); createView(); bindControls(); bindMenu(); watchPageState(); renderStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

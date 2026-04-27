// ai-assistant.js
// Assistant local pour répondre aux questions sur l'app.
(() => {
  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  const $ = (id) => document.getElementById(id);
  const BASE_REGULAR_HOURS = 37.5;
  const OVERTIME_15_THRESHOLD = 40;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { return {}; }
  }

  function profile() { return readJson('paystubProfile'); }
  function settings() { return readJson('payrollSettingsV1'); }

  function money(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function h(v) {
    return Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  }

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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

  function fmtDate(date) {
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function dkey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseDateKey(key) {
    const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function entries() {
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

  function splitHours(total) {
    const worked = Math.max(0, Number(total || 0));
    return {
      worked,
      baseRegular: Math.min(worked, BASE_REGULAR_HOURS),
      totalOvertime: Math.max(0, worked - BASE_REGULAR_HOURS),
      simpleOvertime: Math.min(Math.max(0, worked - BASE_REGULAR_HOURS), OVERTIME_15_THRESHOLD - BASE_REGULAR_HOURS),
      overtime15: Math.max(0, worked - OVERTIME_15_THRESHOLD),
      remainingBase: Math.max(0, BASE_REGULAR_HOURS - worked),
      remainingBefore15: Math.max(0, OVERTIME_15_THRESHOLD - worked)
    };
  }

  function weekSummary(offset = 0) {
    const start = addDays(startOfWeek(), offset * 7);
    const end = addDays(start, 6);
    const data = entries();
    let total = 0;
    let workedDays = 0;
    let leaveDays = 0;
    const daily = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const key = dkey(date);
      const entry = data[key];
      const hours = entryHours(entry);
      const leave = entry && entry.type === 'leave';
      if (hours > 0) workedDays += 1;
      if (leave) leaveDays += 1;
      total += hours;
      daily.push({ date, key, hours, leave });
    }

    return { start, end, total, workedDays, leaveDays, daily, ...splitHours(total) };
  }

  function monthSummary() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const data = entries();
    let total = 0;
    let workedDays = 0;
    Object.entries(data).forEach(([key, e]) => {
      const date = parseDateKey(key);
      if (!date || date < start || date > end) return;
      const hours = entryHours(e);
      total += hours;
      if (hours > 0) workedDays += 1;
    });
    return { start, end, total, workedDays, ...splitHours(total) };
  }

  function appSnapshot() {
    const p = profile();
    const s = settings();
    const hourly = Number(s.hourlyRate || localStorage.getItem('payrollHourlyRate') || p.hourlyRate || 39.743);
    return {
      hourly,
      pdfGross: p.grossPay,
      pdfNet: p.netPay,
      pdfDeductions: p.deductions,
      rrq: p.rrq,
      rrqYtd: p.rrqYtd,
      importedAt: p.importedAt
    };
  }

  function weeklyAnswer(offset = 0) {
    const s = weekSummary(offset);
    const label = offset === 0 ? 'cette semaine' : offset === -1 ? 'la semaine dernière' : 'la semaine sélectionnée';
    const dailyLines = s.daily
      .filter(d => d.hours > 0 || d.leave)
      .map(d => `• ${d.date.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })} : ${d.leave ? 'congé' : h(d.hours)}`)
      .join('\n');

    return `Résumé de ${label}\n${fmtDate(s.start)} au ${fmtDate(s.end)}\n\n` +
      `Total travaillé : ${h(s.worked)}\n` +
      `Base régulière : ${h(s.baseRegular)} / ${h(BASE_REGULAR_HOURS)}\n` +
      `Overtime total : ${h(s.totalOvertime)}\n` +
      `Overtime temps simple : ${h(s.simpleOvertime)}\n` +
      `Overtime taux 1.5 : ${h(s.overtime15)}\n` +
      `Jours travaillés : ${s.workedDays}\n\n` +
      `Heures restantes avant 37,5 h : ${h(s.remainingBase)}\n` +
      `Heures restantes avant taux 1.5 : ${h(s.remainingBefore15)}\n\n` +
      (dailyLines ? `Détail par jour :\n${dailyLines}` : 'Aucune heure enregistrée pour cette semaine.');
  }

  function monthAnswer() {
    const s = monthSummary();
    return `Résumé du mois\n${fmtDate(s.start)} au ${fmtDate(s.end)}\n\n` +
      `Total travaillé : ${h(s.worked)}\n` +
      `Overtime total estimé : ${h(s.totalOvertime)}\n` +
      `Overtime temps simple estimé : ${h(s.simpleOvertime)}\n` +
      `Overtime taux 1.5 estimé : ${h(s.overtime15)}\n` +
      `Jours travaillés : ${s.workedDays}`;
  }

  function createStyles() {
    if ($('aiAssistantStyles')) return;
    const st = document.createElement('style');
    st.id = 'aiAssistantStyles';
    st.textContent = `
      #aiAssistantView{display:none}#aiAssistantView.show{display:flex}.ai-hidden{display:none!important}
      #aiAssistantView{min-height:calc(100vh - 84px);flex-direction:column;margin:-4px -2px 0;padding-bottom:0}
      .ai-shell{display:flex;flex-direction:column;min-height:calc(100vh - 96px);background:linear-gradient(180deg,var(--bg),var(--bg-elev));border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
      .ai-header{padding:18px 16px 12px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
      .ai-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1;margin-bottom:6px}
      .ai-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:700}
      .ai-chat{flex:1;display:flex;flex-direction:column;gap:18px;overflow:auto;padding:18px 14px 140px;white-space:pre-wrap;scroll-behavior:smooth}
      .ai-row{display:flex;gap:10px;align-items:flex-start;width:100%}.ai-row.user{justify-content:flex-end}.ai-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text-dim);font-family:var(--font-mono,monospace);font-size:10px;font-weight:900;letter-spacing:.05em;flex:0 0 auto}.ai-row.user .ai-avatar{display:none}
      .ai-msg{max-width:84%;padding:13px 15px;border-radius:18px;font-size:14px;line-height:1.5;border:1px solid var(--border);box-shadow:0 10px 26px rgba(0,0,0,.12)}
      .ai-msg.bot{background:var(--bg-elev);color:var(--text);border-top-left-radius:6px}.ai-msg.user{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent);border-top-right-radius:6px}.ai-cursor{display:inline-block;width:7px;height:15px;background:var(--accent-text);margin-left:2px;vertical-align:-2px;animation:aiBlink 1s infinite}@keyframes aiBlink{0%,45%{opacity:1}46%,100%{opacity:0}}
      .ai-composer{position:sticky;bottom:0;padding:12px;background:linear-gradient(180deg,rgba(0,0,0,0),var(--bg) 28%);border-top:1px solid var(--border)}
      .ai-suggestions{display:flex;gap:8px;overflow-x:auto;padding:0 0 10px;scrollbar-width:none}.ai-suggestions::-webkit-scrollbar{display:none}.ai-chip{white-space:nowrap;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:999px;color:var(--text);padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer}.ai-chip:active{transform:scale(.98)}
      .ai-input-wrap{display:grid;grid-template-columns:1fr 42px;gap:8px;border:1px solid var(--border);background:var(--bg-elev-2);border-radius:999px;padding:6px}.ai-input-wrap input{width:100%;background:transparent;border:0;outline:0;padding:10px 12px;color:var(--text);font-family:inherit;font-size:14px}.ai-input-wrap button{width:42px;height:42px;border-radius:50%;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent-text);font-size:18px;font-weight:900;cursor:pointer}.ai-info{font-size:11px;color:var(--text-faint);text-align:center;margin-top:8px}
      @media(max-width:430px){#aiAssistantView{min-height:calc(100vh - 70px);margin:-8px -8px 0}.ai-shell{min-height:calc(100vh - 78px);border-radius:0;border-left:0;border-right:0}.ai-title{font-size:30px}.ai-msg{max-width:88%}.ai-chat{padding-bottom:150px}}
    `;
    document.head.appendChild(st);
  }

  function createView() {
    if ($('aiAssistantView')) return;
    const v = document.createElement('main');
    v.id = 'aiAssistantView';
    v.innerHTML = `
      <div class="ai-shell">
        <div class="ai-header">
          <div class="ai-title">AI Assistant</div>
          <div class="ai-sub">Questions sur tes heures et ta paie</div>
        </div>
        <div id="aiChat" class="ai-chat"></div>
        <div class="ai-composer">
          <div class="ai-suggestions">
            <button class="ai-chip" type="button" data-ai-q="J'ai fait combien d'heures cette semaine?">Heures cette semaine</button>
            <button class="ai-chip" type="button" data-ai-q="Combien d'heures restantes avant 37,5 h?">Reste 37,5 h</button>
            <button class="ai-chip" type="button" data-ai-q="Combien d'heures avant le taux 1.5?">Avant taux 1.5</button>
            <button class="ai-chip" type="button" data-ai-q="J'ai fait combien d'heures la semaine dernière?">Semaine dernière</button>
            <button class="ai-chip" type="button" data-ai-q="Combien d'heures ce mois-ci?">Mois</button>
            <button class="ai-chip" type="button" data-ai-q="Pourquoi mon net est différent du PDF?">Net PDF</button>
            <button class="ai-chip" type="button" data-ai-q="Comment fonctionne la RRQ?">RRQ</button>
            <button class="ai-chip" type="button" data-ai-q="Comment utiliser la simulation de paie?">Simulation</button>
            <button class="ai-chip" type="button" data-ai-q="Comment corriger un problème de cache?">Cache</button>
          </div>
          <div class="ai-input-wrap">
            <input id="aiQuestionInput" type="text" placeholder="Message à AI Assistant...">
            <button id="aiSendBtn" type="button" aria-label="Envoyer">↑</button>
          </div>
          <div class="ai-info">Assistant local, basé sur les données sauvegardées dans ton app.</div>
        </div>
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
      const system = ['SCRIPT', 'STYLE'].includes(n.tagName) || n.id === 'sideMenu' || n.id === 'sideBackdrop' || n.classList.contains('sheet') || n.classList.contains('sheet-backdrop');
      if (!system && n.id !== 'aiAssistantView') out.push(n);
      n = next;
    }
    return out;
  }

  function hideOtherViews() {
    ['payrollView', 'statsViewFix', 'payrollSettingsView', 'paySimulationView', 'aiAssistantView'].forEach(id => $(id)?.classList.remove('show'));
    document.querySelectorAll('.payroll-hidden,.stats-hidden,.pay-extra-hidden,.ai-hidden').forEach(n => {
      n.classList.remove('payroll-hidden');
      n.classList.remove('stats-hidden');
      n.classList.remove('pay-extra-hidden');
      n.classList.remove('ai-hidden');
    });
  }

  function closeMenu() {
    $('sideMenu')?.classList.remove('open');
    $('sideBackdrop')?.classList.remove('open');
    document.body.classList.remove('menu-open', 'drawer-open');
  }

  function setActiveMenu() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    menu.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const txt = normalize(el.textContent);
      const active = txt.includes('assistant') || txt.includes('ai');
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }

  function createMessage(role, text = '') {
    const chat = $('aiChat');
    if (!chat) return null;
    const row = document.createElement('div');
    row.className = `ai-row ${role}`;
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = role === 'bot' ? 'AI' : 'ME';
    const msg = document.createElement('div');
    msg.className = `ai-msg ${role}`;
    msg.textContent = text;
    row.appendChild(avatar);
    row.appendChild(msg);
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
    return msg;
  }

  function addMessage(role, text) {
    createMessage(role, text);
  }

  function typeMessage(text) {
    const chat = $('aiChat');
    const msg = createMessage('bot', '');
    if (!msg) return;
    const cursor = document.createElement('span');
    cursor.className = 'ai-cursor';
    msg.appendChild(cursor);
    let i = 0;
    const speed = text.length > 450 ? 4 : 9;
    const timer = setInterval(() => {
      i += text.length > 650 ? 4 : 2;
      const part = text.slice(0, i);
      msg.textContent = part;
      if (i < text.length) msg.appendChild(cursor);
      if (chat) chat.scrollTop = chat.scrollHeight;
      if (i >= text.length) clearInterval(timer);
    }, speed);
  }

  function answer(question) {
    const q = normalize(question);
    const data = appSnapshot();

    if (!q) return 'Écris une question sur les heures, la paie, le PDF, la RRQ, les statistiques ou la simulation.';

    if ((q.includes('combien') || q.includes('fait')) && q.includes('heure') && (q.includes('semaine derniere') || q.includes('derniere semaine'))) return weeklyAnswer(-1);
    if ((q.includes('combien') || q.includes('fait')) && q.includes('heure') && q.includes('mois')) return monthAnswer();
    if ((q.includes('combien') || q.includes('fait') || q.includes('resume')) && q.includes('heure') && q.includes('semaine')) return weeklyAnswer(0);
    if (q.includes('restante') || q.includes('reste') || q.includes('avant 37') || q.includes('37,5') || q.includes('37.5')) return weeklyAnswer(0);
    if (q.includes('avant le taux') || q.includes('avant taux') || q.includes('avant 1.5') || q.includes('40h') || q.includes('40 h')) return weeklyAnswer(0);

    if (q.includes('overtime') || q.includes('temps simple') || q.includes('1.5') || q.includes('supplementaire')) {
      return 'Ton app sépare les heures comme ceci : base régulière jusqu’à 37,5 h, overtime temps simple entre 37,5 h et 40 h, puis overtime taux 1.5 au-dessus de 40 h.\n\nExemple : 40,5 h = 37,5 h base + 2,5 h overtime simple + 0,5 h à 1.5.';
    }

    if (q.includes('net') || q.includes('retenue') || q.includes('brut')) {
      return `Le net estimé est calculé à partir du brut moins les retenues.\n\nSelon ton profil actuel :\nTaux horaire : ${money(data.hourly)}/h\nBrut PDF : ${money(data.pdfGross)}\nRetenues PDF : ${money(data.pdfDeductions)}\nNet PDF : ${money(data.pdfNet)}\n\nUne différence avec le PDF peut arriver si la semaine contient des primes, assurances, ajustements ou déductions spéciales.`;
    }

    if (q.includes('rrq') || q.includes('regie') || q.includes('quebec')) {
      return `La section RRQ suit le montant accumulé et estime quand tu vas finir de payer.\n\nDonnées actuelles :\nRRQ semaine importée : ${money(data.rrq)}\nRRQ accumulé : ${money(data.rrqYtd)}\n\nL’estimation utilise une semaine normale de 37,5 h pour éviter qu’une semaine avec overtime fausse la projection.`;
    }

    if (q.includes('pdf') || q.includes('talon') || q.includes('import')) {
      return 'Pour importer un talon, va dans Calendrier de paie puis Importer un talon de paie PDF.\n\nL’app lit localement le PDF avec PDF.js et sauvegarde le profil dans ton navigateur. Si les valeurs ne changent pas, supprime le PDF importé puis réimporte-le après avoir fermé/réouvert l’app.';
    }

    if (q.includes('simulation') || q.includes('simuler')) {
      return 'La Simulation de paie sert à tester des scénarios comme 37,5 h, 40 h, 40,5 h ou 45 h.\n\nElle affiche brut, net, retenues, overtime total, overtime temps simple, overtime 1.5 et RRQ estimée selon tes paramètres de paie.';
    }

    if (q.includes('statistique') || q.includes('projection') || q.includes('graphique')) {
      return 'La page Statistiques sert à voir tes heures par semaine, mois, année ou toutes les données.\n\nLa projection annuelle est basée sur une semaine normale de 37,5 h sans overtime, pour éviter de gonfler ton salaire projeté avec quelques semaines exceptionnelles.';
    }

    if (q.includes('parametre') || q.includes('taux horaire') || q.includes('config')) return `Dans Paramètres paie, tu peux modifier le taux horaire, la base 37,5 h, le seuil 1.5, le RRQ normal et les valeurs de référence.\n\nTon taux horaire actuel est ${money(data.hourly)}/h.`;

    if (q.includes('cache') || q.includes('mise a jour') || q.includes('bug') || q.includes('glitch')) return 'Comme ton app est une PWA, le cache peut garder une ancienne version.\n\nFerme/réouvre l’app, puis rafraîchis deux fois. Si ça persiste, va dans les paramètres du navigateur/app et vide le cache du site.';

    return 'Je peux t’aider avec : tes heures cette semaine, heures restantes avant 37,5 h, overtime, net estimé, RRQ, import PDF, statistiques, paramètres de paie, simulation et cache.\n\nEssaie : “J’ai fait combien d’heures cette semaine?”.';
  }

  function sendQuestion(text) {
    const input = $('aiQuestionInput');
    const q = text || input?.value || '';
    if (!q.trim()) return;
    addMessage('user', q.trim());
    if (input) input.value = '';
    setTimeout(() => typeMessage(answer(q)), 160);
  }

  function showAssistant() {
    createStyles();
    createView();
    hideOtherViews();
    contentNodes().forEach(n => n.classList.add('ai-hidden'));
    $('aiAssistantView')?.classList.add('show');
    if ($('aiChat') && !$('aiChat').dataset.started) {
      $('aiChat').dataset.started = '1';
      typeMessage('Salut! Pose-moi une question sur ton app. Je peux te dire combien d’heures tu as fait cette semaine, ton overtime et les heures restantes avant 37,5 h ou 40 h.');
    }
    setActiveMenu();
    closeMenu();
    scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => $('aiQuestionInput')?.focus(), 250);
  }

  function addMenuButton() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu || $('navAiAssistantBtn')) return;
    const b = document.createElement('button');
    b.id = 'navAiAssistantBtn';
    b.type = 'button';
    b.className = 'side-nav-btn';
    b.innerHTML = '<span class="side-nav-icon">AI</span><span>AI Assistant</span>';
    b.addEventListener('click', showAssistant);
    menu.appendChild(b);
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'aiSendBtn') sendQuestion();
      if (btn.dataset.aiQ) sendQuestion(btn.dataset.aiQ);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'aiQuestionInput') sendQuestion();
    });
  }

  function init() {
    createStyles();
    createView();
    addMenuButton();
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

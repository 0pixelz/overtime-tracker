// ai-assistant.js
// Assistant local pour répondre aux questions sur l'app.
(() => {
  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  const $ = (id) => document.getElementById(id);

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { return {}; }
  }

  function profile() {
    return readJson('paystubProfile');
  }

  function settings() {
    return readJson('payrollSettingsV1');
  }

  function money(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function createStyles() {
    if ($('aiAssistantStyles')) return;
    const st = document.createElement('style');
    st.id = 'aiAssistantStyles';
    st.textContent = `
      #aiAssistantView{display:none}#aiAssistantView.show{display:block}.ai-hidden{display:none!important}
      .ai-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1;margin-bottom:8px}
      .ai-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:18px}
      .ai-chat{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;max-height:52vh;overflow:auto;padding-right:2px}
      .ai-msg{padding:12px 14px;border-radius:var(--radius-sm);font-size:14px;line-height:1.45;border:1px solid var(--border)}
      .ai-msg.bot{background:var(--bg-elev);color:var(--text)}
      .ai-msg.user{background:var(--accent-soft);color:var(--accent-text);align-self:flex-end;max-width:88%}
      .ai-input-wrap{display:grid;grid-template-columns:1fr auto;gap:8px;position:sticky;bottom:0;background:var(--bg);padding-top:8px}
      .ai-input-wrap input{width:100%;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:13px;color:var(--text);font-family:inherit}
      .ai-input-wrap button,.ai-chip{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px 14px;font-size:12px;font-weight:800;cursor:pointer}
      .ai-input-wrap button{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text)}
      .ai-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .ai-chip{padding:9px 10px}
      .ai-info{font-size:12px;color:var(--text-dim);margin-top:10px}
      @media(max-width:430px){.ai-title{font-size:30px}.ai-input-wrap{grid-template-columns:1fr}.ai-msg.user{max-width:100%}}
    `;
    document.head.appendChild(st);
  }

  function createView() {
    if ($('aiAssistantView')) return;
    const v = document.createElement('main');
    v.id = 'aiAssistantView';
    v.innerHTML = `
      <div class="ai-title">AI Assistant</div>
      <div class="ai-sub">Aide pour ton app</div>
      <div class="card">
        <div class="card-label">Conversation</div>
        <div id="aiChat" class="ai-chat"></div>
        <div class="ai-input-wrap">
          <input id="aiQuestionInput" type="text" placeholder="Pose une question sur l'app...">
          <button id="aiSendBtn" type="button">Envoyer</button>
        </div>
        <div class="ai-chips">
          <button class="ai-chip" type="button" data-ai-q="Comment fonctionne le calcul overtime?">Overtime</button>
          <button class="ai-chip" type="button" data-ai-q="Pourquoi mon net est différent du PDF?">Net estimé</button>
          <button class="ai-chip" type="button" data-ai-q="Comment fonctionne la RRQ?">RRQ</button>
          <button class="ai-chip" type="button" data-ai-q="Comment importer mon talon de paie?">PDF</button>
          <button class="ai-chip" type="button" data-ai-q="Comment utiliser la simulation de paie?">Simulation</button>
        </div>
        <div class="ai-info">Assistant local : il répond selon les règles et les données sauvegardées dans ton app.</div>
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
      const system = ['SCRIPT', 'STYLE'].includes(n.tagName) ||
        n.id === 'sideMenu' || n.id === 'sideBackdrop' ||
        n.classList.contains('sheet') || n.classList.contains('sheet-backdrop');
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

  function addMessage(role, text) {
    const chat = $('aiChat');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
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

  function answer(question) {
    const q = normalize(question);
    const data = appSnapshot();

    if (!q) return 'Écris une question sur les heures, la paie, le PDF, la RRQ, les statistiques ou la simulation.';

    if (q.includes('overtime') || q.includes('temps simple') || q.includes('1.5') || q.includes('supplementaire')) {
      return 'Ton app sépare les heures comme ceci : base régulière jusqu’à 37,5 h, overtime temps simple entre 37,5 h et 40 h, puis overtime taux 1.5 au-dessus de 40 h. Exemple : 40,5 h = 37,5 h base + 2,5 h overtime simple + 0,5 h à 1.5.';
    }

    if (q.includes('net') || q.includes('retenue') || q.includes('brut')) {
      return `Le net estimé est calculé à partir du brut moins les retenues. Selon ton profil actuel : taux horaire ${money(data.hourly)}/h, brut PDF ${money(data.pdfGross)}, retenues PDF ${money(data.pdfDeductions)}, net PDF ${money(data.pdfNet)}. Une différence avec le PDF peut arriver si la semaine contient des primes, assurances, ajustements ou déductions spéciales.`;
    }

    if (q.includes('rrq') || q.includes('regie') || q.includes('quebec')) {
      return `La section RRQ suit le montant accumulé et estime quand tu vas finir de payer. Données actuelles : RRQ semaine importée ${money(data.rrq)}, RRQ accumulé ${money(data.rrqYtd)}. L’estimation utilise une semaine normale de 37,5 h pour éviter qu’une semaine avec overtime fausse la projection.`;
    }

    if (q.includes('pdf') || q.includes('talon') || q.includes('import')) {
      return 'Pour importer un talon, va dans Calendrier de paie puis Importer un talon de paie PDF. L’app lit localement le PDF avec PDF.js et sauvegarde le profil dans ton navigateur. Si les valeurs ne changent pas, supprime le PDF importé puis réimporte-le après avoir fermé/réouvert l’app.';
    }

    if (q.includes('simulation') || q.includes('simuler')) {
      return 'La Simulation de paie sert à tester des scénarios comme 37,5 h, 40 h, 40,5 h ou 45 h. Elle affiche brut, net, retenues, overtime total, overtime temps simple, overtime 1.5 et RRQ estimée selon tes paramètres de paie.';
    }

    if (q.includes('statistique') || q.includes('projection') || q.includes('graphique')) {
      return 'La page Statistiques sert à voir tes heures par semaine, mois, année ou toutes les données. La projection annuelle est basée sur une semaine normale de 37,5 h sans overtime, pour éviter de gonfler ton salaire projeté avec quelques semaines exceptionnelles.';
    }

    if (q.includes('parametre') || q.includes('taux horaire') || q.includes('config')) {
      return `Dans Paramètres paie, tu peux modifier le taux horaire, la base 37,5 h, le seuil 1.5, le RRQ normal et les valeurs de référence. Ton taux horaire actuel est ${money(data.hourly)}/h.`;
    }

    if (q.includes('cache') || q.includes('mise a jour') || q.includes('bug') || q.includes('glitch')) {
      return 'Comme ton app est une PWA, le cache peut garder une ancienne version. Ferme/réouvre l’app, puis rafraîchis deux fois. Si ça persiste, va dans les paramètres du navigateur/app et vide le cache du site.';
    }

    return 'Je peux t’aider avec : calcul overtime, net estimé, RRQ, import PDF, statistiques, paramètres de paie, simulation et problèmes de cache. Essaie une question comme : “Pourquoi mon net est différent?” ou “Comment fonctionne la RRQ?”.';
  }

  function sendQuestion(text) {
    const input = $('aiQuestionInput');
    const q = text || input?.value || '';
    if (!q.trim()) return;
    addMessage('user', q.trim());
    if (input) input.value = '';
    setTimeout(() => addMessage('bot', answer(q)), 120);
  }

  function showAssistant() {
    createStyles();
    createView();
    hideOtherViews();
    contentNodes().forEach(n => n.classList.add('ai-hidden'));
    $('aiAssistantView')?.classList.add('show');
    if ($('aiChat') && !$('aiChat').dataset.started) {
      $('aiChat').dataset.started = '1';
      addMessage('bot', 'Salut! Pose-moi une question sur ton app : paie, overtime, PDF, RRQ, statistiques ou simulation.');
    }
    setActiveMenu();
    closeMenu();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addMenuButton() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu || $('navAiAssistantBtn')) return;
    const b = document.createElement('button');
    b.id = 'navAiAssistantBtn';
    b.type = 'button';
    b.className = 'side-nav-btn';
    b.innerHTML = '<span class="side-nav-icon">✨</span><span>AI Assistant</span>';
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

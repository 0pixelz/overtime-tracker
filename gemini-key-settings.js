// gemini-key-settings.js
// Ajoute un champ Gemini dans Paramètres paie pour configurer la clé localement.
(() => {
  if (window.__geminiKeySettingsLoaded) return;
  window.__geminiKeySettingsLoaded = true;

  const KEY = 'GEMINI_BROWSER_KEY';
  const $ = id => document.getElementById(id);

  function hasKey() {
    return !!localStorage.getItem(KEY);
  }

  function maskKey(value) {
    if (!value) return '';
    if (value.length <= 10) return '••••••';
    return value.slice(0, 6) + '••••••••' + value.slice(-4);
  }

  function ensureStyles() {
    if ($('geminiKeySettingsStyles')) return;
    const st = document.createElement('style');
    st.id = 'geminiKeySettingsStyles';
    st.textContent = `
      .gemini-key-status{font-size:12px;color:var(--text-dim);margin-top:10px;line-height:1.4}
      .gemini-key-ok{color:var(--accent-text);font-weight:800}
      .gemini-key-danger{border-color:rgba(229,107,107,.45)!important;background:rgba(229,107,107,.08)!important;color:var(--danger)!important}
      .gemini-key-full{grid-column:1/-1}
    `;
    document.head.appendChild(st);
  }

  function settingsCard() {
    const view = $('payrollSettingsView');
    if (!view) return null;
    return view;
  }

  function ensureCard() {
    ensureStyles();
    if ($('geminiKeyCard')) return;
    const view = settingsCard();
    if (!view) return;

    const card = document.createElement('div');
    card.id = 'geminiKeyCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="card-label">Assistant IA Gemini</div>
      <div class="pay-extra-row">
        <span>Statut Gemini</span>
        <strong id="geminiKeyStatusLabel">Non configuré</strong>
      </div>
      <div class="pay-extra-inputs">
        <div class="gemini-key-full">
          <label>Clé API Gemini</label>
          <input id="geminiBrowserKeyInput" type="password" autocomplete="off" placeholder="Colle ta clé Gemini ici">
        </div>
      </div>
      <div class="pay-extra-actions">
        <button id="saveGeminiKeyBtn" class="accent" type="button">Sauvegarder la clé</button>
        <button id="removeGeminiKeyBtn" class="gemini-key-danger" type="button">Supprimer la clé</button>
      </div>
      <div id="geminiKeyStatusText" class="gemini-key-status">
        La clé est sauvegardée seulement sur cet appareil dans le navigateur.
      </div>
    `;

    view.appendChild(card);
    render();
  }

  function render() {
    const key = localStorage.getItem(KEY) || '';
    const label = $('geminiKeyStatusLabel');
    const input = $('geminiBrowserKeyInput');
    const text = $('geminiKeyStatusText');

    if (label) {
      label.textContent = key ? 'Configuré' : 'Non configuré';
      label.classList.toggle('gemini-key-ok', !!key);
    }
    if (input) input.placeholder = key ? maskKey(key) : 'Colle ta clé Gemini ici';
    if (text) {
      text.textContent = key
        ? `Gemini direct est activé avec la clé ${maskKey(key)}. Les questions ouvertes utiliseront Gemini.`
        : 'Entre ta clé Gemini pour activer les réponses IA directes sans Render.';
    }
  }

  function saveKey() {
    const input = $('geminiBrowserKeyInput');
    const value = (input?.value || '').trim();
    if (!value) {
      render();
      return;
    }
    localStorage.setItem(KEY, value);
    if (input) input.value = '';
    render();
  }

  function removeKey() {
    localStorage.removeItem(KEY);
    const input = $('geminiBrowserKeyInput');
    if (input) input.value = '';
    render();
  }

  function bind() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'saveGeminiKeyBtn') saveKey();
      if (btn.id === 'removeGeminiKeyBtn') removeKey();
    });
  }

  function watchSettings() {
    setInterval(() => {
      if ($('payrollSettingsView')?.classList.contains('show')) {
        ensureCard();
        render();
      }
    }, 500);
  }

  function init() {
    bind();
    watchSettings();
    ensureCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

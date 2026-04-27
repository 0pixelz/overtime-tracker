// gemini-assistant-bridge.js
// Hybrid assistant bridge: local rules first, Gemini for open questions.
// Option A: backend endpoint in localStorage GEMINI_ASSISTANT_ENDPOINT
// Option B: browser-only key in localStorage GEMINI_BROWSER_KEY
(() => {
  if (window.__geminiAssistantBridgeLoaded) return;
  window.__geminiAssistantBridgeLoaded = true;

  const DEFAULT_ENDPOINT = '/api/assistant';
  const MODEL_CACHE_KEY = 'GEMINI_SELECTED_MODEL';
  const PREFERRED_MODELS = [
    'models/gemini-2.0-flash',
    'models/gemini-2.0-flash-lite',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-flash',
    'models/gemini-pro'
  ];
  const $ = id => document.getElementById(id);

  function readJson(key, fallback = {}) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) || fallback; }
    catch { return fallback; }
  }

  function getEntries() {
    for (const key of ['heuressup.v1', 'heuresData', 'entries', 'timeEntries']) {
      const data = readJson(key, {});
      if (data && typeof data === 'object' && Object.keys(data).length) return data;
    }
    return {};
  }

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function shouldUseLocal(question) {
    const q = normalize(question);
    const localWords = ['combien d heure','combien dheure','heures cette semaine','semaine derniere','rrq','reste a payer','restante','avant 37','avant 40','overtime','talon','pdf','simulation','cache','ajoute','rentre','aujourd'];
    return localWords.some(w => q.includes(w));
  }

  function contextSnapshot() {
    const p = readJson('paystubProfile', {});
    const s = readJson('payrollSettingsV1', {});
    return {
      settings: {
        hourlyRate: Number(s.hourlyRate || localStorage.getItem('payrollHourlyRate') || p.hourlyRate || 39.743),
        baseRegularHours: Number(s.baseRegularHours || 37.5),
        overtimeThreshold: Number(s.overtimeThreshold || 40),
        normalRrqWeekly: Number(s.normalRrqWeekly || 94.23),
        rrqMax: Number(s.rrqMax || 4895)
      },
      importedPaystub: {
        grossPay: p.grossPay || null,
        netPay: p.netPay || null,
        deductions: p.deductions || null,
        rrq: p.rrq || null,
        rrqYtd: p.rrqYtd || null,
        importedAt: p.importedAt || null
      },
      entries: getEntries()
    };
  }

  function promptText(question) {
    return `Tu es l'assistant intégré d'une application de suivi d'heures et de paie. Réponds en français québécois, clairement et brièvement. N'invente pas de chiffres. Règles: base régulière 37,5 h, overtime temps simple de 37,5 h à 40 h, overtime 1.5 au-dessus de 40 h. Les calculs locaux sont prioritaires.\n\nQuestion:\n${question}\n\nContexte local:\n${JSON.stringify(contextSnapshot(), null, 2)}`;
  }

  function addBotMessage(text) {
    const chat = $('aiChat'); if (!chat) return;
    const row = document.createElement('div'); row.className = 'ai-row bot';
    const avatar = document.createElement('div'); avatar.className = 'ai-avatar'; avatar.textContent = 'AI';
    const msg = document.createElement('div'); msg.className = 'ai-msg bot'; msg.textContent = text;
    row.appendChild(avatar); row.appendChild(msg); chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    return msg;
  }

  function addUserMessage(text) {
    const chat = $('aiChat'); if (!chat) return;
    const row = document.createElement('div'); row.className = 'ai-row user';
    const avatar = document.createElement('div'); avatar.className = 'ai-avatar'; avatar.textContent = 'ME';
    const msg = document.createElement('div'); msg.className = 'ai-msg user'; msg.textContent = text;
    row.appendChild(avatar); row.appendChild(msg); chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
  }

  async function listAvailableModels(key) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Impossible de lister les modèles Gemini.');
    return (data.models || []).filter(model => (model.supportedGenerationMethods || []).includes('generateContent'));
  }

  async function selectModel(key) {
    const cached = localStorage.getItem(MODEL_CACHE_KEY);
    if (cached) return cached;

    const models = await listAvailableModels(key);
    const names = models.map(model => model.name);
    const preferred = PREFERRED_MODELS.find(name => names.includes(name));
    const selected = preferred || names.find(name => name.includes('flash')) || names[0];

    if (!selected) throw new Error('Aucun modèle Gemini compatible generateContent trouvé avec cette clé.');
    localStorage.setItem(MODEL_CACHE_KEY, selected);
    return selected;
  }

  async function generateWithModel(key, modelName, question) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/' + modelName + ':generateContent?key=' + encodeURIComponent(key);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText(question) }] }],
        generationConfig: { temperature: 0.25, topP: 0.9, maxOutputTokens: 700 }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Erreur Gemini directe.');
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || 'Je n’ai pas reçu de réponse.';
  }

  async function askDirect(question) {
    const browserKey = localStorage.getItem('GEMINI_BROWSER_KEY');
    if (!browserKey) throw new Error('Aucune clé Gemini locale configurée.');

    let modelName = await selectModel(browserKey);
    try {
      return await generateWithModel(browserKey, modelName, question);
    } catch (error) {
      // Si le modèle sauvegardé n'est plus disponible, on efface le cache et on réessaie une fois.
      localStorage.removeItem(MODEL_CACHE_KEY);
      modelName = await selectModel(browserKey);
      return await generateWithModel(browserKey, modelName, question);
    }
  }

  async function askBackend(question) {
    const endpoint = localStorage.getItem('GEMINI_ASSISTANT_ENDPOINT') || DEFAULT_ENDPOINT;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: contextSnapshot() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erreur Gemini.');
    return data.answer || 'Je n’ai pas reçu de réponse.';
  }

  async function askGemini(question) {
    return localStorage.getItem('GEMINI_BROWSER_KEY') ? askDirect(question) : askBackend(question);
  }

  async function submitGemini(question) {
    addUserMessage(question);
    const input = $('aiQuestionInput'); if (input) input.value = '';
    const loading = addBotMessage(localStorage.getItem('GEMINI_BROWSER_KEY') ? 'Je cherche le meilleur modèle Gemini disponible…' : 'Je réfléchis avec Gemini…');
    try {
      const answer = await askGemini(question);
      const model = localStorage.getItem(MODEL_CACHE_KEY);
      if (loading) loading.textContent = model ? `${answer}\n\nModèle utilisé : ${model.replace('models/', '')}` : answer;
    } catch (error) {
      if (loading) loading.textContent = `Gemini n’est pas disponible pour le moment. ${error.message || ''}`.trim();
    }
  }

  function bind() {
    document.addEventListener('click', event => {
      const btn = event.target.closest('button');
      if (!btn || btn.id !== 'aiSendBtn') return;
      const q = $('aiQuestionInput')?.value || '';
      if (!q.trim() || shouldUseLocal(q)) return;
      event.preventDefault(); event.stopImmediatePropagation(); submitGemini(q.trim());
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.target?.id !== 'aiQuestionInput') return;
      const q = $('aiQuestionInput')?.value || '';
      if (!q.trim() || shouldUseLocal(q)) return;
      event.preventDefault(); event.stopImmediatePropagation(); submitGemini(q.trim());
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();

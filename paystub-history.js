// paystub-history.js
// Historique local des talons de paie: import multi-PDF, tableau, suppression, export CSV.
(() => {
  if (window.__paystubHistoryLoaded) return;
  window.__paystubHistoryLoaded = true;

  const STORE = 'paystubHistoryV1';
  const $ = id => document.getElementById(id);

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) || fallback; }
    catch { return fallback; }
  }

  function saveHistory(items) {
    localStorage.setItem(STORE, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('paystub-history-updated', { detail: items }));
  }

  function history() {
    const list = readJson(STORE, []);
    return Array.isArray(list) ? list : [];
  }

  function money(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmtHours(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function parseDateFromRaw(text) {
    const t = cleanText(text);
    const dateMatch = t.match(/DATE\s+(20\d{2}[-/]\d{2}[-/]\d{2})/i);
    if (dateMatch) return dateMatch[1].replace(/\//g, '-');
    const any = t.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2})\b/);
    return any ? any[1].replace(/\//g, '-') : null;
  }

  function parsePeriodFromRaw(text) {
    const t = cleanText(text);
    const m = t.match(/P[ÉE]RIODE\s*\/\s*PERIOD.*?(20\d{2}[-/]\d{2}[-/]\d{2}).*?(20\d{2}[-/]\d{2}[-/]\d{2})/i)
      || t.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2})\s+(20\d{2}[-/]\d{2}[-/]\d{2})\b/);
    if (!m) return { start: null, end: null };
    return { start: m[1].replace(/\//g, '-'), end: m[2].replace(/\//g, '-') };
  }

  function makeId(item) {
    return [item.payDate, item.periodStart, item.periodEnd, item.grossPay, item.netPay, item.fileName]
      .map(v => String(v || ''))
      .join('|')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 80) + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function toHistoryItem(analysis, fileName) {
    const raw = analysis.rawText || '';
    const period = parsePeriodFromRaw(raw);
    const payDate = parseDateFromRaw(raw);
    const regularHours = num(analysis.regularHours) || 0;
    const ot1 = num(analysis.overtimeHours1x) || 0;
    const ot15 = num(analysis.overtimeHours15x) || 0;
    const overtimeHours = num(analysis.overtimeHours) ?? (ot1 + ot15);
    const item = {
      id: null,
      fileName: fileName || 'talon.pdf',
      source: analysis.source || 'pdf',
      importedAt: new Date().toISOString(),
      payDate,
      periodStart: period.start,
      periodEnd: period.end,
      grossPay: num(analysis.grossPay),
      netPay: num(analysis.netPay),
      deductions: num(analysis.deductions),
      deductionRate: num(analysis.deductionRate),
      regularHours: regularHours || null,
      overtimeHours: overtimeHours || 0,
      overtimeHours1x: ot1 || 0,
      overtimeHours15x: ot15 || 0,
      totalHours: regularHours + (overtimeHours || 0),
      hourlyRate: num(analysis.hourlyRate),
      rrq: num(analysis.rrq),
      rrqYtd: num(analysis.rrqYtd),
      rqap: num(analysis.rqap),
      ei: num(analysis.ei),
      federalTax: num(analysis.federalTax),
      provincialTax: num(analysis.provincialTax)
    };
    item.id = makeId(item);
    return item;
  }

  function ensureStyles() {
    if ($('paystubHistoryStyles')) return;
    const st = document.createElement('style');
    st.id = 'paystubHistoryStyles';
    st.textContent = `
      .pay-history-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      .pay-history-actions button,.pay-history-actions label{display:flex;align-items:center;justify-content:center;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px 10px;font-size:12px;font-weight:800;cursor:pointer;text-align:center}
      .pay-history-actions .accent{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text)}
      .pay-history-actions .danger{border-color:rgba(229,107,107,.45);background:rgba(229,107,107,.08);color:var(--danger)}
      .pay-history-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}
      .pay-history-item{border:1px solid var(--border);background:var(--bg-elev-2);border-radius:var(--radius-sm);padding:13px}
      .pay-history-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}
      .pay-history-title{font-weight:900;color:var(--text);font-size:13px}.pay-history-sub{font-size:11px;color:var(--text-faint);margin-top:4px;line-height:1.35}
      .pay-history-net{font-family:var(--font-mono);font-weight:900;color:var(--accent-text);white-space:nowrap;font-size:14px;text-align:right}
      .pay-history-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pay-history-mini div{font-size:12px;color:var(--text-dim)}.pay-history-mini strong{display:block;color:var(--text);font-family:var(--font-mono);margin-top:3px}
      .pay-history-delete{margin-top:10px;width:100%;background:transparent;border:1px solid rgba(229,107,107,.45);border-radius:var(--radius-sm);color:var(--danger);padding:9px;font-size:11px;font-weight:900;cursor:pointer}
      .pay-history-status{font-size:12px;color:var(--text-dim);margin-top:10px;line-height:1.4}
      @media(max-width:430px){.pay-history-actions{grid-template-columns:1fr}.pay-history-mini{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(st);
  }

  function findContainer() {
    return $('payrollSettingsView') || $('payrollView') || document.querySelector('main') || document.body;
  }

  function ensureCard() {
    ensureStyles();
    if ($('paystubHistoryCard')) return;
    const container = findContainer();
    if (!container) return;
    const card = document.createElement('div');
    card.id = 'paystubHistoryCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="card-label">Historique de paie</div>
      <div class="pay-extra-row"><span>Paies sauvegardées</span><strong id="payHistoryCount">0</strong></div>
      <div class="pay-extra-row"><span>Net total historique</span><strong id="payHistoryTotalNet">—</strong></div>
      <div class="pay-history-actions">
        <label class="accent" for="payHistoryPdfInput">Importer plusieurs PDF</label>
        <input id="payHistoryPdfInput" type="file" accept="application/pdf" multiple style="display:none">
        <button id="exportPayHistoryBtn" type="button">Exporter CSV</button>
        <button id="clearPayHistoryBtn" class="danger" type="button">Tout supprimer</button>
      </div>
      <div id="payHistoryStatus" class="pay-history-status">Importe tes talons PDF pour bâtir ton historique local.</div>
      <div id="payHistoryList" class="pay-history-list"></div>
    `;
    container.appendChild(card);
    render();
  }

  function summarizeHistory(items) {
    return items.reduce((acc, item) => {
      acc.net += Number(item.netPay || 0);
      acc.gross += Number(item.grossPay || 0);
      acc.deductions += Number(item.deductions || 0);
      acc.hours += Number(item.totalHours || 0);
      return acc;
    }, { net: 0, gross: 0, deductions: 0, hours: 0 });
  }

  function periodLabel(item) {
    if (item.periodStart && item.periodEnd) return `${item.periodStart} au ${item.periodEnd}`;
    if (item.payDate) return `Date: ${item.payDate}`;
    return 'Période non détectée';
  }

  function render() {
    const items = history().sort((a, b) => String(b.payDate || b.periodEnd || b.importedAt).localeCompare(String(a.payDate || a.periodEnd || a.importedAt)));
    const summary = summarizeHistory(items);
    if ($('payHistoryCount')) $('payHistoryCount').textContent = String(items.length);
    if ($('payHistoryTotalNet')) $('payHistoryTotalNet').textContent = money(summary.net);
    const list = $('payHistoryList');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="pay-history-status">Aucune paie sauvegardée pour le moment.</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="pay-history-item" data-pay-id="${item.id}">
        <div class="pay-history-top">
          <div>
            <div class="pay-history-title">${periodLabel(item)}</div>
            <div class="pay-history-sub">${item.fileName || 'PDF'} · importé ${new Date(item.importedAt).toLocaleDateString('fr-CA')}</div>
          </div>
          <div class="pay-history-net">${money(item.netPay)}</div>
        </div>
        <div class="pay-history-mini">
          <div>Brut<strong>${money(item.grossPay)}</strong></div>
          <div>Retenues<strong>${money(item.deductions)}</strong></div>
          <div>Heures<strong>${fmtHours(item.totalHours)}</strong></div>
          <div>Overtime<strong>${fmtHours(item.overtimeHours)}</strong></div>
          <div>RRQ<strong>${money(item.rrq)}</strong></div>
          <div>RRQ accum.<strong>${money(item.rrqYtd)}</strong></div>
        </div>
        <button class="pay-history-delete" type="button" data-delete-paystub="${item.id}">Supprimer cette paie</button>
      </div>
    `).join('');
  }

  async function importFiles(files) {
    const inputFiles = Array.from(files || []).filter(f => f && f.type === 'application/pdf');
    if (!inputFiles.length) return;
    if (!window.PaystubPDF) {
      if ($('payHistoryStatus')) $('payHistoryStatus').textContent = 'PDF.js / PaystubPDF n’est pas chargé.';
      return;
    }

    const current = history();
    let added = 0;
    let failed = 0;
    if ($('payHistoryStatus')) $('payHistoryStatus').textContent = `Analyse de ${inputFiles.length} PDF en cours…`;

    for (const file of inputFiles) {
      try {
        const analysis = await window.PaystubPDF.analyzeFile(file);
        if (!analysis) throw new Error('Analyse vide');
        const item = toHistoryItem(analysis, file.name);
        const duplicate = current.some(x =>
          x.periodStart === item.periodStart &&
          x.periodEnd === item.periodEnd &&
          Math.abs(Number(x.netPay || 0) - Number(item.netPay || 0)) < 0.01
        );
        if (!duplicate) {
          current.push(item);
          added++;
        }
        window.PaystubPDF.saveProfileFromAnalysis(analysis);
      } catch (err) {
        failed++;
      }
    }

    saveHistory(current);
    render();
    if ($('payHistoryStatus')) $('payHistoryStatus').textContent = `${added} paie(s) ajoutée(s).${failed ? ' ' + failed + ' PDF non analysé(s).' : ''}`;
  }

  function deleteOne(id) {
    saveHistory(history().filter(item => item.id !== id));
    render();
  }

  function clearAll() {
    if (!confirm('Supprimer tout l’historique de paie?')) return;
    saveHistory([]);
    render();
  }

  function csvValue(v) {
    const s = String(v ?? '');
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    const items = history();
    if (!items.length) return;
    const headers = ['payDate','periodStart','periodEnd','grossPay','netPay','deductions','regularHours','overtimeHours','overtimeHours1x','overtimeHours15x','totalHours','hourlyRate','rrq','rrqYtd','rqap','ei','federalTax','provincialTax','fileName','importedAt'];
    const rows = [headers.join(',')].concat(items.map(item => headers.map(h => csvValue(item[h])).join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historique_paie.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    document.addEventListener('change', e => {
      if (e.target?.id === 'payHistoryPdfInput') importFiles(e.target.files);
    });
    document.addEventListener('click', e => {
      const del = e.target.closest('[data-delete-paystub]');
      if (del) deleteOne(del.dataset.deletePaystub);
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'exportPayHistoryBtn') exportCsv();
      if (btn.id === 'clearPayHistoryBtn') clearAll();
    });
  }

  function watch() {
    setInterval(() => {
      const visible = $('payrollSettingsView')?.classList.contains('show') || $('payrollView')?.classList.contains('show');
      if (visible) {
        ensureCard();
        render();
      }
    }, 700);
  }

  function init() {
    bind();
    ensureCard();
    watch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

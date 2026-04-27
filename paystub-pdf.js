// paystub-pdf.js
// Analyse locale d'un talon de paie PDF avec PDF.js.
// Ce fichier garde le PDF dans le navigateur: rien n'est envoyé à un serveur.

window.PaystubPDF = (() => {
  const MONEY_REGEX = /(?:\$\s*)?(-?\d{1,3}(?:[\s,]\d{3})*[,.]\d{2}|-?\d+[,.]\d{2})\s*\$?/g;

  function normalizeMoney(value) {
    if (!value) return null;
    const cleaned = String(value)
      .replace(/\$/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatMoney(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return (value * 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function findAmountNearLabels(text, labels) {
    const lower = text.toLowerCase();

    for (const label of labels) {
      const index = lower.indexOf(label.toLowerCase());
      if (index === -1) continue;

      const slice = text.slice(index, index + 260);
      const matches = [...slice.matchAll(MONEY_REGEX)]
        .map(match => normalizeMoney(match[1]))
        .filter(value => value !== null);

      if (matches.length) return matches[matches.length - 1];
    }

    return null;
  }

  function extractHours(text) {
    const result = { regularHours: null, overtimeHours: null };

    const regularMatch = text.match(/(?:heures?\s*)?(?:r[ée]guli[èe]res?|regulieres?|regular)\D+(\d+[,.]\d{1,2}|\d+)\s*h?/i);
    if (regularMatch) result.regularHours = normalizeMoney(regularMatch[1]);

    const overtimeMatch = text.match(/(?:heures?\s*)?(?:suppl[ée]mentaires?|sup\.?|overtime)\D+(\d+[,.]\d{1,2}|\d+)\s*h?/i);
    if (overtimeMatch) result.overtimeHours = normalizeMoney(overtimeMatch[1]);

    return result;
  }

  function analyzeText(text) {
    const grossPay = findAmountNearLabels(text, [
      'salaire brut', 'paie brute', 'brut', 'gross pay', 'gross earnings', 'total earnings'
    ]);

    const netPay = findAmountNearLabels(text, [
      'salaire net', 'paie nette', 'net à payer', 'net a payer', 'net pay', 'deposit amount'
    ]);

    const deductions = findAmountNearLabels(text, [
      'total retenues', 'retenues', 'déductions', 'deductions', 'total deductions'
    ]);

    const federalTax = findAmountNearLabels(text, ['impôt fédéral', 'impot federal', 'federal tax']);
    const provincialTax = findAmountNearLabels(text, ['impôt provincial', 'impot provincial', 'provincial tax', 'quebec tax', 'québec tax']);
    const rrq = findAmountNearLabels(text, ['rrq', 'qpp']);
    const rqap = findAmountNearLabels(text, ['rqap', 'qpip']);
    const ei = findAmountNearLabels(text, ['assurance emploi', 'employment insurance', 'ei']);

    const hours = extractHours(text);
    const inferredDeductions = deductions ?? (grossPay !== null && netPay !== null ? grossPay - netPay : null);
    const deductionRate = grossPay && inferredDeductions !== null ? inferredDeductions / grossPay : null;

    return {
      grossPay,
      netPay,
      deductions: inferredDeductions,
      deductionRate,
      federalTax,
      provincialTax,
      rrq,
      rqap,
      ei,
      regularHours: hours.regularHours,
      overtimeHours: hours.overtimeHours,
      rawText: text
    };
  }

  async function readPdfText(file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js n’est pas chargé dans index.html.');
    }

    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      pages.push(pageText);
    }

    return pages.join('\n');
  }

  async function analyzeFile(file) {
    const text = await readPdfText(file);
    return analyzeText(text);
  }

  function saveProfileFromAnalysis(analysis) {
    const profile = {
      grossPay: analysis.grossPay,
      netPay: analysis.netPay,
      deductions: analysis.deductions,
      deductionRate: analysis.deductionRate,
      federalTax: analysis.federalTax,
      provincialTax: analysis.provincialTax,
      rrq: analysis.rrq,
      rqap: analysis.rqap,
      ei: analysis.ei,
      regularHours: analysis.regularHours,
      overtimeHours: analysis.overtimeHours,
      importedAt: new Date().toISOString()
    };
    localStorage.setItem('paystubProfile', JSON.stringify(profile));
    return profile;
  }

  return {
    analyzeFile,
    analyzeText,
    readPdfText,
    saveProfileFromAnalysis,
    formatMoney,
    formatPercent
  };
})();

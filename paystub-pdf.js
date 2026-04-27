// paystub-pdf.js
// Analyse locale d'un talon de paie PDF avec PDF.js.
// Ce fichier garde le PDF dans le navigateur: rien n'est envoyé à un serveur.

window.PaystubPDF = (() => {
  const MONEY_REGEX = /(?:\$\s*)?(-?\d{1,6}(?:[\s,]\d{3})*[,.]\d{2,3}|-?\d+[,.]\d{2,3})\s*\$?/g;

  function normalizeMoney(value) {
    if (!value) return null;
    const cleaned = String(value)
      .replace(/\$/g, '')
      .replace(/\*/g, '')
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

  function firstNumberAfter(text, regex) {
    const match = text.match(regex);
    return match ? normalizeMoney(match[1]) : null;
  }

  function cleanAmount(value) {
    const n = normalizeMoney(value);
    if (n === null) return null;
    return Math.round(n * 100) / 100;
  }

  function findDeductionPair(normalized, labelRegex) {
    const match = normalized.match(labelRegex);
    if (!match || match.index === undefined) return { current: null, ytd: null };
    const slice = normalized.slice(match.index, match.index + 90);
    const nums = [...slice.matchAll(MONEY_REGEX)].map(m => cleanAmount(m[1])).filter(v => v !== null);
    return { current: nums[0] ?? null, ytd: nums[1] ?? null };
  }

  function findNetTotal(normalized) {
    const direct = firstNumberAfter(normalized, /NET\s+TOTAL\s+\*+\s*(\d+(?:[,.]\d+)?)/i);
    if (direct !== null) return direct;
    const compact = normalized.replace(/\s+/g, ' ');
    const match = compact.match(/GAINS\s+NETS\s+NET\s+TOTAL\s+\*+\s*(\d+(?:[,.]\d+)?)/i);
    if (match) return normalizeMoney(match[1]);
    return null;
  }

  function findTotalDeductions(normalized) {
    const bottom = normalized.match(/TOTAL\s+DES\s+RETENUES\s+TOTAL\s+DEDUCTIONS\s+(\d+(?:[,.]\d+)?)/i);
    if (bottom) return cleanAmount(bottom[1]);
    return null;
  }

  function findTotalEarnings(normalized) {
    const bottom = normalized.match(/TOTAL\s+DES\s+GAINS\s+TOTAL\s+EARNINGS\s+(\d+(?:[,.]\d+)?)/i);
    if (bottom) return cleanAmount(bottom[1]);
    const bottomLoose = normalized.match(/TOTAL\s+EARNINGS\s+(\d+(?:[,.]\d+)?)/i);
    if (bottomLoose) return cleanAmount(bottomLoose[1]);
    return null;
  }

  function parseMetroPaystub(text) {
    const normalized = text.replace(/\s+/g, ' ').trim();

    let grossPay = findTotalEarnings(normalized);
    let deductions = findTotalDeductions(normalized);
    let netPay = findNetTotal(normalized);

    const totals = normalized.match(/GAINS\s+NETS\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+NET\s+TOTAL\s+\*+\s*(\d+(?:[,.]\d+)?)/i);
    if (totals) {
      if (grossPay === null) grossPay = cleanAmount(totals[1]);
      if (deductions === null) deductions = cleanAmount(totals[2]);
      if (netPay === null) netPay = cleanAmount(totals[3]);
    }

    const regular = normalized.match(/HRS\.?\s*REG\.?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/i);
    const overtimeOne = normalized.match(/TS\s*X\s*1[,.]0\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/i);
    const overtimeOneHalf = normalized.match(/TS\s*X\s*1[,.]5\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/i);

    const regularHours = regular ? normalizeMoney(regular[1]) : null;
    const hourlyRate = regular ? normalizeMoney(regular[2]) : null;
    const regularAmount = regular ? cleanAmount(regular[3]) : null;
    const overtimeHours1x = overtimeOne ? normalizeMoney(overtimeOne[1]) : 0;
    const overtimeRate1x = overtimeOne ? normalizeMoney(overtimeOne[2]) : null;
    const overtimeAmount1x = overtimeOne ? cleanAmount(overtimeOne[3]) : null;
    const overtimeHours15x = overtimeOneHalf ? normalizeMoney(overtimeOneHalf[1]) : 0;
    const overtimeRate15x = overtimeOneHalf ? normalizeMoney(overtimeOneHalf[2]) : null;
    const overtimeAmount15x = overtimeOneHalf ? cleanAmount(overtimeOneHalf[3]) : null;

    if (grossPay === null && netPay !== null && deductions !== null) grossPay = Math.round((netPay + deductions) * 100) / 100;
    if (grossPay === null) {
      const pieces = [regularAmount, overtimeAmount1x, overtimeAmount15x].filter(v => v !== null && Number.isFinite(v));
      if (pieces.length) grossPay = Math.round(pieces.reduce((a, b) => a + b, 0) * 100) / 100;
    }
    if (grossPay !== null && netPay !== null && deductions !== null) {
      const inferredGross = Math.round((netPay + deductions) * 100) / 100;
      if (Math.abs(grossPay - inferredGross) > 2 && inferredGross > 0) grossPay = inferredGross;
    }
    if (deductions === null && grossPay !== null && netPay !== null) deductions = Math.round((grossPay - netPay) * 100) / 100;

    if (!grossPay && !netPay && !regularHours && !deductions) return null;

    const rrqPair = findDeductionPair(normalized, /R\.?R\.?Q\.?/i);
    const rqapPair = findDeductionPair(normalized, /RQAP/i);
    const eiPair = findDeductionPair(normalized, /ASS\.?\s*EMP\.?/i);
    const federalPair = findDeductionPair(normalized, /IMP\.?\s*FED/i);
    const provincialPair = findDeductionPair(normalized, /IMP\.?\s*PROV/i);

    return {
      source: 'metro',
      grossPay,
      netPay,
      deductions,
      deductionRate: grossPay && deductions !== null ? deductions / grossPay : null,
      regularHours,
      hourlyRate,
      regularAmount,
      overtimeHours: Number(overtimeHours1x || 0) + Number(overtimeHours15x || 0),
      overtimeHours1x,
      overtimeRate1x,
      overtimeAmount1x,
      overtimeHours15x,
      overtimeRate15x,
      overtimeAmount15x,
      federalTax: federalPair.current,
      federalTaxYtd: federalPair.ytd,
      provincialTax: provincialPair.current,
      provincialTaxYtd: provincialPair.ytd,
      rrq: rrqPair.current,
      rrqYtd: rrqPair.ytd,
      rqap: rqapPair.current,
      rqapYtd: rqapPair.ytd,
      ei: eiPair.current,
      eiYtd: eiPair.ytd
    };
  }

  function findAmountNearLabels(text, labels) {
    const lower = text.toLowerCase();
    for (const label of labels) {
      const index = lower.indexOf(label.toLowerCase());
      if (index === -1) continue;
      const slice = text.slice(index, index + 260);
      const matches = [...slice.matchAll(MONEY_REGEX)].map(match => normalizeMoney(match[1])).filter(value => value !== null);
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
    const metro = parseMetroPaystub(text);
    if (metro) return { ...metro, rawText: text };

    const grossPay = findAmountNearLabels(text, ['salaire brut', 'paie brute', 'brut', 'gross pay', 'gross earnings', 'total earnings']);
    const netPay = findAmountNearLabels(text, ['salaire net', 'paie nette', 'net à payer', 'net a payer', 'net pay', 'deposit amount']);
    const deductions = findAmountNearLabels(text, ['total retenues', 'retenues', 'déductions', 'deductions', 'total deductions']);
    const federalTax = findAmountNearLabels(text, ['impôt fédéral', 'impot federal', 'federal tax']);
    const provincialTax = findAmountNearLabels(text, ['impôt provincial', 'impot provincial', 'provincial tax', 'quebec tax', 'québec tax']);
    const rrq = findAmountNearLabels(text, ['rrq', 'qpp']);
    const rqap = findAmountNearLabels(text, ['rqap', 'qpip']);
    const ei = findAmountNearLabels(text, ['assurance emploi', 'employment insurance', 'ei']);
    const hours = extractHours(text);
    const inferredDeductions = deductions ?? (grossPay !== null && netPay !== null ? grossPay - netPay : null);
    const deductionRate = grossPay && inferredDeductions !== null ? inferredDeductions / grossPay : null;

    return { source: 'generic', grossPay, netPay, deductions: inferredDeductions, deductionRate, federalTax, provincialTax, rrq, rqap, ei, regularHours: hours.regularHours, overtimeHours: hours.overtimeHours, hourlyRate: grossPay && hours.regularHours ? grossPay / hours.regularHours : null, rawText: text };
  }

  async function readPdfText(file) {
    if (!window.pdfjsLib) throw new Error('PDF.js n’est pas chargé dans index.html.');
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .map(item => ({ str: item.str, x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }))
        .filter(item => item.str && item.str.trim())
        .sort((a, b) => {
          if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
          return a.x - b.x;
        });
      pages.push(items.map(item => item.str).join(' '));
    }
    return pages.join('\n');
  }

  async function analyzeFile(file) {
    const text = await readPdfText(file);
    return analyzeText(text);
  }

  function saveProfileFromAnalysis(analysis) {
    const profile = {
      source: analysis.source,
      grossPay: analysis.grossPay,
      netPay: analysis.netPay,
      deductions: analysis.deductions,
      deductionRate: analysis.deductionRate,
      federalTax: analysis.federalTax,
      federalTaxYtd: analysis.federalTaxYtd,
      provincialTax: analysis.provincialTax,
      provincialTaxYtd: analysis.provincialTaxYtd,
      rrq: analysis.rrq,
      rrqYtd: analysis.rrqYtd,
      rqap: analysis.rqap,
      rqapYtd: analysis.rqapYtd,
      ei: analysis.ei,
      eiYtd: analysis.eiYtd,
      regularHours: analysis.regularHours,
      hourlyRate: analysis.hourlyRate,
      regularAmount: analysis.regularAmount,
      overtimeHours: analysis.overtimeHours,
      overtimeHours1x: analysis.overtimeHours1x,
      overtimeRate1x: analysis.overtimeRate1x,
      overtimeAmount1x: analysis.overtimeAmount1x,
      overtimeHours15x: analysis.overtimeHours15x,
      overtimeRate15x: analysis.overtimeRate15x,
      overtimeAmount15x: analysis.overtimeAmount15x,
      importedAt: new Date().toISOString()
    };
    localStorage.setItem('paystubProfile', JSON.stringify(profile));
    return profile;
  }

  return { analyzeFile, analyzeText, readPdfText, saveProfileFromAnalysis, formatMoney, formatPercent };
})();

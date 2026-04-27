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

  function allNumbers(text) {
    return [...String(text).matchAll(MONEY_REGEX)]
      .map(m => normalizeMoney(m[1]))
      .filter(v => v !== null);
  }

  function cleanAmount(value) {
    const n = normalizeMoney(value);
    if (n === null) return null;
    return Math.round(n * 100) / 100;
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
    // Bottom footer format is the most reliable:
    // TOTAL DES GAINS TOTAL EARNINGS 1619.53 TOTAL DES RETENUES...
    const bottom = normalized.match(/TOTAL\s+DES\s+GAINS\s+TOTAL\s+EARNINGS\s+(\d+(?:[,.]\d+)?)/i);
    if (bottom) return cleanAmount(bottom[1]);

    // Another possible extraction order around bottom footer.
    const bottomLoose = normalized.match(/TOTAL\s+EARNINGS\s+(\d+(?:[,.]\d+)?)/i);
    if (bottomLoose) return cleanAmount(bottomLoose[1]);

    return null;
  }

  function parseMetroPaystub(text) {
    const normalized = text.replace(/\s+/g, ' ').trim();

    let grossPay = null;
    let deductions = null;
    let netPay = null;

    // Footer totals have priority because they are the pay-period totals.
    grossPay = findTotalEarnings(normalized);
    deductions = findTotalDeductions(normalized);
    netPay = findNetTotal(normalized);

    // Format sometimes extracted in a single line:
    // GAINS NETS 1619.53 543.34 NET TOTAL *****1076.19
    // Only use this if footer values were not found.
    const totals = normalized.match(/GAINS\s+NETS\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+NET\s+TOTAL\s+\*+\s*(\d+(?:[,.]\d+)?)/i);
    if (totals) {
      if (grossPay === null) grossPay = cleanAmount(totals[1]);
      if (deductions === null) deductions = cleanAmount(totals[2]);
      if (netPay === null) netPay = cleanAmount(totals[3]);
    }

    // HRS.REG. 37.50 39.743 1490.36 18811.95
    const regular = normalized.match(/HRS\.?\s*REG\.?\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/i);

    // TS X 1.0 2.50 39.743 99.36 278.21
    const overtimeOne = normalized.match(/TS\s*X\s*1[,.]0\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)/i);

    // TS X 1.5 0.50 59.615 29.81 59.62
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

    // If footer gave net/deductions but not gross, infer gross.
    if (grossPay === null && netPay !== null && deductions !== null) {
      grossPay = Math.round((netPay + deductions) * 100) / 100;
    }

    // If gross still missing, rebuild only from current earnings lines.
    if (grossPay === null) {
      const pieces = [regularAmount, overtimeAmount1x, overtimeAmount15x]
        .filter(v => v !== null && Number.isFinite(v));
      if (pieces.length) grossPay = Math.round(pieces.reduce((a, b) => a + b, 0) * 100) / 100;
    }

    // Guard: if gross is clearly wrong but net + deductions are reliable, correct it.
    // This prevents columns/date-to-date totals from being mistaken for current gross.
    if (grossPay !== null && netPay !== null && deductions !== null) {
      const inferredGross = Math.round((netPay + deductions) * 100) / 100;
      if (Math.abs(grossPay - inferredGross) > 2 && inferredGross > 0) {
        grossPay = inferredGross;
      }
    }

    if (deductions === null && grossPay !== null && netPay !== null) {
      deductions = Math.round((grossPay - netPay) * 100) / 100;
    }

    if (!grossPay && !netPay && !regularHours && !deductions) return null;

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
      federalTax: firstNumberAfter(normalized, /IMP\.?\s*FED\s+(\d+(?:[,.]\d+)?)/i),
      provincialTax: firstNumberAfter(normalized, /IMP\.?\s*PROV\s+(\d+(?:[,.]\d+)?)/i),
      rrq: firstNumberAfter(normalized, /R\.?R\.?Q\.?\s+(\d+(?:[,.]\d+)?)/i),
      rqap: firstNumberAfter(normalized, /RQAP\s+(\d+(?:[,.]\d+)?)/i),
      ei: firstNumberAfter(normalized, /ASS\.?\s*EMP\.?\s+(\d+(?:[,.]\d+)?)/i)
    };
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
    const metro = parseMetroPaystub(text);
    if (metro) {
      return { ...metro, rawText: text };
    }

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
      source: 'generic',
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
      hourlyRate: grossPay && hours.regularHours ? grossPay / hours.regularHours : null,
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

      const items = content.items
        .map(item => ({ str: item.str, x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }))
        .filter(item => item.str && item.str.trim())
        .sort((a, b) => {
          if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
          return a.x - b.x;
        });

      const pageText = items.map(item => item.str).join(' ');
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
      source: analysis.source,
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

  return {
    analyzeFile,
    analyzeText,
    readPdfText,
    saveProfileFromAnalysis,
    formatMoney,
    formatPercent
  };
})();

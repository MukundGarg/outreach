/**
 * Lightweight RFC-4180 compliant CSV parser and sanitizer.
 * Safe against CSV formula injection and handles quotes, multiline values, and commas.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Parses raw CSV text into an array of string arrays (rows and cells).
 */
export function parseCsvTokens(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses raw CSV into headers and row records with safe bounds.
 */
export function parseCsv(text: string, maxRows = 200): CsvParseResult {
  if (!text || text.trim().length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const tokenized = parseCsvTokens(text);
  if (tokenized.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = tokenized[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const dataLines = tokenized.slice(1);
  const totalRows = dataLines.length;

  const boundedLines = dataLines.slice(0, maxRows);
  const rows = boundedLines.map((line) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = line[index] !== undefined ? line[index].trim() : '';
    });
    return record;
  });

  return {
    headers,
    rows,
    totalRows,
  };
}

/**
 * Sanitizes cell values to prevent CSV formula injection (=, +, -, @, tab, cr).
 */
export function sanitizeCsvField(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}


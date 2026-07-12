/** Serializes one field for a CSV cell: quotes it and escapes embedded quotes.
 * Also guards against CSV formula injection -- a cell starting with =/+/-/@ can
 * execute as a formula when the file is opened in Excel/Sheets. */
export function toCsvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: string[]): string {
  return values.map(toCsvField).join(",");
}

/** RFC4180-ish CSV parser: handles quoted fields, embedded commas/quotes/newlines,
 * and both CRLF and LF line endings. Undoes the leading `'` that toCsvField adds
 * to guard against formula injection. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function pushField() {
    row.push(/^'[=+\-@]/.test(field) ? field.slice(1) : field);
    field = "";
  }

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushField();
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Minimal, dependency-free CSV builder used by the export endpoints. Values are
// quoted and internal quotes doubled so a reading or alert message containing a
// comma or quote cannot corrupt the row.

export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  // CRLF line endings + trailing newline per RFC 4180.
  return lines.join("\r\n") + "\r\n";
}

/** Response headers that make the browser download the CSV with a given name. */
export function csvDownloadHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  };
}

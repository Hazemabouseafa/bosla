'use client';

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = str.replace(/"/g, '""');
  return `"${safe}"`;
}

/**
 * Exports rows as UTF-8 BOM CSV so Arabic text opens cleanly in Microsoft Excel and Google Sheets.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>,
) {
  if (typeof window === 'undefined') return;
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

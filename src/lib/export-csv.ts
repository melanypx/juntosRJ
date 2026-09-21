/**
 * Convierte un array de objetos a CSV y lanza la descarga del archivo.
 * Usa ; como separador (Excel español lo abre directo) y BOM UTF-8 para
 * que los acentos y ñ se vean bien en Excel.
 */

type Primitive = string | number | boolean | null | undefined;

interface ColumnSpec<T> {
  key: keyof T;
  label: string;
  // Permite formatear el valor antes de escribirlo (ej: número con $)
  format?: (value: T[keyof T], row: T) => Primitive;
}

function escapeCell(value: Primitive): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Si tiene ; " o saltos, encerrar en comillas dobles
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCSV<T>(
  rows: T[],
  columns: ColumnSpec<T>[],
  filename: string
): void {
  const header = columns.map((c) => escapeCell(c.label)).join(';');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const value = c.format ? c.format(raw, row) : (raw as Primitive);
          return escapeCell(value);
        })
        .join(';')
    )
    .join('\n');

  // BOM + contenido
  const csv = '﻿' + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

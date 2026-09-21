import { google } from 'googleapis';
import type { SheetRow, BudgetLine } from './types';

function parseMonto(value: string): number {
  if (!value) return 0;
  const trimmed = value.trim();
  // Detecta números negativos: "-$50.000", "($50.000)", "-50.000"
  const isNegative =
    /^-/.test(trimmed) ||
    /^\$\s*-/.test(trimmed) ||
    /^\(.*\)$/.test(trimmed);
  // Maneja formato chileno: "$ 1.234.567" o "1234567"
  const clean = trimmed.replace(/[^0-9]/g, '');
  const n = parseInt(clean, 10) || 0;
  return isNegative ? -n : n;
}

export async function getSheetHeaders(): Promise<string[]> {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: process.env.GOOGLE_SHEET_RANGE ?? 'A:Y',
  });
  return (res.data.values?.[0] ?? []) as string[];
}

export async function getSheetData(): Promise<SheetRow[]> {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: process.env.GOOGLE_SHEET_RANGE ?? 'A:Y',
  });

  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];

  // La primera fila es el encabezado; la saltamos
  return rows.slice(1).map((row): SheetRow => ({
    estado:               (row[0]  ?? '').trim(),
    email:                row[1]  ?? '',
    solicitadaPor:        row[2]  ?? '',
    lineaPresupuestaria:  row[3]  ?? '',
    marcaTemporal:        row[4]  ?? '',
    mes:                  row[5]  ?? '',
    proyecto:             row[6]  ?? '',
    nroOC:                row[7]  ?? '',
    proveedor:            row[8]  ?? '',
    monto:                parseMonto(row[9]),
    descripcion:          row[10] ?? '',
    rendirA:              row[11] ?? '',
    col13:                row[12] ?? '',
    col14:                row[13] ?? '',
    tipoDocumento:        row[14] ?? '',
    nroDocumento:         row[15] ?? '',
    rut:                  row[16] ?? '',
    banco:                row[17] ?? '',
    numeroCuenta:         row[18] ?? '',
    correoProveedor:      row[19] ?? '',
    account:              row[20] ?? '',
    linkOC:               row[21] ?? '',
    linkFactura:          row[22] ?? '',
    fechaFactura:         row[23] ?? '',
    linkPago:             row[24] ?? '',
  }));
}

/**
 * Lee la hoja PRESUPUESTO y devuelve las líneas que tienen monto asignado.
 * Columnas:
 *   A = Código (3 niveles)
 *   D = Categoría Topsheet
 *   E = Sub-cuenta
 *   F = Descripción ítem
 *   G = Subtotal CLP
 *   H = Fringe CLP
 *   I = Total c/Fringe CLP  ← usamos esta como presupuesto final
 *
 * Además captura la línea especial "(+) CONTINGENCIA (XXX)" del final
 * y la incluye como su propia categoría top-level.
 */
export async function getBudgetData(): Promise<BudgetLine[]> {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'PRESUPUESTO!A:I',
  });

  const rows = res.data.values ?? [];
  const result: BudgetLine[] = [];

  for (const row of rows.slice(1)) {
    const codigo = (row[0] ?? '').trim();
    if (!codigo) continue;

    // Caso especial: línea de contingencia "(+) CONTINGENCIA (030)"
    // o similar al final de la hoja
    const contMatch = codigo.match(/^\(\+\)\s*(.+?)\s*\((\d{3})\)$/);
    if (contMatch) {
      const [, label, codeNum] = contMatch;
      const totalRaw = (row[8] ?? row[6] ?? '').trim();
      const monto = parseMonto(totalRaw);
      if (monto > 0) {
        const name = label.toUpperCase().trim();
        result.push({
          codigo: codeNum,
          descripcion: name,
          categoria: name,
          subcuenta: '',
          presupuesto: monto,
        });
      }
      continue;
    }

    // Líneas normales: requieren código de 3 niveles tipo "XXX-XX..."
    if (!codigo.match(/^\d{3}-\d{2}/)) continue;

    // Preferimos Total c/Fringe (col I); si no existe, caemos al Subtotal (col G)
    const totalCFringeRaw = (row[8] ?? '').trim();
    const subtotalRaw = (row[6] ?? '').trim();
    const useTotal =
      totalCFringeRaw && totalCFringeRaw !== '-' ? totalCFringeRaw : subtotalRaw;
    if (!useTotal || useTotal === '-') continue;

    const presupuesto = parseMonto(useTotal);
    if (presupuesto === 0) continue;

    const categoria = (row[3] ?? '').trim();
    const subcuenta = (row[4] ?? '').trim();
    const descripcion = (row[5] ?? '').trim();
    result.push({ codigo, descripcion, categoria, subcuenta, presupuesto });
  }

  return result;
}

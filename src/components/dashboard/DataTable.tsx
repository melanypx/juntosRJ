'use client';

import { useMemo, useState } from 'react';
import type { SheetRow, UserRole } from '@/lib/types';
import { exportToCSV } from '@/lib/export-csv';

interface Props {
  rows: SheetRow[];
  role: UserRole;
}

interface Column {
  key: keyof SheetRow;
  label: string;
}

function formatCLP(n: number) {
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });
}

// Todas las columnas — mismas vistas para admin y viewer; los viewers solo
// ven las filas que coincidan con su línea presupuestaria (filtrado server-side).
const ALL_COLUMNS: Column[] = [
  { key: 'estado',              label: 'Estado' },
  { key: 'lineaPresupuestaria', label: 'Línea' },
  { key: 'mes',                 label: 'Mes' },
  { key: 'proyecto',            label: 'Proyecto' },
  { key: 'nroOC',               label: 'OC' },
  { key: 'proveedor',           label: 'Proveedor' },
  { key: 'monto',               label: 'Monto' },
  { key: 'descripcion',         label: 'Descripción' },
  { key: 'tipoDocumento',       label: 'Tipo doc.' },
  { key: 'nroDocumento',        label: 'Nro doc.' },
  { key: 'fechaFactura',        label: 'Fecha factura' },
  { key: 'linkOC',              label: 'Link OC' },
  { key: 'linkFactura',         label: 'Link factura' },
  { key: 'linkPago',            label: 'Link pago' },
];

const PAGE_SIZE = 20;

// Los estados en el Sheet pueden variar — coloreamos por keyword.
// IMPORTANTE: "POR PAGAR" NO debe ser verde (todavía no se paga).
function estadoBadge(estado: string) {
  const lower = estado.toLowerCase().trim();
  let cls = 'bg-gray-100 text-gray-600';
  if (lower.startsWith('pag')) cls = 'bg-green-100 text-green-700';
  else if (lower.includes('por pag') || lower.includes('pend') || lower.includes('solic'))
    cls = 'bg-amber-100 text-amber-700';
  else if (lower.includes('rechaz') || lower.includes('cancel'))
    cls = 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {estado}
    </span>
  );
}

function cellContent(row: SheetRow, key: keyof SheetRow) {
  const value = row[key];

  if (key === 'monto') return formatCLP(row.monto);

  if (key === 'estado') return estadoBadge(row.estado);

  if (typeof value === 'string' && value.startsWith('http')) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        Ver
      </a>
    );
  }

  return String(value ?? '');
}

/**
 * Renderiza el contenido de una celda PARENT (fila agrupada por OC).
 * Para el monto muestra la SUMA; para la línea muestra "N líneas" si difieren;
 * para el resto toma el primer valor (que típicamente es el mismo en todas las
 * filas de la misma OC).
 */
function parentCellContent(group: OCGroup, key: keyof SheetRow) {
  if (key === 'monto') {
    return <span className="font-semibold">{formatCLP(group.totalMonto)}</span>;
  }
  if (key === 'lineaPresupuestaria' && group.lineas.size > 1) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          {group.lineas.size} líneas
        </span>
      </span>
    );
  }
  return cellContent(group.rows[0], key);
}

interface OCGroup {
  key: string;             // identificador único de la agrupación
  nroOC: string;
  rows: SheetRow[];
  totalMonto: number;
  lineas: Set<string>;
  isMultiple: boolean;
}

function groupByOC(rows: SheetRow[]): OCGroup[] {
  const map = new Map<string, SheetRow[]>();
  const sinOC: SheetRow[] = [];

  for (const row of rows) {
    const oc = (row.nroOC ?? '').trim();
    if (!oc) {
      sinOC.push(row);
      continue;
    }
    if (!map.has(oc)) map.set(oc, []);
    map.get(oc)!.push(row);
  }

  const groups: OCGroup[] = [];
  let idx = 0;
  for (const [nroOC, ocRows] of Array.from(map.entries())) {
    const total = ocRows.reduce((s, r) => s + r.monto, 0);
    const lineas = new Set(ocRows.map((r) => r.lineaPresupuestaria).filter(Boolean));
    groups.push({
      key: `oc-${nroOC}`,
      nroOC,
      rows: ocRows,
      totalMonto: total,
      lineas,
      isMultiple: ocRows.length > 1,
    });
  }
  // Filas sin nro de OC → cada una como grupo individual
  for (const row of sinOC) {
    groups.push({
      key: `nooc-${idx++}`,
      nroOC: '',
      rows: [row],
      totalMonto: row.monto,
      lineas: new Set([row.lineaPresupuestaria].filter(Boolean)),
      isMultiple: false,
    });
  }

  return groups;
}

export default function DataTable({ rows, role }: Props) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // `role` se mantiene en la firma por compatibilidad pero ya no afecta columnas.
  void role;
  const columns = ALL_COLUMNS;

  // Filtra por texto antes de agrupar — busca en todos los campos relevantes
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.nroOC,
        r.proveedor,
        r.descripcion,
        r.proyecto,
        r.lineaPresupuestaria,
        r.estado,
        r.mes,
        r.nroDocumento,
        r.tipoDocumento,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const groups = useMemo(() => groupByOC(searched), [searched]);

  const totalPages = Math.ceil(groups.length / PAGE_SIZE);
  // Si cambia el filtro y la página queda fuera de rango, vuelve a la 0
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleGroups = groups.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 whitespace-nowrap">Detalle de OCs</h2>
          {/* Buscador */}
          <div className="relative flex-1 sm:w-72 sm:flex-initial">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Buscar por OC, proveedor, descripción…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {groups.length} OCs · {searched.length} líneas
            {search && rows.length !== searched.length && (
              <span className="text-gray-300"> · de {rows.length}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              const stamp = new Date().toISOString().slice(0, 10);
              exportToCSV(
                searched,
                columns.map((c) => ({
                  key: c.key,
                  label: c.label,
                  format: (v, row) => {
                    if (c.key === 'monto') return row.monto;
                    return v as string | number;
                  },
                })),
                `ocs-${stamp}.csv`
              );
            }}
            disabled={searched.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium
                       hover:bg-blue-700 transition-colors disabled:opacity-40
                       disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="w-8 px-2" />
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-gray-500 font-medium whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleGroups.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-center py-12 text-gray-400"
                >
                  Sin registros para los filtros seleccionados
                </td>
              </tr>
            ) : (
              visibleGroups.map((group) => {
                const isOpen = expanded.has(group.key);
                const canExpand = group.isMultiple;

                return (
                  <>
                    {/* Fila padre (agrupada o única) */}
                    <tr
                      key={group.key}
                      className={`border-b border-gray-50 transition-colors ${
                        canExpand
                          ? 'bg-purple-50/30 hover:bg-purple-50 cursor-pointer'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => canExpand && toggle(group.key)}
                    >
                      <td className="w-8 px-2 text-gray-400 text-center">
                        {canExpand ? (isOpen ? '▾' : '▸') : ''}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-xs truncate"
                        >
                          {canExpand
                            ? parentCellContent(group, col.key)
                            : cellContent(group.rows[0], col.key)}
                        </td>
                      ))}
                    </tr>

                    {/* Filas hijas (cuando está expandido) */}
                    {canExpand &&
                      isOpen &&
                      group.rows.map((row, i) => (
                        <tr
                          key={`${group.key}-child-${i}`}
                          className="border-b border-gray-50 bg-gray-50/50"
                        >
                          <td className="w-8 px-2" />
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-2.5 text-gray-600 whitespace-nowrap max-w-xs truncate"
                              style={
                                col.key === 'estado' || col.key === 'lineaPresupuestaria'
                                  ? { paddingLeft: '2rem' }
                                  : undefined
                              }
                            >
                              {cellContent(row, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                       hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {safePage + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                       hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
        Las OCs con el mismo número se muestran agrupadas (badge violeta). Click en
        la fila para ver el desglose por línea.
      </p>
    </div>
  );
}

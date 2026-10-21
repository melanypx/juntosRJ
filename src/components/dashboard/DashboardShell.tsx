'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import type { SheetRow, UserRole } from '@/lib/types';
import KPICards from './KPICards';
import DataTable from './DataTable';
import Charts from './Charts';
import BudgetBreakdown from './BudgetBreakdown';

interface Props {
  userEmail: string;
  role: UserRole;
  lineaFiltro?: string;
}

const REFRESH_MS = 5 * 60 * 1000;
const FORM_NUEVA_OC =
  'https://docs.google.com/forms/d/e/1FAIpQLSelhrE-dWg6pGl6JEG0d3Oh_OweNfpu8aGxa9j1cZDhYcPYUQ/viewform';

type Tab = 'resumen' | 'presupuesto' | 'ocs';

export default function DashboardShell({ userEmail, role, lineaFiltro }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');

  // Filtros activos
  const [filterEstado, setFilterEstado] = useState('');
  const [filterLinea, setFilterLinea] = useState(lineaFiltro ?? '');
  const [filterMes, setFilterMes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/sheets');
      if (!res.ok) throw new Error('Respuesta no OK');
      const data: SheetRow[] = await res.json();
      setRows(data);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('No se pudieron cargar los datos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Opciones únicas para cada filtro.
  // Para la línea presupuestaria solo mostramos hasta el segundo nivel (ej.
  // "007-01") — el tercer nivel (007-01-01) no es necesario en el dropdown.
  const toMidLevel = (code: string) => {
    const parts = code.split('-');
    return parts.length <= 2 ? code : parts.slice(0, 2).join('-');
  };

  const estados = Array.from(new Set(rows.map((r) => r.estado).filter(Boolean))).sort();
  const lineas = Array.from(
    new Set(rows.map((r) => toMidLevel(r.lineaPresupuestaria)).filter(Boolean))
  ).sort();
  const meses = Array.from(new Set(rows.map((r) => r.mes).filter(Boolean)));

  // Filas filtradas. Para la línea hacemos match por prefijo de modo que
  // seleccionar "007-01" muestre 007-01, 007-01-01, 007-01-02, etc.
  const filtered = rows.filter((r) => {
    if (filterEstado && r.estado !== filterEstado) return false;
    if (
      filterLinea &&
      r.lineaPresupuestaria !== filterLinea &&
      !r.lineaPresupuestaria.startsWith(filterLinea + '-')
    )
      return false;
    if (filterMes && r.mes !== filterMes) return false;
    return true;
  });

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'resumen',     label: 'Resumen',     icon: '📊' },
    { key: 'presupuesto', label: 'Presupuesto', icon: '💰' },
    { key: 'ocs',         label: 'Detalle OCs', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard Operativo — Reina Japonesa</h1>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-0.5">
                Actualizado: {lastUpdated.toLocaleTimeString('es-CL')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={FORM_NUEVA_OC}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium
                         hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva OC
            </a>
            <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                role === 'admin'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {role}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-1 border-b border-gray-200 -mb-4">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="mr-1.5">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 text-sm flex items-center justify-between">
            {error}
            <button onClick={fetchData} className="underline ml-4 shrink-0">
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-24 text-gray-400 text-sm">
            Cargando datos desde Google Sheets…
          </div>
        ) : (
          <>
            {/* KPIs siempre visibles arriba */}
            <KPICards rows={filtered} />

            {/* Filtros siempre visibles */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Filtros
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Estado</label>
                  <select
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    {estados.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Línea presupuestaria
                  </label>
                  <select
                    value={filterLinea}
                    onChange={(e) => setFilterLinea(e.target.value)}
                    disabled={role === 'viewer' && !!lineaFiltro}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Todas</option>
                    {lineas.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mes</label>
                  <select
                    value={filterMes}
                    onChange={(e) => setFilterMes(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    {meses.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contenido de pestaña */}
            {tab === 'resumen' && <Charts rows={filtered} />}
            {tab === 'presupuesto' && <BudgetBreakdown rows={filtered} />}
            {tab === 'ocs' && <DataTable rows={filtered} role={role} />}
          </>
        )}
      </main>
    </div>
  );
}

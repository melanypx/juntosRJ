'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { SheetRow } from '@/lib/types';

interface Props {
  rows: SheetRow[];
}

function formatM(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function isPagada(estado: string): boolean {
  // Solo cuenta como pagada si empieza con "pag" (excluye "POR PAGAR")
  return estado?.toLowerCase().trim().startsWith('pag');
}

export default function Charts({ rows }: Props) {
  // Agrupa por mes y separa solicitado vs pagado
  const map = new Map<string, { mes: string; solicitado: number; pagado: number }>();
  for (const r of rows) {
    if (!r.mes) continue;
    if (!map.has(r.mes)) {
      map.set(r.mes, { mes: r.mes, solicitado: 0, pagado: 0 });
    }
    const entry = map.get(r.mes)!;
    entry.solicitado += r.monto;
    if (isPagada(r.estado)) entry.pagado += r.monto;
  }
  const byMes = Array.from(map.values());

  const totalSolicitado = byMes.reduce((s, m) => s + m.solicitado, 0);
  const totalPagado = byMes.reduce((s, m) => s + m.pagado, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Solicitado vs Pagado por mes
        </h2>
        <div className="text-xs text-gray-400 flex gap-4">
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500 mr-1.5 align-middle" />
            Solicitado:{' '}
            <span className="font-medium text-gray-700">{formatM(totalSolicitado)}</span>
          </span>
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-1.5 align-middle" />
            Pagado:{' '}
            <span className="font-medium text-gray-700">{formatM(totalPagado)}</span>
          </span>
        </div>
      </div>
      {byMes.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMes} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatM} tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              formatter={(v: number, name: string) => [
                formatM(v),
                name === 'solicitado' ? 'Solicitado' : 'Pagado',
              ]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => (v === 'solicitado' ? 'Solicitado' : 'Pagado')}
            />
            <Bar dataKey="solicitado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pagado" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

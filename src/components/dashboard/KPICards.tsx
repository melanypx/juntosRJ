import type { SheetRow } from '@/lib/types';

interface Props {
  rows: SheetRow[];
}

function formatCLP(n: number) {
  return n.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });
}

function isPagada(estado: string): boolean {
  // Solo cuenta como pagada si empieza con "pag" (PAGADA, PAGADO).
  // Excluye explícitamente "POR PAGAR" — esa OC todavía no se paga.
  return estado?.toLowerCase().trim().startsWith('pag');
}

export default function KPICards({ rows }: Props) {
  const totalSolicitado = rows.reduce((acc, r) => acc + r.monto, 0);
  const totalPagado = rows
    .filter((r) => isPagada(r.estado))
    .reduce((acc, r) => acc + r.monto, 0);
  const totalPendiente = totalSolicitado - totalPagado;
  const totalOCs = rows.length;
  const countPagadas = rows.filter((r) => isPagada(r.estado)).length;

  const cards = [
    {
      label: 'Monto solicitado',
      value: formatCLP(totalSolicitado),
      sub: `${totalOCs} OCs`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Monto pagado',
      value: formatCLP(totalPagado),
      sub: `${countPagadas} OCs`,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Pendiente de pago',
      value: formatCLP(totalPendiente),
      sub: `${totalOCs - countPagadas} OCs`,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '% Pagado',
      value:
        totalSolicitado > 0
          ? `${((totalPagado / totalSolicitado) * 100).toFixed(1)}%`
          : '—',
      sub: 'del solicitado',
      color: 'text-gray-700',
      bg: 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} rounded-xl border border-gray-200 p-5`}
        >
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color} leading-tight`}>
            {card.value}
          </p>
          <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

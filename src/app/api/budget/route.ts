import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getBudgetData } from '@/lib/sheets';
import type { UserMetadata } from '@/lib/types';

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const meta = (user.user_metadata ?? {}) as UserMetadata;
  const role = meta.role ?? 'viewer';
  const raw = meta.linea_presupuestaria;
  const lineas: string[] = Array.isArray(raw)
    ? raw.map((l) => l.trim()).filter(Boolean)
    : raw
    ? [raw.trim()].filter(Boolean)
    : [];

  try {
    const data = await getBudgetData();

    let filtered = data;
    if (role !== 'admin') {
      if (lineas.length === 0) {
        filtered = [];
      } else {
        filtered = data.filter((b) =>
          lineas.some((l) => b.codigo === l || b.codigo.startsWith(l + '-'))
        );
      }
    }

    // Mapa de nombres de categoría (top-level) y sub-cuenta (mid-level)
    // construido SIN filtrar para que el viewer vea "PROPERTIES" en 010
    // aunque solo tenga acceso a la sub-línea 010-03.
    // Son solo nombres, no montos, así que no expone datos sensibles.
    const categoryNames: Record<string, string> = {};
    const subcuentaNames: Record<string, string> = {};
    for (const b of data) {
      const top = b.codigo.split('-')[0];
      const mid = b.codigo.split('-').slice(0, 2).join('-');
      if (b.categoria && !categoryNames[top]) categoryNames[top] = b.categoria;
      if (b.subcuenta && !subcuentaNames[mid]) subcuentaNames[mid] = b.subcuenta;
    }

    return NextResponse.json(
      {
        budget: filtered,
        categoryNames,
        subcuentaNames,
        // Para que el front pueda crear nodos vacíos por las líneas asignadas
        // (ej: 012-03 que Caro tiene pero no tiene OCs ni presupuesto)
        assignedLines: role === 'admin' ? [] : lineas,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (err) {
    console.error('[budget] Error al leer PRESUPUESTO:', err);
    return NextResponse.json(
      { error: 'Error al leer el presupuesto' },
      { status: 500 }
    );
  }
}

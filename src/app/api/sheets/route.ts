import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getSheetData } from '@/lib/sheets';
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
    const data = await getSheetData();

    // Admin: ve todo. Viewer: solo sus líneas (o nada si no tiene asignadas).
    let filtered = data;
    if (role !== 'admin') {
      if (lineas.length === 0) {
        filtered = []; // viewer sin líneas → no ve nada
      } else {
        filtered = data.filter((row) =>
          lineas.some(
            (l) =>
              row.lineaPresupuestaria === l ||
              row.lineaPresupuestaria.startsWith(l + '-')
          )
        );
      }
    }

    return NextResponse.json(filtered, {
      headers: {
        // Cache PRIVADO (no compartido entre usuarios). Sin esto, el CDN
        // podría servir la respuesta filtrada de un usuario a otro distinto.
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sheets] Error al leer el Sheet:', err);
    return NextResponse.json(
      { error: 'Error al leer el Google Sheet', detail: msg },
      { status: 500 }
    );
  }
}

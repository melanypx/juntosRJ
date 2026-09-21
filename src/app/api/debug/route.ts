import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getSheetHeaders } from '@/lib/sheets';

// Ruta temporal de diagnóstico — muestra los encabezados del Sheet con su índice.
// Solo accesible para admins. Borrar después de verificar el mapeo de columnas.
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const headers = await getSheetHeaders();
  const indexed = headers.map((h, i) => ({
    index: i,
    columna: String.fromCharCode(65 + i), // A, B, C…
    encabezado: h,
  }));

  return NextResponse.json(indexed);
}

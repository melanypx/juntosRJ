import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import DashboardShell from '@/components/dashboard/DashboardShell';
import type { UserMetadata } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const meta = (user.user_metadata ?? {}) as UserMetadata;
  const role = meta.role ?? 'viewer';
  // Solo prellena/bloquea el filtro si hay UNA sola línea asignada.
  // Si hay varias, el filtro queda libre dentro de las que tiene acceso.
  const linea = typeof meta.linea_presupuestaria === 'string'
    ? meta.linea_presupuestaria
    : undefined;

  return (
    <DashboardShell
      userEmail={user.email!}
      role={role}
      lineaFiltro={linea}
    />
  );
}

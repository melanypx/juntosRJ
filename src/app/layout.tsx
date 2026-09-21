import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reina Japonesa — Dashboard Operativo',
  description: 'Seguimiento de órdenes de compra y ejecución presupuestaria — Reina Japonesa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}

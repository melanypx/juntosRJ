# Dashboard Operativo

Dashboard web independiente que lee datos desde Google Sheets con autenticación por roles.

**Stack:** Next.js 14 · Tailwind CSS · Recharts · Supabase Auth · Google Sheets API · Vercel

---

## 1. Pre-requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Acceso a [Google Cloud Console](https://console.cloud.google.com) para crear la service account

---

## 2. Configurar Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com)
2. Ve a **Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 3. Configurar Google Sheets API

### Crear la service account

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) con cualquier cuenta Google
2. **Select project → New project** → ponle nombre → **Create**
3. Menú lateral: **APIs & Services → Library** → busca `Google Sheets API` → **Enable**
4. Menú lateral: **APIs & Services → Credentials** → **+ Create Credentials → Service account**
   - Nombre: `dashboard-reader` → haz clic en **Done**
5. Haz clic en la service account creada → pestaña **Keys** → **Add Key → Create new key → JSON** → descarga el archivo

### Compartir el Google Sheet

Abre el JSON descargado y copia el valor del campo `"client_email"` (algo como `dashboard-reader@mi-proyecto.iam.gserviceaccount.com`).

Abre tu Google Sheet → botón **Compartir** → pega ese email → permiso **Viewer** → **Enviar**.

### Preparar el JSON para la variable de entorno

El JSON debe ir **en una sola línea** en el archivo `.env.local`. Puedes convertirlo así en la terminal:

```bash
cat tu-service-account.json | tr -d '\n'
```

Copia el resultado como valor de `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## 4. Variables de entorno

```bash
cp .env.example .env.local
```

Completa los 5 valores en `.env.local`. El `GOOGLE_SHEET_ID` es la parte de la URL del Sheet entre `/d/` y `/edit`:

```
https://docs.google.com/spreadsheets/d/AQUI_VA_EL_ID/edit
```

---

## 5. Ejecutar en desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 6. Gestión de usuarios

Los usuarios se crean desde el panel de Supabase:

1. **Authentication → Users → Invite user** → escribe el email
2. El usuario recibirá un email para establecer su contraseña
3. Para asignar rol: haz clic en el usuario → campo **User Metadata** → edita el JSON:

**Admin** (ve todo):
```json
{ "role": "admin" }
```

**Viewer** con línea específica:
```json
{ "role": "viewer", "linea_presupuestaria": "001-01" }
```

> Un viewer sin `linea_presupuestaria` verá todas las líneas pero solo las columnas básicas.

---

## 7. Deploy en Vercel

1. Sube el código a GitHub (`git init`, `git add .`, `git commit`, `git push`)
2. Ve a [vercel.com](https://vercel.com) → **Add New Project** → importa el repositorio
3. En **Environment Variables** agrega las mismas 5 variables de `.env.local`
4. Haz clic en **Deploy**

Los deploys futuros son automáticos con cada push a `main`.

---

## 8. Estructura del proyecto

```
src/
├── middleware.ts              # Protección de rutas (redirige a /login si no autenticado)
├── app/
│   ├── api/sheets/route.ts   # Lee Google Sheets y devuelve JSON (requiere auth)
│   ├── dashboard/page.tsx    # Página principal (Server Component, verifica sesión)
│   └── login/page.tsx        # Página de inicio de sesión
├── components/
│   ├── auth/LoginForm.tsx    # Formulario email + contraseña
│   └── dashboard/
│       ├── DashboardShell.tsx # Shell cliente: filtros, refresh automático, logout
│       ├── KPICards.tsx       # 4 tarjetas de resumen
│       ├── Charts.tsx         # Gráfico de barras por mes
│       ├── BudgetBreakdown.tsx# Barras de progreso por línea presupuestaria
│       └── DataTable.tsx      # Tabla paginada con columnas según rol
└── lib/
    ├── sheets.ts              # Llama a Google Sheets API con service account
    ├── supabase-browser.ts    # Cliente Supabase para componentes cliente
    ├── supabase-server.ts     # Cliente Supabase para Server Components / API routes
    └── types.ts               # Tipos TypeScript compartidos
```

---

## 9. Ajustar columnas del Sheet

Si el Sheet cambia de estructura, edita `src/lib/sheets.ts`: el array en `rows.slice(1).map(...)` mapea cada posición del array a un campo tipado. El índice `[0]` es la columna A, `[1]` es la columna B, etc.

Para agregar columnas visibles en la tabla, edita `VIEWER_COLUMNS` o `ADMIN_EXTRA_COLUMNS` en `src/components/dashboard/DataTable.tsx`.

# Sistema Integrado de Gestión Judicial — SIGJ

Portal judicial ficticio y demostrativo construido con Next.js 15, TypeScript, Tailwind CSS, shadcn/ui y Supabase. Incluye portal público, panel institucional, autenticación, roles, RLS, storage, auditoría, radicación automática y datos académicos de muestra.

> **Aviso:** este proyecto no corresponde a una autoridad judicial real ni produce efectos jurídicos. Usa el emblema institucional proporcionado por el propietario del proyecto únicamente con fines visuales de demostración. No cargue información personal ni documentos reales.

## Funcionalidad incluida

- Portal público: consulta por radicado, comunicados, audiencias, estados y biblioteca de providencias.
- Panel interno: dashboard, expedientes, actuaciones, providencias Markdown, agenda, estados, usuarios, dependencias, auditoría y configuración.
- Radicación con validación Zod, dos números únicos, actuación inicial, auditoría, anexo en Storage y constancia imprimible.
- Supabase Auth con email/contraseña, recuperación, cambio de contraseña y cierre de sesión.
- Roles: `SUPER_ADMIN`, `PRESIDENCIA_TRIBUNAL`, `MAGISTRADO`, `JUEZ_CIRCUITO`, `SECRETARIA`, `RELATORIA`, `GOBERNACION` y `CONSULTA`.
- RLS en todas las tablas, vistas públicas de campos limitados y políticas de Storage.
- Bloqueo automático de publicación para expedientes reservados/confidenciales y modo solo lectura al archivar.
- Datos de demostración realistas, sin funcionarios ni contraseñas reales.

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Supabase CLI (para migraciones locales o remotas)
- Un proyecto Supabase para persistencia y autenticación

## Instalación local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Si las variables de Supabase están vacías, SIGJ funciona en **modo demostración navegable** con datos locales; el formulario de acceso lleva al panel sin validar credenciales. Este modo es solo para evaluación visual y nunca debe habilitarse como despliegue productivo.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://SU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=clave_anon_publica
SUPABASE_SERVICE_ROLE_KEY=clave_service_role_solo_servidor
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` nunca se importa en componentes cliente. Se reserva para futuras rutas administrativas de invitación ejecutadas exclusivamente en servidor.

## Configurar Supabase

1. Cree un proyecto vacío en Supabase.
2. Vincule el repositorio:

   ```bash
   npx supabase login
   npx supabase link --project-ref SU_PROJECT_REF
   npx supabase db push
   ```

3. La migración `supabase/migrations/202606190001_initial_sigj.sql` crea tablas, índices, vistas, funciones, triggers, RLS, buckets y seed data.
4. En **Authentication → URL Configuration**, establezca:
   - Site URL: el valor de `NEXT_PUBLIC_APP_URL`.
   - Redirect URL local: `http://localhost:3000/actualizar-password`.
   - Redirect URL de producción: `https://su-dominio/actualizar-password`.
5. Mantenga deshabilitado el registro público. Cree usuarios mediante invitación administrativa.

Para un entorno local completo también puede usar:

```bash
npx supabase start
npx supabase db reset
```

## Crear usuarios y asignar roles

No hay contraseñas en el repositorio. En **Supabase Dashboard → Authentication → Users**, invite al usuario con su correo. El trigger `handle_new_auth_user` crea automáticamente un perfil `CONSULTA`, el rol de menor privilegio.

Para crear el primer `SUPER_ADMIN`, ejecute una sola vez en SQL Editor con el UUID del usuario ya invitado:

```sql
update public.profiles
set role = 'SUPER_ADMIN', full_name = 'Administración SIGJ', is_active = true
where id = 'UUID-DEL-USUARIO';
```

Después, use el módulo **Usuarios** para asignar perfiles. Mientras se implementa el envío de invitaciones desde la interfaz, puede actualizar roles desde SQL Editor:

```sql
update public.profiles
set role = 'MAGISTRADO', dependency_id = (
  select id from public.dependencies where code = 'SP'
)
where email = 'usuario@dominio.example';
```

El trigger `guard_profile_privileges` impide que usuarios ordinarios eleven su propio rol, cambien su dependencia o se reactiven.

## Seguridad y acceso público

- `src/middleware.ts` valida sesión y perfil activo antes de cualquier ruta `/admin/*` cuando Supabase está configurado.
- El cliente anónimo no tiene acceso directo a `cases`, `case_parties`, `documents`, `case_actions` ni `hearings`.
- Las vistas `public_case_lookup`, `public_case_actions` y `public_hearings` exponen solo columnas aprobadas.
- `case-documents` y `providence-files` son privados; `public-notices` solo admite imágenes públicas.
- La función `guard_case_security` fuerza `public_visibility = false` para niveles Reservado y Confidencial.
- `audit_logs` solo puede ser consultada por `SUPER_ADMIN`.
- `GOBERNACION` puede leer asuntos administrativos, pero las políticas le impiden modificar expedientes judiciales.

## Numeración

- Interna: `TSJ-[SALA]-[AÑO]-[000000]`, por ejemplo `TSJ-SP-2026-000001`.
- Judicial simulada: `11001-31-03-[DESPACHO]-[AÑO]-[00000]-00`.

Las funciones usan bloqueos transaccionales (`pg_advisory_xact_lock`) para evitar consecutivos duplicados en radicaciones simultáneas.

## Comandos

```bash
npm run dev       # desarrollo con Turbopack
npm run lint      # ESLint
npm run typecheck # comprobación TypeScript
npm run build     # compilación de producción
npm start         # ejecutar compilación
```

## Despliegue en Vercel

1. Importe el repositorio en Vercel.
2. Configure las cuatro variables de entorno para Production y Preview.
3. Cambie `NEXT_PUBLIC_APP_URL` al dominio final.
4. Añada la URL de recuperación en Supabase Authentication.
5. Ejecute `npm run build` localmente antes de desplegar.
6. Despliegue y verifique `/`, `/consulta`, `/login` y `/admin/dashboard` con un usuario autorizado.

## Estructura principal

```text
src/app/(public)       portal público
src/app/(auth)         acceso y recuperación
src/app/admin          panel institucional
src/app/actions        acciones de servidor validadas
src/components         componentes reutilizables
src/lib/supabase       clientes SSR/navegador
supabase/migrations    esquema, RLS, Storage y seed
```

## Alcance demostrativo

Las pantallas ofrecen flujos completos y componentes preparados para Supabase. Algunos botones secundarios de edición/cancelación se presentan como controles de interfaz para extender con acciones de servidor según el proceso particular de cada institución ficticia. Antes de cualquier uso distinto a demostración, realice una revisión de seguridad, privacidad, accesibilidad y retención documental independiente.

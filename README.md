# Palacio Judicial — Sistema Integral de Gestión Judicial (SIGJ)

Aplicación multiinstitucional construida con Next.js 15, TypeScript, Tailwind CSS, shadcn/ui y Supabase. Integra flujos de una corte suprema, un tribunal superior, juzgados, salas especializadas, secretarías, radicación, reparto y archivo.

> Proyecto académico de referencia. No cargue datos personales, expedientes ni documentos reales.

## Alcance funcional

- Portal público limitado a consulta por radicado, providencias publicadas, estados, audiencias, comunicados e instituciones.
- Flujo: entrada y radicación, validación, reparto, asignación, avocamiento, instrucción, pruebas, traslados, estados, audiencias, providencias, notificaciones, constancias y archivo.
- Corte Suprema, Tribunal Superior, Juzgados de Circuito, Juzgados Municipales, salas Civil, Penal, Laboral, Familia y Constitucional/Tutelas.
- Secretaría General, Oficina de Radicación, Oficina de Reparto y Archivo Judicial.
- Despacho del Gobernador como entidad externa limitada a comunicaciones; no tiene funciones judiciales ni acceso a expedientes.
- Autenticación Supabase, RLS, Storage privado, auditoría y propietario protegido.
- Gestión interna de usuarios en `/admin/usuarios`, invitaciones en `/admin/usuarios/nuevo` y matriz en `/admin/roles`.

## Seguridad del propietario y los usuarios

- Solo el perfil `SUPER_ADMIN` marcado con `is_owner = true` administra usuarios.
- Un `SUPER_ADMIN` ordinario no hereda automáticamente la propiedad.
- El propietario no puede eliminarse, desactivarse, degradarse ni reasignarse de institución.
- La creación/invitación ocurre en una Server Action. `SUPABASE_SERVICE_ROLE_KEY` solo se importa desde un módulo `server-only`.
- Usuarios, correos, perfiles, roles, auditoría y asignaciones institucionales no tienen políticas públicas de lectura.
- Los administradores institucionales no pueden listar usuarios ni modificar al propietario.
- Cada invitación, cambio de rol, activación/desactivación, cambio institucional y recuperación de contraseña registra actor, objetivo, fecha y valores anterior/nuevo.
- El panel `/admin` no tiene bypass ni acceso alterno cuando Supabase está ausente.

## Requisitos

- Node.js 20+
- npm 10+
- Un proyecto Supabase vacío
- Supabase CLI

## Instalación local

```bash
npm install
cp .env.example .env.local
npm run dev
```

El portal público y el panel interno consultan Supabase. Sin variables válidas se muestra un estado vacío o un error controlado; no se simulan mutaciones.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_o_publishable_key
SUPABASE_SERVICE_ROLE_KEY=service_role_key_privada
NEXT_PUBLIC_APP_URL=https://palaciodejusticia.fyi
OWNER_EMAIL=owner@example.com
```

`OWNER_EMAIL` debe contener el correo privado real solo en `.env.local` y en Vercel. No lo escriba en archivos versionados. Es una variable exclusiva del servidor y **nunca** debe llevar el prefijo `NEXT_PUBLIC_`.

`SUPABASE_SERVICE_ROLE_KEY` también es secreta y exclusiva del servidor. No la use en componentes cliente, capturas, respuestas públicas o logs.

## Configurar Supabase

1. Cree un proyecto vacío en Supabase.
2. Desde la raíz del repositorio ejecute:

   ```bash
   npx supabase login
   npx supabase link --project-ref PROJECT_REF
   npx supabase db push --dry-run
   npx supabase db push
   ```

3. Las migraciones crean el sistema en orden. `202606190001_initial_sigj.sql` contiene el esquema base; `202606190002_functional_admin.sql` añade los flujos administrativos; y las migraciones `003` a `007` completan branding, ciclo de vida auditado, compartición temporal, normalización de documentos, compatibilidad de Storage con los identificadores históricos y validación de destinos internos.
   - `profiles`, roles y permisos;
   - instituciones/cortes/oficinas (`dependencies`);
   - `cases`, `radications`, `case_actions`, `proceedings`, `hearings`, `notifications`, `documents` y `certificates`;
   - vistas públicas de columnas limitadas;
   - archivo/restauración, borrado permanente exclusivo del propietario y auditoría de intentos fallidos;
   - compartición interna por usuario, rol o dependencia con vencimiento;
   - auditoría, funciones, triggers, RLS y buckets privados de Storage;
   - el trigger `handle_new_auth_user`, que crea un perfil mínimo por cada usuario de Supabase Auth.
4. En **Authentication → URL Configuration** establezca:
   - Site URL: `https://palaciodejusticia.fyi`
   - Redirect URL: `https://palaciodejusticia.fyi/auth/callback**`
   - Redirect URL local: `http://localhost:3000/auth/callback**`
   - Para previews de Vercel, agregue únicamente los dominios de preview que vaya a utilizar o un patrón controlado de su equipo.
5. Mantenga deshabilitado el registro público. Después del propietario, cree cuentas únicamente desde `/admin/usuarios/nuevo`.

## Create the owner account

Primero cree o invite al usuario en **Supabase Dashboard → Authentication → Users**. El trigger creará su fila en `public.profiles`.

### Opción A — SQL por correo

En **Supabase SQL Editor**, ejecute con el correo privado real:

```sql
select public.bootstrap_system_owner(
  'owner@example.com',
  'Lilith D''Amico'
);
```

La función es idempotente para la misma cuenta y rechaza transferir la propiedad si ya existe otro propietario. El archivo de ayuda es `supabase/scripts/create_owner.sql`.

### Opción B — variable privada `OWNER_EMAIL`

Configure el correo real en `.env.local` sin versionarlo:

```env
OWNER_EMAIL=owner@example.com
```

Luego ejecute:

```bash
npm run owner:bootstrap
```

Este script usa `SUPABASE_SERVICE_ROLE_KEY` solo en Node.js, llama a la función de bootstrap y no envía el correo al navegador.

Después de crear el propietario, ingrese en `/login`. Desde `/admin/usuarios` puede invitar usuarios, asignar rol e institución, activar/desactivar cuentas y enviar enlaces para configurar la contraseña. No existe una página pública de bootstrap.

## Solucionar `relation "public.profiles" does not exist`

Ese error significa que la migración no se aplicó al proyecto Supabase vinculado.

1. Confirme el proyecto con `npx supabase projects list` y vuelva a ejecutar `npx supabase link --project-ref PROJECT_REF`.
2. Compruebe el plan con `npx supabase db push --dry-run`.
3. Ejecute `npx supabase db push`.
4. En SQL Editor verifique:

   ```sql
   select to_regclass('public.profiles');
   ```

   El resultado debe ser `public.profiles`.

Si Supabase afirma que la migración ya fue aplicada pero el proyecto está vacío y la tabla no existe, revise primero **Database → Migrations**. Solo en un proyecto nuevo/sin datos repare el historial y vuelva a aplicar:

```bash
npx supabase migration repair --status reverted 202606190001
npx supabase db push
```

No use esa reparación sobre una base con datos reales sin una copia de seguridad y revisión previa.

## Despliegue en Vercel

1. Importe `0xSaltyy/sigj-judicial-system` en Vercel como proyecto Next.js; Root Directory `./`.
2. Añada las cinco variables anteriores en **Settings → Environment Variables** para Production y Preview.
3. Use exactamente `NEXT_PUBLIC_APP_URL=https://palaciodejusticia.fyi`.
4. Vincule `palaciodejusticia.fyi` en **Settings → Domains**.
5. Ejecute `npx supabase db push --dry-run` y `npx supabase db push`; después configure las URLs de Auth antes de invitar usuarios.
6. Despliegue y valide `/`, `/instituciones`, `/consulta`, `/login` y, con el propietario, `/admin/usuarios`.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run owner:bootstrap
```

## Estructura

```text
src/app/(public)       portal público sin datos internos
src/app/(auth)         acceso y recuperación
src/app/admin          panel privado
src/app/actions        mutaciones reautorizadas en servidor
src/lib/auth           autorización de sesión y propietario
src/lib/supabase       clientes SSR y service-role server-only
supabase/migrations    esquema completo, RLS y Storage
supabase/scripts       ayuda de bootstrap por correo
scripts                bootstrap privado mediante OWNER_EMAIL
```

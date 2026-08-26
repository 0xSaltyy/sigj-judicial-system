# Department of Justice Roleplay Portal

Aplicación web ficticia de roleplay inspirada estructuralmente en portales institucionales como Justice.gov, pero sin copiar contenido oficial ni presentarse como entidad gubernamental real.

> ROLEPLAY WEBSITE — This website is fictional and is not affiliated with the real United States Department of Justice.
>
> Developed by: kcobainn

## Incluye

- Portal público en español con cabecera institucional, buscador, navegación responsive, centro de acciones, comunicados, postulaciones, providencias, expedientes públicos, audiencias, warrants y recursos.
- Panel interno protegido para expedientes, actuaciones, providencias, audiencias, comunicados, usuarios, dependencias, auditoría y configuración.
- Supabase Auth, RLS, Storage privado/público, auditoría y migraciones SQL.
- Extensión DOJ Roleplay para postulaciones, warrants, permisos personalizados y realtime.
- Indicadores de conexión, animaciones discretas, skeleton-ready UI y soporte `prefers-reduced-motion`.
- Generación real de PDF básico para expedientes públicos en `/api/roleplay/cases/[id]/pdf`.

## Aviso legal de roleplay

Este repositorio no es una página oficial del Gobierno de Estados Unidos, no está afiliado al U.S. Department of Justice real y ningún expediente, warrant, providencia, cargo o documento produce efectos jurídicos reales.

El footer debe conservar exactamente:

```text
ROLEPLAY WEBSITE — This website is fictional and is not affiliated with the real United States Department of Justice.
Developed by: kcobainn
```

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Supabase CLI
- Proyecto Supabase para persistencia, autenticación, storage y realtime

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://SU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=clave_anon_publica
SUPABASE_SERVICE_ROLE_KEY=clave_service_role_solo_servidor
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` es solo servidor. Nunca use el prefijo `NEXT_PUBLIC_` para esa clave.

## Configurar base de datos

```bash
npx supabase login
npx supabase link --project-ref SU_PROJECT_REF
npx supabase db push
```

Migraciones incluidas:

- `202606190001_initial_sigj.sql`: esquema base con perfiles, expedientes, actuaciones, providencias, audiencias, usuarios, auditoría, RLS y buckets.
- `202608250001_doj_roleplay_extensions.sql`: roles DOJ Roleplay, postulaciones, warrants, permisos personalizados, ajustes OWNER/Attorney General y realtime.

## Configurar realtime

La migración nueva añade a `supabase_realtime` tablas clave:

- `public_notices`
- `cases`
- `case_actions`
- `proceedings`
- `hearings`
- `roleplay_warrants`
- `roleplay_applications`
- `audit_logs`

En Supabase Dashboard confirme que Realtime esté habilitado para el proyecto. La interfaz muestra estado “En línea”, “Reconectando” o “Sin conexión”.

## Crear primera cuenta OWNER

1. Deshabilite registro público en Supabase Auth.
2. Cree/invite manualmente el primer usuario desde Supabase Dashboard.
3. Ejecute:

```sql
update public.profiles
set role = 'OWNER',
    full_name = 'Attorney General Roleplay',
    position_title = 'Attorney General',
    is_active = true
where email = 'owner@example.com';
```

El OWNER / Attorney General tiene acceso absoluto. Las demás cuentas deben crearse desde flujo administrativo o Supabase Auth; no incluya contraseñas demo en el repositorio.

## Configurar almacenamiento

La migración base crea:

- `case-documents` privado
- `providence-files` privado
- `public-notices` público para imágenes de comunicados

Guarde warrants, expedientes reservados y anexos internos en buckets privados y sirva archivos mediante rutas de servidor con verificación de permisos.

## Seguridad

- No hay registro público.
- Las rutas `/admin/*` se protegen con middleware y Supabase Auth.
- Las políticas RLS limitan lectura/escritura por rol.
- Las vistas públicas no exponen notas internas, identificadores sensibles, partes reservadas ni documentos privados.
- Los warrants descargables deben llevar: `ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.`
- Las acciones sensibles se registran en `audit_logs`.

Antes de producción realice pruebas adicionales de rate limiting, sesiones, revocación, CSRF/XSS y retención documental.

## Despliegue

1. Importe el repositorio en Vercel.
2. Configure variables de entorno en Production y Preview.
3. Configure en Supabase Auth:
   - Site URL: `NEXT_PUBLIC_APP_URL`
   - Redirect URLs de login/recuperación.
4. Ejecute migraciones con `npx supabase db push`.
5. Despliegue.
6. Verifique `/`, `/login`, `/admin/dashboard`, `/expedientes-publicos`, `/warrants` y descarga PDF.

## Backups

- Active backups automáticos en Supabase.
- Exporte SQL periódicamente:

```bash
npx supabase db dump --file backups/backup.sql
```

- Resguarde Storage privado según política de la comunidad.
- Mantenga rotación de `SUPABASE_SERVICE_ROLE_KEY` si se sospecha exposición.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

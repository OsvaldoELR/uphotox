# Panel de superadmin (plataforma)

Para ver qué hace cada estudio y, más adelante, decidir a qué tiene acceso.
Decidido el 20 oct 2026, cuando un segundo estudio está a punto de empezar.

## Idea principal: una capa aparte, sin tocar la seguridad de los estudios

- El superadmin **no es miembro de ningún estudio** y ninguna regla de
  seguridad (RLS) lo menciona. Las reglas que separan un estudio de otro se
  quedan exactamente como estaban.
- Quién es superadmin lo dice la tabla `platform_admins` (solo la lee el
  servidor con la clave de servicio; desde el navegador es invisible).
- Las páginas de `/admin` comprueban esa tabla (`requirePlatformAdmin()` en
  `apps/app/lib/platform.ts`) y después leen con el cliente admin. A quien
  no es superadmin le dan 404.
- Se descartó añadir «o es superadmin» a cada regla de seguridad: habría que
  tocar todas las tablas y un error ahí deja ver datos de un estudio a otro.

## Fase 1 · Solo lectura (hecha, v0.8.0)

- Cuenta aparte, sin estudio: `osvaldo+admin@upgradixagency.com` (llega al
  mismo buzón). Al entrar va directo a `/admin`; nunca ve el alta de estudio.
- `/admin`: todos los estudios con equipo, tarjetas, clientes, galerías
  enviadas y elegidas, almacenamiento en R2, coste de IA del mes y última
  actividad; arriba, los totales de la plataforma.
- `/admin/estudios/<id>`: equipo (rol, permisos, último acceso), embudo de
  cada tablero, últimos 40 movimientos, galerías, consumo del Editor por
  mes y ajustes (WhatsApp, precio de foto extra, entrada de clientes).
- Los recuentos se hacen en SQL (`platform_studio_stats`,
  `platform_stage_counts`, `platform_studio_usage`; solo la clave de
  servicio puede llamarlas) porque la API de datos corta en 1000 filas.

### Dar o quitar acceso de superadmin

En Supabase → SQL Editor (no hay botón en la app a propósito):

```sql
-- Dar acceso (la persona ya tiene que tener cuenta)
insert into public.platform_admins (user_id)
select id from public.profiles where email = 'correo@ejemplo.com';

-- Quitar acceso
delete from public.platform_admins
where user_id = (select id from public.profiles where email = 'correo@ejemplo.com');
```

## Fase 2 · Decidir a qué tiene acceso cada estudio (pendiente)

- Columnas nuevas en `studios`, que el estudio no puede cambiar (los
  permisos de edición de `studios` van columna a columna y estas no se le
  dan):
  - `modules`: módulos que se pueden apagar, para empezar **Galerías** y
    **Editor**. Tableros, clientes, equipo y ajustes siempre activos.
  - Un tope mensual de IA que pone la plataforma, distinto del
    `editor_monthly_limit` que pone el propio estudio (manda el más bajo).
  - `suspended_at` para suspender un estudio, con su propia página de
    «cuenta suspendida» (si no, la app lo mandaría al alta de estudio).
- Un único cambio en `private.has_permission`: además del permiso del
  miembro, el módulo de ese permiso tiene que estar activo en su estudio.
  Todas las reglas de seguridad ya llaman a esa función, así que el bloqueo
  es real en la base de datos sin tocar ninguna regla.
- `getStudioContext()` quita los permisos de los módulos apagados: menú,
  404 de `requirePermission()` y botones se ajustan solos.
- Tres sitios no pasan por esa seguridad (usan la clave de servicio) y
  necesitan la comprobación a mano: la galería del cliente (`/g/<token>`),
  el webhook de la API y la cola y el callback del Editor.
- La migración deja todo activado por defecto: ningún estudio nota nada.
- Registro de cada cambio hecho desde el panel (qué, a qué estudio, cuándo).

## Fase 3 · Si hace falta

- Verificación en dos pasos (TOTP de Supabase) obligatoria para la cuenta
  superadmin, porque ve los datos de todos.
- «Entrar como el estudio» para dar soporte (lo más delicado; mejor ver en
  solo lectura mientras se pueda).

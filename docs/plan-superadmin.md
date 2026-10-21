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

## Fase 2 · Decidir a qué tiene acceso cada estudio (hecha, v0.9.0)

En la ficha de cada estudio (`/admin/estudios/<id>`), sección **Acceso**:

- **Módulos**: Galerías y Editor se pueden apagar. Tableros, clientes, equipo
  y ajustes siempre están. Apagado: desaparece del menú, sus páginas dan 404,
  Equipo oculta sus permisos (sin borrarlos: vuelven al activarlo) y la base
  de datos lo bloquea. Con Galerías apagadas, el enlace del cliente dice
  «Esta galería no está disponible» y los correos no llevan «Elegir mis
  fotos».
- **Tope de IA al mes**: lo pone Uphotox. Si el estudio tiene su propio
  límite en Ajustes, manda el más bajo; el estudio ve el tope en Ajustes y,
  al llegar, el aviso le dice que hable con Uphotox.
- **Pausar el estudio**, con un mensaje opcional: el equipo solo ve la página
  «Estudio pausado» (con el mensaje y «Cerrar sesión»), sus clientes no
  pueden abrir las galerías y el formulario de reservas (webhook) responde
  «El estudio está pausado» y lo deja anotado. No se borra nada.
- **Registro** debajo del formulario: qué cambió, quién y cuándo.

Cómo funciona por dentro:
- Columnas `studios.modules`, `editor_platform_limit`, `suspended_at`,
  `suspended_reason`. El estudio puede leerlas pero no cambiarlas.
- `private.has_permission` exige además un estudio activo y el módulo del
  permiso encendido. Todas las reglas de seguridad ya la usan, así que el
  bloqueo es real en la base de datos sin tocar ninguna regla.
- Los cambios pasan solo por `platform_set_studio_access`, que actualiza el
  estudio y apunta el cambio en `platform_audit` en la misma transacción.
- Lo que usa la clave de servicio (y por eso se salta esas reglas) lo
  comprueba a mano: galería del cliente y sus acciones, el enlace de los
  correos y el webhook. El Editor no lo necesita: la cola solo envía fotos
  que el miembro puede leer con sus permisos, y lo que ya estaba en marcha
  termina normalmente.
- Para añadir un módulo nuevo: prefijo de permisos nuevo, entrada en
  `MODULES` (`apps/app/lib/permissions.ts`), y añadirlo a la restricción de
  `studios.modules` y a la lista de `has_permission` en una migración.

## Fase 3 · Si hace falta

- Verificación en dos pasos (TOTP de Supabase) obligatoria para la cuenta
  superadmin, porque ve los datos de todos.
- «Entrar como el estudio» para dar soporte (lo más delicado; mejor ver en
  solo lectura mientras se pueda).

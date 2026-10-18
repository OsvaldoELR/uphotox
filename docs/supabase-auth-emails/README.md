# Correos de cuenta (Supabase Auth)

Supabase envía dos correos de cuenta: confirmar el registro y restablecer la
contraseña. Salen por el SMTP de Resend (`noreply@uphotox.com`, remitente
«Uphotox») y sus plantillas viven en la configuración de Supabase, no en el
código. Estos archivos son la copia de referencia de lo que está aplicado.

| Plantilla en Supabase | Asunto | Archivo |
| --- | --- | --- |
| Confirm signup | Confirma tu cuenta de Uphotox | `confirm-signup.html` |
| Reset password | Restablece tu contraseña de Uphotox | `reset-password.html` |

## Por qué el enlace va a `/auth/confirm`

El enlace por defecto (`{{ .ConfirmationURL }}`) termina en `/auth/callback`
con un código PKCE, y ese código solo se puede canjear en el mismo navegador
que pidió el correo. Al abrirlo en otro (el móvil, la app de Gmail, el
navegador interno de una app) fallaba con «Ese enlace no es válido o ha
caducado». Le pasó a un usuario real el 15 de octubre de 2026.

Las plantillas usan
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=…`.
La ruta `apps/app/app/auth/confirm` (`handleAuthConfirm` en
`packages/auth/routes.ts`) verifica el token en el servidor, así que funciona
desde cualquier dispositivo. El token caduca en 1 hora y solo sirve una vez.

- Confirmar registro: `type=email&next=/` (sin estudio, la app lleva a
  `/onboarding`).
- Restablecer contraseña: `type=recovery&next=/update-password`.

`{{ .SiteURL }}` es la dirección publicada (https://uphotox-app.vercel.app),
también para las cuentas creadas en local. Para probar en local, cambia el
dominio del enlace por `http://localhost:3000`.

## Cómo cambiarlas

En Supabase → Authentication → Emails → Templates, pega el HTML y el asunto.
También se puede hacer con la Management API
(`PATCH /v1/projects/cdkosqookglkyrjazmho/config/auth`, campos
`mailer_subjects_confirmation`, `mailer_templates_confirmation_content`,
`mailer_subjects_recovery`, `mailer_templates_recovery_content`). Después de
cambiarlas, crea una cuenta de prueba con `delivered+algo@resend.dev`: si la
plantilla tiene un error, el registro falla con «Error sending confirmation
email».

Mantén `{{ .TokenHash }}` y la ruta `/auth/confirm`. Si se vuelve a
`{{ .ConfirmationURL }}`, los enlaces dejan de funcionar en otro navegador.

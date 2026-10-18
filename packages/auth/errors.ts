/**
 * Supabase Auth answers in English ("Invalid login credentials", "For security
 * purposes, you can only request this after 50 seconds."). The forms show
 * these Spanish messages instead, matched by error code.
 */

export const ALREADY_REGISTERED =
  "Ese correo ya tiene una cuenta. Entra con tu contraseña o usa «¿Olvidaste tu contraseña?» si no la recuerdas.";

const WAIT_SECONDS = /after (\d+) seconds?/i;

interface AuthErrorLike {
  readonly code?: string;
  readonly message: string;
  readonly name?: string;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials:
    "Correo o contraseña incorrectos. Si no la recuerdas, usa «¿Olvidaste tu contraseña?».",
  email_not_confirmed:
    "Todavía no confirmaste tu correo. Abre el enlace del correo que te enviamos al crear la cuenta (revisa también la carpeta de spam).",
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  same_password: "La contraseña nueva tiene que ser distinta de la anterior.",
  weak_password:
    "Esa contraseña es demasiado fácil. Usa al menos 8 caracteres mezclando letras y números.",
  email_address_invalid: "Ese correo no es válido.",
  signup_disabled: "Ahora mismo no se pueden crear cuentas nuevas.",
  over_request_rate_limit:
    "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.",
  session_not_found:
    "Tu enlace caducó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».",
  session_expired:
    "Tu enlace caducó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».",
};

export const authErrorMessage = (error: AuthErrorLike): string => {
  if (error.code === "over_email_send_rate_limit") {
    const seconds = WAIT_SECONDS.exec(error.message)?.[1];
    return seconds
      ? `Por seguridad, espera ${seconds} segundos antes de pedir otro correo.`
      : "Se enviaron demasiados correos seguidos. Espera unos minutos y vuelve a probar.";
  }

  const known = error.code ? MESSAGES[error.code] : undefined;

  if (known) {
    return known;
  }

  // Changing the password after the link's session is gone.
  if (error.name === "AuthSessionMissingError") {
    return MESSAGES.session_not_found as string;
  }

  return "Algo salió mal. Vuelve a intentarlo en unos minutos.";
};

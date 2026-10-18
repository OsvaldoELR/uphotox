import { ALREADY_REGISTERED, authErrorMessage } from "@repo/auth/errors";
import { describe, expect, test } from "vitest";

describe("authErrorMessage", () => {
  test("wrong password", () => {
    expect(
      authErrorMessage({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      })
    ).toContain("Correo o contraseña incorrectos");
  });

  test("email rate limit keeps the seconds to wait", () => {
    expect(
      authErrorMessage({
        code: "over_email_send_rate_limit",
        message:
          "For security purposes, you can only request this after 50 seconds.",
      })
    ).toBe("Por seguridad, espera 50 segundos antes de pedir otro correo.");
  });

  test("email rate limit without seconds", () => {
    expect(
      authErrorMessage({
        code: "over_email_send_rate_limit",
        message: "Email rate limit exceeded",
      })
    ).toContain("Espera unos minutos");
  });

  test("existing account", () => {
    expect(
      authErrorMessage({ code: "user_already_exists", message: "x" })
    ).toBe(ALREADY_REGISTERED);
  });

  test("password change without the link's session", () => {
    expect(
      authErrorMessage({
        message: "Auth session missing!",
        name: "AuthSessionMissingError",
      })
    ).toContain("Tu enlace caducó");
  });

  test("unknown errors never show English", () => {
    expect(
      authErrorMessage({ code: "something_new", message: "Database error" })
    ).toBe("Algo salió mal. Vuelve a intentarlo en unos minutos.");
  });
});

import { describe, expect, test } from "vitest";
import {
  countOf,
  describeActivity,
  formatBytes,
  formatMonth,
  monthsAgo,
  timeAgo,
} from "@/lib/platform-format";

const now = new Date("2026-10-20T12:00:00Z");

describe("timeAgo", () => {
  test("counts minutes, hours and days", () => {
    expect(timeAgo("2026-10-20T11:59:30Z", now)).toBe("ahora");
    expect(timeAgo("2026-10-20T11:15:00Z", now)).toBe("hace 45 min");
    expect(timeAgo("2026-10-20T02:00:00Z", now)).toBe("hace 10 h");
    expect(timeAgo("2026-10-17T12:00:00Z", now)).toBe("hace 3 d");
  });

  test("shows the date after a month and a dash when there is none", () => {
    expect(timeAgo("2026-08-02T10:00:00Z", now)).toBe("2 ago 2026");
    expect(timeAgo(null, now)).toBe("—");
  });
});

describe("formatBytes", () => {
  test("picks the unit and uses a decimal comma", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(780_034)).toBe("762 KB");
    expect(formatBytes(5_400_000)).toBe("5,1 MB");
    expect(formatBytes(97_333_234)).toBe("92,8 MB");
    expect(formatBytes(250 * 1024 ** 3)).toBe("250 GB");
  });
});

describe("countOf", () => {
  test("agrees in number", () => {
    expect(countOf(1, "enviada")).toBe("1 enviada");
    expect(countOf(6, "enviada")).toBe("6 enviadas");
    expect(countOf(0, "tarjeta")).toBe("0 tarjetas");
    expect(countOf(2, "permiso")).toBe("2 permisos");
  });
});

describe("months", () => {
  test("goes back whole UTC months, across the year", () => {
    expect(monthsAgo(0, now)).toBe("2026-10-01T00:00:00.000Z");
    expect(monthsAgo(11, now)).toBe("2025-11-01T00:00:00.000Z");
  });

  test("names the month in Spanish", () => {
    expect(formatMonth("2026-10-01T00:00:00Z")).toBe("octubre de 2026");
  });
});

describe("describeActivity", () => {
  const base = {
    actor: "Eliza",
    card: "Sofía · Smash Cake",
    detail: null,
    from: "Agendado",
    to: "Editando",
  };

  test("names who did what to which card", () => {
    expect(describeActivity({ ...base, kind: "moved" })).toBe(
      "Eliza movió «Sofía · Smash Cake» de Agendado a Editando"
    );
    expect(describeActivity({ ...base, kind: "created" })).toBe(
      "Eliza creó «Sofía · Smash Cake» en Editando"
    );
  });

  test("system moves and client steps have no actor", () => {
    expect(describeActivity({ ...base, actor: null, kind: "moved" })).toBe(
      "«Sofía · Smash Cake» pasó de Agendado a Editando"
    );
    expect(describeActivity({ ...base, actor: null, kind: "created" })).toBe(
      "«Sofía · Smash Cake» llegó por la entrada de clientes a Editando"
    );
    expect(
      describeActivity({
        ...base,
        actor: null,
        detail: "14 fotos (2 extras)",
        kind: "gallery_submitted",
      })
    ).toBe(
      "El cliente de «Sofía · Smash Cake» confirmó su selección · 14 fotos (2 extras)"
    );
  });

  test("survives a deleted card", () => {
    expect(
      describeActivity({ ...base, card: null, kind: "gallery_sent" })
    ).toBe("Eliza envió la galería de «tarjeta borrada»");
  });
});

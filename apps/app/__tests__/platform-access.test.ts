import { describe, expect, test } from "vitest";
import { limitReachedMessage, spendingLimit } from "@/lib/editor";
import {
  ALL_PERMISSIONS,
  moduleAvailable,
  moduleOf,
  toModules,
  withModules,
} from "@/lib/permissions";
import { accessNotes, describeAccessChange } from "@/lib/platform-format";

describe("modules", () => {
  test("a permission belongs to the module of its prefix", () => {
    expect(moduleOf("galleries.view")).toBe("galleries");
    expect(moduleOf("editor.access")).toBe("editor");
    expect(moduleOf("boards.view")).toBeNull();
    expect(moduleOf("settings.manage")).toBeNull();
  });

  test("drops only the permissions of modules that are off", () => {
    const kept = withModules(ALL_PERMISSIONS, ["editor"]);
    expect(kept).not.toContain("galleries.view");
    expect(kept).not.toContain("galleries.manage");
    expect(kept).toContain("editor.access");
    expect(kept).toContain("boards.view");
    expect(kept).toContain("team.manage");
    expect(withModules(ALL_PERMISSIONS, [])).toHaveLength(
      ALL_PERMISSIONS.length - 3
    );
  });

  test("stored modules are cleaned and kept in catalog order", () => {
    expect(toModules(["editor", "galleries", "payments"])).toEqual([
      "galleries",
      "editor",
    ]);
    expect(toModules(null)).toEqual([]);
  });

  test("service-role code sees a module only when it is on and not paused", () => {
    const studio = { modules: ["galleries"], suspended_at: null };
    expect(moduleAvailable(studio, "galleries")).toBe(true);
    expect(moduleAvailable(studio, "editor")).toBe(false);
    expect(
      moduleAvailable(
        { ...studio, suspended_at: "2026-10-20T00:00:00Z" },
        "galleries"
      )
    ).toBe(false);
    expect(moduleAvailable(null, "galleries")).toBe(false);
  });
});

describe("spendingLimit", () => {
  test("the lower of the studio's limit and the platform cap applies", () => {
    expect(spendingLimit(null, null)).toEqual({
      limit: null,
      byPlatform: false,
    });
    expect(spendingLimit(50, null)).toEqual({ limit: 50, byPlatform: false });
    expect(spendingLimit(null, 20)).toEqual({ limit: 20, byPlatform: true });
    expect(spendingLimit(50, 20)).toEqual({ limit: 20, byPlatform: true });
    expect(spendingLimit(10, 20)).toEqual({ limit: 10, byPlatform: false });
    expect(spendingLimit("20.00", "20")).toEqual({
      limit: 20,
      byPlatform: false,
    });
  });

  test("tells the studio who can raise it", () => {
    expect(limitReachedMessage(20, true)).toContain("tope de IA de tu plan");
    expect(limitReachedMessage(20, false)).toContain("Ajustes → Editor");
  });
});

describe("describeAccessChange", () => {
  const active = {
    modules: ["galleries", "editor"],
    editor_platform_limit: null,
    suspended_at: null,
    suspended_reason: null,
  };

  test("one line per change", () => {
    expect(
      describeAccessChange(active, {
        ...active,
        modules: ["galleries"],
        editor_platform_limit: 20,
      })
    ).toEqual(["Editor de imágenes: apagado", "Tope de IA: sin tope → $20.00"]);
  });

  test("pause, message and reactivation", () => {
    const paused = {
      ...active,
      suspended_at: "2026-10-20T10:00:00Z",
      suspended_reason: "Prueba terminada",
    };
    expect(describeAccessChange(active, paused)).toEqual([
      "Estudio pausado · «Prueba terminada»",
    ]);
    expect(
      describeAccessChange(paused, { ...paused, suspended_reason: "Otra" })
    ).toEqual(["Mensaje de la pausa cambiado · «Otra»"]);
    expect(describeAccessChange(paused, active)).toEqual([
      "Estudio reactivado",
    ]);
  });

  test("numbers stored as text compare by value", () => {
    expect(
      describeAccessChange(
        { ...active, editor_platform_limit: "20.00" },
        { ...active, editor_platform_limit: 20 }
      )
    ).toEqual([]);
  });
});

describe("accessNotes", () => {
  test("nothing to say when everything is on", () => {
    expect(
      accessNotes({ modules: ["galleries", "editor"], suspended_at: null })
    ).toEqual([]);
  });

  test("pause first, then what is missing and the cap", () => {
    expect(
      accessNotes({
        modules: ["galleries"],
        editor_platform_limit: 15,
        suspended_at: "2026-10-20T10:00:00Z",
      }).map((note) => note.label)
    ).toEqual(["Pausado", "Sin Editor", "Tope IA $15.00"]);
  });
});

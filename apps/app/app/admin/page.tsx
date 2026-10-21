import { HudLabel } from "@repo/design-system/components/hud/hud-label";
import type { Metadata } from "next";
import Link from "next/link";
import { formatCost, monthStart } from "@/lib/editor";
import { requirePlatformAdmin } from "@/lib/platform";
import {
  countOf,
  formatBytes,
  formatDay,
  timeAgo,
} from "@/lib/platform-format";
import { Header } from "../(authenticated)/components/header";

export const metadata: Metadata = {
  title: "Estudios · Superadmin · Uphotox",
  description: "Todos los estudios de la plataforma, su uso y su consumo.",
};

const Stat = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="flex flex-col gap-1 bg-card px-4 py-3">
    <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
      {label}
    </dt>
    <dd className="font-black font-mono text-xl tabular-nums">{value}</dd>
  </div>
);

const th =
  "whitespace-nowrap px-4 py-2.5 text-left font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.2em]";
const td = "whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums";

const AdminPage = async () => {
  const { admin } = await requirePlatformAdmin();
  const [{ data: studios }, { data: stats }] = await Promise.all([
    admin
      .from("studios")
      .select(
        "id, name, created_at, owner:profiles!studios_owner_id_fkey(full_name, email)"
      )
      .order("created_at"),
    admin.rpc("platform_studio_stats", { since: monthStart() }),
  ]);

  const byStudio = new Map((stats ?? []).map((row) => [row.studio_id, row]));
  const rows = (studios ?? []).map((studio) => ({
    ...studio,
    stats: byStudio.get(studio.id),
  }));
  const total = (key: "members" | "ai_cost_since" | "storage_bytes") =>
    (stats ?? []).reduce((sum, row) => sum + Number(row[key]), 0);

  return (
    <>
      <Header page="Estudios" />
      <div className="flex flex-1 flex-col gap-10 px-4 pt-4 pb-12 md:px-10">
        <section className="flex flex-col gap-4">
          <HudLabel align="start">Superadmin</HudLabel>
          <div className="grid gap-1">
            <h1 className="font-black font-mono text-3xl uppercase tracking-[-0.02em] md:text-4xl">
              Estudios
            </h1>
            <p className="max-w-prose text-muted-foreground text-sm">
              Todos los estudios de Uphotox, lo que tienen dentro y lo que
              consumen. Solo lectura: aquí no se cambia nada de ningún estudio.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
            <Stat label="Estudios" value={String(rows.length)} />
            <Stat label="Usuarios" value={String(total("members"))} />
            <Stat
              label="IA este mes"
              value={formatCost(total("ai_cost_since"))}
            />
            <Stat
              label="Fotos en galerías"
              value={formatBytes(total("storage_bytes"))}
            />
          </dl>
        </section>

        <section className="grid gap-3">
          {rows.length === 0 ? (
            <p className="border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
              Todavía no hay ningún estudio.
            </p>
          ) : (
            <div className="overflow-x-auto border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className={th}>Estudio</th>
                    <th className={th}>Equipo</th>
                    <th className={th}>Tarjetas</th>
                    <th className={th}>Clientes</th>
                    <th className={th}>Galerías</th>
                    <th className={th}>Almacenamiento</th>
                    <th className={th}>IA este mes</th>
                    <th className={th}>Última actividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((studio) => (
                    <tr className="hover:bg-accent/60" key={studio.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="font-medium hover:text-signal-ink hover:underline"
                          href={`/admin/estudios/${studio.id}`}
                        >
                          {studio.name}
                        </Link>
                        <p className="whitespace-nowrap text-muted-foreground text-xs">
                          {studio.owner?.email ?? "Sin dueño"} · desde{" "}
                          {formatDay(studio.created_at)}
                        </p>
                      </td>
                      <td className={td}>{studio.stats?.members ?? 0}</td>
                      <td className={td}>{studio.stats?.cards ?? 0}</td>
                      <td className={td}>{studio.stats?.clients ?? 0}</td>
                      <td className={td}>
                        {countOf(studio.stats?.galleries_sent ?? 0, "enviada")}{" "}
                        ·{" "}
                        {countOf(
                          studio.stats?.galleries_submitted ?? 0,
                          "elegida"
                        )}
                      </td>
                      <td className={td}>
                        {formatBytes(Number(studio.stats?.storage_bytes ?? 0))}
                      </td>
                      <td className={td}>
                        {formatCost(Number(studio.stats?.ai_cost_since ?? 0))}
                      </td>
                      <td className={td}>
                        {timeAgo(studio.stats?.last_activity ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            La actividad cuenta movimientos de tarjetas, galerías y el Editor.
            El almacenamiento son las fotos de galerías que siguen en Cloudflare
            R2 (sin las del Editor).
          </p>
        </section>
      </div>
    </>
  );
};

export default AdminPage;

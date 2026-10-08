"use client";

import { Panel } from "@repo/design-system/components/hud/panel";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronRightIcon,
  FileUpIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeText, phoneDigits } from "@/lib/client-import";
import { formatShortDate } from "@/lib/session-date";
import { ClientSheet } from "./client-sheet";
import type { ClientListItem, ClientSession, ClientsAccess } from "./types";

type SortMode = "upcoming" | "recent" | "name";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "upcoming", label: "Próxima sesión" },
  { id: "recent", label: "Recientes" },
  { id: "name", label: "A–Z" },
];

const NAME_SEPARATORS = /[\s@._-]+/;
const LETTER = /\p{L}/u;

// First letter of each word, skipping symbols: "Ana (ya existía)" → "AY".
const initials = (name: string) =>
  name
    .split(NAME_SEPARATORS)
    .map((part) => LETTER.exec(part)?.[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");

const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

/** Soonest session from today on, if any. */
const nextSession = (client: ClientListItem, from: number) =>
  client.sessions
    .filter(
      (session) => session.sessionAt && Date.parse(session.sessionAt) >= from
    )
    .sort((a, b) => (a.sessionAt ?? "").localeCompare(b.sessionAt ?? ""))[0];

const searchText = (client: ClientListItem) =>
  normalizeText(
    [
      client.fullName,
      client.email,
      ...client.sessions.map((session) => session.title),
    ].join(" ")
  );

const sortClients = (
  clients: ClientListItem[],
  mode: SortMode,
  from: number
) => {
  if (mode === "name") {
    return [...clients].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "es")
    );
  }

  if (mode === "recent") {
    return clients;
  }

  // Upcoming first (soonest on top), then everyone else by recency.
  const next = new Map(
    clients.map((client) => [client.id, nextSession(client, from)?.sessionAt])
  );
  return [...clients].sort((a, b) => {
    const aNext = next.get(a.id);
    const bNext = next.get(b.id);

    if (aNext && bNext) {
      return aNext.localeCompare(bNext);
    }

    return Number(Boolean(bNext)) - Number(Boolean(aNext));
  });
};

const SessionSummary = ({
  session,
  upcoming,
}: {
  readonly session: ClientSession | undefined;
  readonly upcoming: boolean;
}) => {
  if (!session) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
        Sin sesiones
      </span>
    );
  }

  return (
    <>
      <span className="max-w-full truncate text-sm">{session.title}</span>
      <span className="max-w-full truncate font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
        {session.sessionAt && (
          <span
            className={cn(upcoming && "font-bold text-foreground")}
            suppressHydrationWarning
          >
            {formatShortDate(session.sessionAt)} ·{" "}
          </span>
        )}
        <span className="text-signal-ink">{session.stageName}</span>
      </span>
    </>
  );
};

interface ClientListProperties {
  readonly access: ClientsAccess;
  readonly clients: ClientListItem[];
}

export const ClientList = ({ access, clients }: ClientListProperties) => {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("upcoming");
  const [openId, setOpenId] = useState<number | null>(null);
  const from = useMemo(todayStart, []);

  const indexed = useMemo(
    () =>
      clients.map((client) => ({
        client,
        text: searchText(client),
        digits: phoneDigits(client.phone ?? ""),
      })),
    [clients]
  );

  const visible = useMemo(() => {
    const words = normalizeText(query).split(" ").filter(Boolean);
    const digits = phoneDigits(query);
    const matches = indexed
      .filter(
        (entry) =>
          words.every((word) => entry.text.includes(word)) ||
          (digits.length >= 3 && entry.digits.includes(digits))
      )
      .map((entry) => entry.client);

    return sortClients(matches, sort, from);
  }, [indexed, query, sort, from]);

  const upcomingCount = useMemo(
    () => clients.filter((client) => nextSession(client, from)).length,
    [clients, from]
  );

  const openClient = clients.find((client) => client.id === openId) ?? null;

  if (clients.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
        <UsersIcon className="size-8 text-signal-ink/60" />
        <p className="font-bold font-mono text-xs uppercase tracking-[0.25em]">
          Todavía no hay clientes
        </p>
        <p className="max-w-sm text-muted-foreground text-sm">
          Importa los clientes que ya tienen su sesión agendada y aparecerán en
          el tablero, en la etapa que elijas.
        </p>
        {access.canImport && (
          <Button asChild className="mt-2">
            <Link href="/clientes/importar">
              <FileUpIcon />
              Importar CSV
            </Link>
          </Button>
        )}
      </Panel>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar clientes"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, teléfono, correo o niño/a…"
            type="search"
            value={query}
          />
        </div>
        {access.canImport && (
          <Button asChild variant="outline">
            <Link href="/clientes/importar">
              <FileUpIcon />
              Importar CSV
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((option) => (
          <button
            aria-pressed={sort === option.id}
            className={cn(
              "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
              sort === option.id
                ? "border-signal-ink/60 bg-signal/15 text-foreground"
                : "bg-secondary/80 text-muted-foreground hover:text-foreground"
            )}
            key={option.id}
            onClick={() => setSort(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <span
          className="ml-auto font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]"
          suppressHydrationWarning
        >
          <span className="tabular font-bold text-signal-ink">
            {String(upcomingCount).padStart(2, "0")}
          </span>{" "}
          con sesión próxima
        </span>
      </div>

      {visible.length > 0 ? (
        <ul className="divide-y border bg-card">
          {visible.map((client) => {
            const upcoming = nextSession(client, from);
            const featured = upcoming ?? client.sessions[0];
            const contact = [client.phone, client.email]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={client.id}>
                <button
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                  onClick={() => setOpenId(client.id)}
                  type="button"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/15 font-bold font-mono text-signal-ink text-xs">
                    {initials(client.fullName)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-sm">
                      {client.fullName}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {contact || "Sin datos de contacto"}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-col sm:hidden">
                      <SessionSummary
                        session={featured}
                        upcoming={Boolean(upcoming)}
                      />
                    </span>
                  </span>
                  <span className="hidden w-64 min-w-0 shrink-0 flex-col items-end gap-0.5 text-right sm:flex">
                    <SessionSummary
                      session={featured}
                      upcoming={Boolean(upcoming)}
                    />
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Panel className="px-6 py-10 text-center text-muted-foreground text-sm">
          Nadie coincide con «{query}».
        </Panel>
      )}

      {openClient && (
        <ClientSheet
          access={access}
          client={openClient}
          key={openClient.id}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
};

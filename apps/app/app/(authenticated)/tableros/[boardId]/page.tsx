import { createClient } from "@repo/database/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isEmailEnabled } from "@/lib/email";
import { requirePermission } from "@/lib/studio";
import { Header } from "../../components/header";
import { KanbanBoard } from "./components/kanban-board";
import type { BoardCard, BoardMember } from "./components/types";

export const metadata: Metadata = {
  title: "Tablero · Uphotox",
  description: "Flujo de trabajo del estudio.",
};

interface BoardPageProperties {
  readonly params: Promise<{ boardId: string }>;
}

const BoardPage = async ({ params }: BoardPageProperties) => {
  const context = await requirePermission("boards.view");
  const boardId = Number((await params).boardId);

  if (!Number.isSafeInteger(boardId) || boardId <= 0) {
    notFound();
  }

  const supabase = await createClient();
  const [board, stages, cards, members] = await Promise.all([
    supabase.from("boards").select("id, name").eq("id", boardId).maybeSingle(),
    supabase
      .from("board_stages")
      .select("id, name, position, notify_client, client_message")
      .eq("board_id", boardId)
      .order("position"),
    supabase
      .from("cards")
      .select(
        "id, title, stage_id, position, session_at, gallery_url, notes, assigned_to, stage_entered_at, cover_path, client:clients(id, full_name, email, phone)"
      )
      .eq("board_id", boardId)
      .order("position"),
    supabase
      .from("studio_members")
      .select("user_id, role, profiles(full_name, email)"),
  ]);

  // RLS hides boards from other studios, so this is also the access check.
  if (!board.data) {
    notFound();
  }

  // Covers live in a private bucket: one batch of short-lived signed URLs.
  const coverPaths = (cards.data ?? [])
    .map((card) => card.cover_path)
    .filter((path): path is string => Boolean(path));
  const { data: signed } = coverPaths.length
    ? await supabase.storage
        .from("card-covers")
        .createSignedUrls(coverPaths, 60 * 60)
    : { data: [] };
  const coverUrls = new Map(
    (signed ?? []).map((entry) => [entry.path, entry.signedUrl])
  );
  const boardCards: BoardCard[] = (cards.data ?? []).map((card) => ({
    ...card,
    cover_url: card.cover_path
      ? (coverUrls.get(card.cover_path) ?? null)
      : null,
  }));

  const boardMembers: BoardMember[] = (members.data ?? []).map((member) => ({
    id: member.user_id,
    role: member.role,
    name: member.profiles?.full_name ?? member.profiles?.email ?? "Sin nombre",
  }));

  return (
    <>
      <Header
        page={board.data.name}
        trail={[
          { label: "Panel", href: "/" },
          { label: "Tableros", href: "/tableros" },
        ]}
      />
      <KanbanBoard
        access={{
          canCreate: context.can("cards.create"),
          canEdit: context.can("cards.edit"),
          canMove: context.can("cards.move"),
          canDelete: context.can("cards.delete"),
          canManage: context.can("boards.manage"),
          onlyAssigned: context.member.onlyAssigned,
        }}
        boardId={boardId}
        boardName={board.data.name}
        cards={boardCards}
        emailEnabled={isEmailEnabled()}
        members={boardMembers}
        stages={stages.data ?? []}
        studioName={context.studio.name}
      />
    </>
  );
};

export default BoardPage;

import "server-only";

import type { createClient } from "@repo/database/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface BoardSummary {
  readonly id: number;
  readonly name: string;
  readonly stages: { id: number; name: string; count: number }[];
  readonly total: number;
}

/** Every visible board with its stages and how many cards sit in each. */
export const getBoardSummaries = async (
  supabase: ServerClient
): Promise<BoardSummary[]> => {
  const [{ data: boards }, { data: cards }] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name, board_stages(id, name, position)")
      .order("created_at"),
    supabase.from("cards").select("stage_id"),
  ]);

  const counts = new Map<number, number>();

  for (const card of cards ?? []) {
    counts.set(card.stage_id, (counts.get(card.stage_id) ?? 0) + 1);
  }

  return (boards ?? []).map((board) => {
    const stages = [...board.board_stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        count: counts.get(stage.id) ?? 0,
      }));

    return {
      id: board.id,
      name: board.name,
      stages,
      total: stages.reduce((sum, stage) => sum + stage.count, 0),
    };
  });
};

import "server-only";

import type { createClient } from "@repo/database/server";
import {
  BOARD_TEMPLATES,
  type BoardTemplateId,
  POSITION_STEP,
} from "./board-templates";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Creates a board and its stages as the signed-in user (RLS applies). */
export const createBoardFromTemplate = async (
  supabase: ServerClient,
  studioId: number,
  name: string,
  templateId: BoardTemplateId
) => {
  const { data: board, error } = await supabase
    .from("boards")
    .insert({ studio_id: studioId, name })
    .select("id")
    .single();

  if (error) {
    return { error: error.message } as const;
  }

  const stages = BOARD_TEMPLATES[templateId].stages.map((stage, index) => ({
    board_id: board.id,
    studio_id: studioId,
    name: stage.name,
    position: (index + 1) * POSITION_STEP,
    notify_client: stage.notifyClient,
    client_message: stage.message,
  }));

  const { error: stagesError } = await supabase
    .from("board_stages")
    .insert(stages);

  if (stagesError) {
    // Without stages the board is unusable; undo it.
    await supabase.from("boards").delete().eq("id", board.id);
    return { error: stagesError.message } as const;
  }

  return { boardId: board.id } as const;
};

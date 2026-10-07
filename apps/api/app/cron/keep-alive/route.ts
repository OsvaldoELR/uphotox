import { createAdminClient } from "@repo/database/admin";

// Free Supabase projects pause after a week without activity. A daily query
// (see vercel.json) keeps the database awake.
export const GET = async () => {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response("OK", { status: 200 });
};

import { supabaseAdmin as supabase } from "../../../lib/supabase";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return Response.json({ sessions: [], error: "profileId requis" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("session_summaries")
    .select("id, summary, session_date, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("sessions fetch error:", error);
    return Response.json({ sessions: [], error: error.message });
  }

  return Response.json({ sessions: data || [] });
}

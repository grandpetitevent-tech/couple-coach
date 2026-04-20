import { supabaseAdmin as supabase } from "../../../lib/supabase";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");

  const { data } = await supabase
    .from("progress_logs")
    .select("weight, logged_at")
    .eq("profile_id", profileId)
    .order("logged_at", { ascending: false })
    .limit(1);

  return Response.json({ weight: data?.[0]?.weight || null });
}

export async function POST(req) {
  const { profileId, weight, notes } = await req.json();

  const { error } = await supabase.from("progress_logs").insert({
    profile_id: profileId,
    weight,
    notes,
  });

  console.log("progress insert error:", error);

  return Response.json({ success: !error, error: error?.message });
}

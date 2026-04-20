import { supabaseAdmin as supabase } from "../../../lib/supabase";

export async function POST(req) {
  const { profileId, messages } = await req.json();

  const sessionText = (messages || []).map((m) => m.role + ": " + m.content).join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: `Résume cette session de coaching en JSON structuré UNIQUEMENT, 
sans texte autour, format exact :
{
  "date": "2026-04-20",
  "exercices_faits": ["nom exercice 1", "nom exercice 2"],
  "muscles_travailles": ["jambes", "dos", etc],
  "intensite": "faible/moyenne/forte",
  "poids_mentionne": 143,
  "objectifs_semaine": "3 séances",
  "notes_importantes": "genoux fragiles, préfère salle de sport",
  "prochaine_seance_recommandee": "haut du corps - repos jambes"
}

Session à résumer :
${sessionText}`,
        },
      ],
    }),
  });

  const data = await response.json();
  let summary = data?.content?.[0]?.text || "";
  const trimmed = summary.trim();
  if (trimmed.startsWith("```")) {
    summary = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }

  await supabase.from("session_summaries").insert({
    profile_id: profileId || "anonymous",
    summary,
  });

  return Response.json({ success: true, summary });
}

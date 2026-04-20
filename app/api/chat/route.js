import { detectExercise } from "../../../lib/detectExercise";
import { openai } from "../../../lib/openai";
import { supabaseAdmin as supabase } from "../../../lib/supabase";

export async function POST(req) {
  const { messages, system, profileId } = await req.json();
  const currentProfileId = profileId || "anonymous";

  const { data: summaries } = await supabase
    .from("session_summaries")
    .select("summary, session_date")
    .eq("profile_id", currentProfileId)
    .order("session_date", { ascending: false })
    .limit(5);

  const { data: weightHistory } = await supabase
    .from("progress_logs")
    .select("weight, logged_at")
    .eq("profile_id", currentProfileId)
    .order("logged_at", { ascending: false })
    .limit(10);

  const parsedSummaries = (summaries || []).map((s) => {
    try {
      let raw = (s.summary || "").trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      }
      return { ...JSON.parse(raw), session_date: s.session_date };
    } catch {
      return { session_date: s.session_date, notes_importantes: s.summary };
    }
  });

  const memoryContext = parsedSummaries?.length
    ? `
=== MÉMOIRE DU COACH ===
IMPORTANT - Adapte la séance d'aujourd'hui en fonction de cet historique :

${parsedSummaries
  .map(
    (s) => `
📅 Session du ${s.session_date} :
- Exercices faits : ${s.exercices_faits?.join(", ") || "non renseigné"}
- Muscles travaillés : ${s.muscles_travailles?.join(", ") || "non renseigné"}
- Intensité : ${s.intensite || "non renseigné"}
- Prochaine séance recommandée : ${s.prochaine_seance_recommandee || "non renseigné"}
- Notes : ${s.notes_importantes || ""}
`
  )
  .join("\n")}

Évolution du poids :
${
  weightHistory?.length
    ? weightHistory
        .map(
          (w) =>
            `- ${new Date(w.logged_at).toLocaleDateString("fr-FR")}: ${w.weight}kg`
        )
        .join("\n")
    : "Pas encore de données"
}

RÈGLE : Ne répète JAMAIS les mêmes groupes musculaires que la dernière session.
Si jambes faites hier → propose haut du corps aujourd'hui.

RÈGLE EXERCICES : Pour chaque exercice proposé dans la séance,
tu DOIS toujours inclure :
1. Le nom de l'exercice en gras
2. Muscles ciblés (ex: "Cible : quadriceps, fessiers")
3. Exécution en 3 étapes max (Position de départ → Mouvement → Point clé)
4. Erreurs courantes à éviter (1-2 max)
5. Variante plus facile si besoin

Format exact pour chaque exercice :
**[NOM EXERCICE]**
🎯 Cible : [muscles]
📋 Exécution :
1. [position départ]
2. [mouvement]
3. [point clé technique]
⚠️ Erreur à éviter : [erreur courante]
💡 Variante facile : [alternative]
========================
`
    : "";

  const fullSystem = memoryContext + system;

  console.log("summaries récupérés:", summaries);
  console.log("weightHistory récupéré:", weightHistory);
  console.log("memoryContext:", memoryContext);
  console.log("fullSystem commence par:", fullSystem.substring(0, 200));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: fullSystem,
      messages,
    }),
  });

  const data = await response.json();
  const coachText =
    data?.content?.map((b) => b?.text || "").join("\n").trim() || "Erreur.";

  console.log("coachText:", coachText);

  let imageUrl = null;
  const exerciseDetected = detectExercise(coachText);

  console.log("exerciseDetected:", exerciseDetected);

  if (exerciseDetected) {
    try {
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Clean minimalist schematic illustration of a fitness exercise: ${exerciseDetected}.
Style: simple line drawing, white background, anatomical clarity,
no text, black and white, instructional fitness diagram,
clear body posture visualization`,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const tempUrl = imageResponse?.data?.[0]?.url;

      console.log("tempUrl:", tempUrl);

      if (tempUrl) {
        const imageBlob = await fetch(tempUrl).then((r) => r.blob());
        const fileName = `exercises/${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("couple-coach-images")
          .upload(fileName, imageBlob, { contentType: "image/png" });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("couple-coach-images").getPublicUrl(fileName);

          imageUrl = publicUrl;
        }

        console.log("uploadError:", uploadError, "imageUrl:", imageUrl);
      }
    } catch (error) {
      console.error("Image generation failed:", error);
    }
  }

  try {
    await supabase.from("conversations").insert({
      profile_id: currentProfileId,
      role: "assistant",
      content: coachText,
      image_url: imageUrl,
      session_date: new Date().toISOString().slice(0, 10),
    });
  } catch (dbError) {
    console.error("Conversation insert failed:", dbError);
  }

  console.log("Final response:", { message: coachText, imageUrl });

  return Response.json({
    message: coachText,
    imageUrl,
  });
}

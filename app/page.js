"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const PROFILES = {
  wilson: {
    name: "Wilson",
    emoji: "⚡",
    poids: 144, taille: "1m96", age: 28,
    objectif: "Perte de poids", niveau: "Intermédiaire", materiel: "Mixte",
    imc: (144 / (1.96 * 1.96)).toFixed(1),
    color: "#ff6b00", bg: "linear-gradient(135deg, #ff6b00, #ff3d00)",
    coachName: "APEX",
    system: `Tu es APEX, coach sportif IA d'élite pour Wilson, 28 ans, 144kg, 1m96 (IMC: ${(144/(1.96*1.96)).toFixed(1)}), niveau intermédiaire, équipement mixte, 3 séances/semaine de 1h. Objectif : PERDRE DU POIDS durablement. Tiens compte du poids élevé (144kg) : privilégie les exercices à faible impact articulaire. Ton : direct, motivant, viril. Réponds en français avec des emojis. Sois concis mais complet.`,
    suggestions: ["Séance du jour 💪", "Plan hebdo complet", "Exercices faible impact", "Conseils nutrition", "Cardio brûle-graisses"],
    intro: (imc, poids = 144) =>
      `Yo Wilson ! 👊 Je suis **APEX**, ton coach IA.\n\nProfil chargé :\n• **${poids}kg / 1m96** — IMC ${imc}\n• Objectif : **Perte de poids** 🔥\n• **3 séances × 1h/semaine**\n\nPrêt à tout donner ? Par où on commence ?`,
  },
  oceane: {
    name: "Océane",
    emoji: "🌊",
    poids: 75, taille: "1m64", age: 24,
    objectif: "Perte de poids", niveau: "À définir", materiel: "Mixte",
    imc: (75 / (1.64 * 1.64)).toFixed(1),
    color: "#00b4d8", bg: "linear-gradient(135deg, #00b4d8, #0096c7)",
    coachName: "LUNA",
    system: `Tu es LUNA, coach sportif IA bienveillante pour Océane, 24 ans, 75kg, 1m64 (IMC: ${(75/(1.64*1.64)).toFixed(1)}), équipement mixte, objectif perte de poids. Adapte les séances à une femme jeune et active. Ton : encourageant, positif, bienveillant mais exigeant. Réponds en français avec des emojis. Sois concise mais complète.`,
    suggestions: ["Ma séance d'aujourd'hui 🌸", "Programme de la semaine", "Exercices ventre & hanches", "Conseils nutrition minceur", "Yoga + cardio doux"],
    intro: (imc) => `Bonjour Océane ! 🌊 Je suis **LUNA**, ta coach IA personnelle.\n\nTon profil :\n• **75kg / 1m64** — IMC ${imc}\n• Objectif : **Perte de poids** ✨\n• Équipement : **Mixte**\n\nOn va atteindre tes objectifs ensemble 💙 Par où tu veux commencer ?`,
  },
};

function fmt(t) {
  return t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

function sessionListLabel(s) {
  const raw = s.session_date || (s.created_at ? String(s.created_at).slice(0, 10) : "");
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("fr-FR");
}

function parseSessionSummaryJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function formatSummaryForChat(raw) {
  const obj = parseSessionSummaryJson(raw);
  if (!obj) return raw;
  const lines = [];
  if (obj.date) lines.push(`• **Date** : ${obj.date}`);
  if (Array.isArray(obj.exercices_faits) && obj.exercices_faits.length)
    lines.push(`• **Exercices faits** : ${obj.exercices_faits.join(", ")}`);
  if (Array.isArray(obj.muscles_travailles) && obj.muscles_travailles.length)
    lines.push(`• **Muscles travaillés** : ${obj.muscles_travailles.join(", ")}`);
  if (obj.intensite) lines.push(`• **Intensité** : ${obj.intensite}`);
  if (obj.poids_mentionne != null && obj.poids_mentionne !== "")
    lines.push(`• **Poids mentionné** : ${obj.poids_mentionne} kg`);
  if (obj.objectifs_semaine) lines.push(`• **Objectifs semaine** : ${obj.objectifs_semaine}`);
  if (obj.notes_importantes) lines.push(`• **Notes** : ${obj.notes_importantes}`);
  if (obj.prochaine_seance_recommandee)
    lines.push(`• **Prochaine séance recommandée** : ${obj.prochaine_seance_recommandee}`);
  return lines.length ? lines.join("\n") : raw;
}

function sessionPreview(summary) {
  const obj = parseSessionSummaryJson(summary);
  if (obj) {
    const parts = [];
    if (Array.isArray(obj.exercices_faits) && obj.exercices_faits.length)
      parts.push(obj.exercices_faits.slice(0, 2).join(", "));
    if (obj.prochaine_seance_recommandee) parts.push(String(obj.prochaine_seance_recommandee));
    const t = (parts.join(" · ") || String(obj.notes_importantes || "")).replace(/\s+/g, " ").trim();
    return t.slice(0, 90);
  }
  return (summary || "").replace(/\s+/g, " ").trim().slice(0, 90);
}

function CoachChat({ profile: profileProp, profileId, onBack }) {
  const [profile, setProfile] = useState(profileProp);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: profileProp.intro(profileProp.imc, profileProp.poids),
      imageUrl: null,
      isLoadingImage: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const endRef = useRef(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/sessions?profileId=${encodeURIComponent(profileId)}`);
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (profileId !== "wilson") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/progress?profileId=wilson");
      const data = await res.json();
      if (cancelled || data.weight == null) return;
      const weight = Number(data.weight);
      if (Number.isNaN(weight)) return;
      const heightM = 1.96;
      const imc = (weight / (heightM * heightM)).toFixed(1);
      setProfile((p) => ({ ...p, poids: weight, imc }));
      setMessages((msgs) => {
        if (msgs.length === 0) return msgs;
        const [first, ...rest] = msgs;
        if (first.role !== "assistant") return msgs;
        return [
          { ...first, content: profileProp.intro(imc, weight) },
          ...rest,
        ];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const saveWeightIfPresent = async (text) => {
    const weightMatch = text.match(/(\d+[\.,]?\d*)\s*kg/i);
    if (!weightMatch) return;

    const weight = parseFloat(weightMatch[1].replace(",", "."));
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, weight, notes: text }),
    });
    if (profileId === "wilson") {
      const heightM = 1.96;
      const imc = (weight / (heightM * heightM)).toFixed(1);
      setProfile((p) => ({ ...p, poids: weight, imc }));
      setMessages((msgs) => {
        if (msgs.length === 0) return msgs;
        const [first, ...rest] = msgs;
        if (first.role !== "assistant") return msgs;
        return [{ ...first, content: profileProp.intro(imc, weight) }, ...rest];
      });
    }
  };

  const endSession = async () => {
    if (savingSummary || messages.length < 2) return;
    setSavingSummary(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data?.summary) {
        const summaryBullets = formatSummaryForChat(data.summary);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Mémoire de session enregistrée ✅\n\n${summaryBullets}`,
            imageUrl: null,
            isLoadingImage: false,
          },
        ]);
        await loadSessions();
        setSelectedSession(null);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Impossible d'enregistrer le resume de session.",
          imageUrl: null,
          isLoadingImage: false,
        },
      ]);
    } finally {
      setSavingSummary(false);
    }
  };

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    await saveWeightIfPresent(userText);
    setInput("");
    const next = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          system: profile.system,
          profileId,
        }),
      });
      const data = await res.json();
      const reply = data.message || data.content?.map((b) => b.text || "").join("\n") || "Erreur.";
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: reply,
          imageUrl: data.imageUrl || null,
          isLoadingImage: Boolean(data.imageUrl),
        },
      ]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Erreur de connexion.", imageUrl: null, isLoadingImage: false }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: "#f0f0f0" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0, overflow: "hidden" }}>
        <aside
          style={{
            width: 272,
            flexShrink: 0,
            background: "#080808",
            borderRight: "1px solid #1e1e1e",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2 }}>Séances</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Historique (profil {profile.name})</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", minHeight: 0 }}>
            {sessionsLoading && (
              <div style={{ fontSize: 12, color: "#555", padding: 8 }}>Chargement…</div>
            )}
            {!sessionsLoading && sessions.length === 0 && (
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, padding: 8 }}>
                Aucune séance enregistrée. Utilise « Terminer la session » pour en créer une.
              </div>
            )}
            {!sessionsLoading &&
              sessions.map((s) => {
                const active = selectedSession?.id === s.id;
                const previewLine = sessionPreview(s.summary) || "—";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSession(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: active ? "#151515" : "transparent",
                      border: `1px solid ${active ? profile.color : "#222"}`,
                      borderRadius: 10,
                      padding: "10px 10px",
                      marginBottom: 8,
                      cursor: "pointer",
                      color: "#ddd",
                    }}
                  >
                    <div style={{ fontSize: 11, color: profile.color, fontWeight: 700, marginBottom: 4 }}>
                      {sessionListLabel(s)}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>
                      {previewLine}
                      {previewLine.length >= 90 ? "…" : ""}
                    </div>
                  </button>
                );
              })}
          </div>
          {selectedSession && (
            <div
              style={{
                borderTop: "1px solid #1a1a1a",
                padding: 12,
                maxHeight: 180,
                overflowY: "auto",
                background: "#0c0c0c",
              }}
            >
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>Résumé</div>
              <div
                style={{ fontSize: 12, color: "#bbb", lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{
                  __html: fmt(formatSummaryForChat(selectedSession.summary)),
                }}
              />
            </div>
          )}
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: profile.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{profile.emoji}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{profile.coachName} — Coach de {profile.name}</div>
          <div style={{ fontSize: 11, color: "#555" }}>IA personnalisée • En ligne</div>
        </div>
        <button
          onClick={endSession}
          disabled={savingSummary || messages.length < 2}
          style={{
            marginLeft: "auto",
            background: savingSummary ? "#1a1a1a" : "#222",
            color: "#ddd",
            border: "1px solid #333",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            cursor: savingSummary || messages.length < 2 ? "not-allowed" : "pointer",
          }}
        >
          {savingSummary ? "Sauvegarde..." : "Terminer la session"}
        </button>
      </div>

      <div style={{ background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", padding: "10px 20px", display: "flex", gap: 10, overflowX: "auto" }}>
        {[["Poids", `${profile.poids} kg`], ["Taille", profile.taille], ["Âge", `${profile.age} ans`], ["IMC", profile.imc, profile.color], ["Objectif", profile.objectif]].map(([l, v, c], i) => (
          <div key={i} style={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 8, padding: "5px 12px", flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#555" }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c || "#ddd" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
            {msg.role === "assistant" && <div style={{ width: 30, height: 30, borderRadius: 9, background: profile.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{profile.emoji}</div>}
            <div style={{ maxWidth: "75%", background: msg.role === "user" ? profile.bg : "#1a1a1a", border: msg.role === "user" ? "none" : "1px solid #222", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "11px 15px", fontSize: 13.5, lineHeight: 1.65 }}>
              <div dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
              {msg.role === "assistant" && msg.isLoadingImage && (
                <div
                  style={{
                    width: "300px",
                    height: "300px",
                    backgroundColor: "#2a2a2a",
                    borderRadius: "12px",
                    marginTop: "8px",
                    animation: "pulse 1.5s infinite",
                  }}
                />
              )}
              {msg.role === "assistant" && msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Illustration de l'exercice"
                  style={{
                    maxWidth: "300px",
                    width: "100%",
                    borderRadius: "12px",
                    marginTop: "8px",
                    border: "1px solid #2a2a2a",
                  }}
                  onLoad={() => {
                    setMessages((prev) =>
                      prev.map((m, idx) => (idx === i ? { ...m, isLoadingImage: false } : m))
                    );
                  }}
                  onError={() => {
                    setMessages((prev) =>
                      prev.map((m, idx) =>
                        idx === i ? { ...m, isLoadingImage: false, imageUrl: null } : m
                      )
                    );
                  }}
                />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: profile.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{profile.emoji}</div>
            <div style={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: "16px 16px 16px 4px", padding: "13px 16px", display: "flex", gap: 5 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: profile.color, animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 20px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {profile.suggestions.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, padding: "7px 13px", fontSize: 12, color: "#888", cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ background: "#111", borderTop: "1px solid #1a1a1a", padding: "14px 20px", display: "flex", gap: 10 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Pose ta question à ton coach..."
          rows={1}
          style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "11px 15px", fontSize: 13.5, color: "#f0f0f0", outline: "none", resize: "none", fontFamily: "inherit" }} />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ width: 44, height: 44, borderRadius: 12, background: loading || !input.trim() ? "#1a1a1a" : profile.bg, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 17, flexShrink: 0 }}>
          {loading ? "⏳" : "➤"}
        </button>
      </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}@keyframes pulse{0%{opacity:1}50%{opacity:.55}100%{opacity:1}}`}</style>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState(null);
  if (selected) return <CoachChat profile={PROFILES[selected]} profileId={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "system-ui, sans-serif", color: "#f0f0f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#444", textTransform: "uppercase", marginBottom: 12 }}>Plateforme privée</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1.5px", marginBottom: 8 }}>
          <span style={{ color: "#fff" }}>Votre </span>
          <span style={{ background: "linear-gradient(135deg, #ff6b00, #00b4d8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Coach IA</span>
        </div>
        <div style={{ fontSize: 14, color: "#444" }}>Choisissez votre espace personnel</div>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 520, width: "100%" }}>
        {Object.entries(PROFILES).map(([key, p]) => (
          <button key={key} onClick={() => setSelected(key)}
            style={{ flex: "1 1 220px", background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: 28, cursor: "pointer", textAlign: "left", transition: "all 0.25s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = "translateY(-4px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{p.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: p.color, fontWeight: 600, marginBottom: 16 }}>Coach {p.coachName}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[`${p.poids}kg · ${p.taille} · ${p.age} ans`, `IMC ${p.imc}`, `🎯 ${p.objectif}`].map((l, i) => (
                <div key={i} style={{ fontSize: 12, color: "#555" }}>{l}</div>
              ))}
            </div>
            <div style={{ marginTop: 20, color: p.color, fontSize: 12, fontWeight: 600 }}>Accéder à mon espace →</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 40, fontSize: 12, color: "#333" }}>🔒 Espace privé · Wilson & Océane</div>
    </div>
  );
}

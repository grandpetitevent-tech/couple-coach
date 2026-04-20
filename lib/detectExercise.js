const EXERCISE_KEYWORDS = [
  "exercice",
  "mouvement",
  "position",
  "pose",
  "etirement",
  "étirement",
  "gainage",
  "squat",
  "pompe",
  "planche",
  "fente",
  "burpee",
  "abdos",
  "crunch",
  "souleve",
  "soulevé",
  "tirage",
  "rotation",
  "flexion",
  "extension",
  "releve",
  "relevé",
  "saut",
  "sprint",
  "course",
];

export function detectExercise(text) {
  const lower = text.toLowerCase();
  const found = EXERCISE_KEYWORDS.find((k) => lower.includes(k));
  if (!found) return null;

  const index = lower.indexOf(found);
  const excerpt = text.substring(Math.max(0, index - 20), index + 60);
  return excerpt;
}

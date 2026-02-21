// Pure function: converts ai_analysis objects into a conversational Rabbit opener

type Analysis = Record<string, unknown>;

export function buildPhotoSummary(analyses: Analysis[]): string {
  const valid = analyses.filter(a => a && typeof a === "object");
  if (valid.length === 0) return "I've looked at these. Let's make something.";

  // Extract key fields from each analysis
  const summaries = valid.map(a => {
    const scene = (a.scene_summary as string) || "";
    const subjectType = (a.subject_type as string) || "";
    const subjectMood = (a.subject_mood as string) || "";
    const details = (a.notable_details as string[]) || [];
    const notable = details[0] || "";
    return { scene, subjectType, subjectMood, notable };
  });

  if (valid.length === 1) {
    const s = summaries[0];
    // Build from parts, falling back gracefully
    if (s.scene) {
      const flavor = s.notable ? ` — ${s.notable.toLowerCase()}` : "";
      return `I see ${s.scene.charAt(0).toLowerCase()}${s.scene.slice(1)}${flavor}. What do you want to make?`;
    }
    if (s.subjectType) {
      return `I see ${s.subjectType.startsWith("a") ? "" : "a "}${s.subjectType}${s.subjectMood ? ` looking ${s.subjectMood}` : ""}. What do you want to make?`;
    }
    return "There's definitely a story here. What do you want to make?";
  }

  // Multiple photos — summarize the collection
  const subjects = summaries
    .map(s => s.scene || s.subjectType)
    .filter(Boolean)
    .slice(0, 3);

  if (subjects.length >= 2) {
    const scenes = subjects.map(s => s.charAt(0).toLowerCase() + s.slice(1));
    const last = scenes.pop()!;
    return `I see ${valid.length} photos — ${scenes.join(", ")}, and ${last}. What do you want to make?`;
  }

  return `I've been through all ${valid.length} photos. I can see what makes these special. What do you want to make?`;
}

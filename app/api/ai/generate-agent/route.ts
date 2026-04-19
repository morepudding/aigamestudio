import { NextRequest, NextResponse } from "next/server";
import yaml from "js-yaml";
import { createAgent } from "@/lib/services/agentService";
import type { AgentTask } from "@/lib/services/agentService";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { draft } = body;

  if (!draft) {
    return NextResponse.json({ error: "Missing draft" }, { status: 400 });
  }

  const { department, gender, personality, appearance, name, assignedProject } = draft;

  const appearanceDesc = Object.entries(appearance)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");

  const personalityDesc = `${personality.primary} (dominante), nuancée par ${personality.nuance}, avec des traits secondaires : ${personality.extras?.join(", ") ?? ""}`.trim();

  const prompt = `Génère la configuration d'un agent au format YAML :
- Nom : ${name}
- Département : ${department}
- Genre : ${gender}
- Personnalité : ${personalityDesc}
- Apparence physique : ${appearanceDesc}

L'agent doit avoir :
1. Un "role" professionnel lié au département ${department}
2. Un "goal" ambitieux et précis
3. Un "backstory" riche qui intègre la personnalité (${personalityDesc}) dans son parcours et son style. Le backstory doit être crédible, pas caricatural.
4. Un "appearance_prompt" en anglais pour génération d'image IA (style portrait professionnel).

Réponds UNIQUEMENT avec le YAML, sans backticks, sans commentaire. Format :

${sanitizeName(name || "agent")}:
  role: >
    ...
  goal: >
    ...
  backstory: >
    ...
  appearance_prompt: >
    ...
  personality_primary: ${personality.primary}
  personality_nuance: ${personality.nuance}
  personality_extras: ${personality.extras?.join(", ") ?? ""}
  gender: ${gender}
  department: ${department}
  status: recruté
  assigned_project: ${assignedProject || ""}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.tasks,
      messages: [
        { role: "system", content: "Tu génères des fichiers YAML. Réponds uniquement en YAML valide, sans backticks markdown." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const yamlContent = data.choices?.[0]?.message?.content ?? "";

  // Generate tasks YAML
  const tasksPrompt = `Génère des tâches pour cet agent :
- Nom : ${name}
- Département : ${department}
- Rôle : ${personalityDesc}

Génère 2-3 tâches typiques pour ce rôle. Format YAML sans backticks:

task_name:
  description: >
    ...
  expected_output: >
    ...
  agent: ${sanitizeName(name || "agent")}`;

  const tasksRes = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.tasks,
      messages: [
        { role: "system", content: "Tu génères des fichiers YAML. Réponds uniquement en YAML valide, sans backticks markdown." },
        { role: "user", content: tasksPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  let tasksYaml = "";
  if (tasksRes.ok) {
    const tasksData = await tasksRes.json();
    tasksYaml = tasksData.choices?.[0]?.message?.content ?? "";
  }

  // Parse generated YAML to extract agent fields
  let agentData: Record<string, string> = {};
  try {
    const parsed = yaml.load(yamlContent) as Record<string, Record<string, string>>;
    const key = Object.keys(parsed)[0];
    agentData = parsed[key] ?? {};
  } catch {
    // fallback to empty
  }

  // Parse tasks YAML
  const tasks: AgentTask[] = [];
  if (tasksYaml) {
    try {
      const cleaned = tasksYaml.replace(/^```ya?ml\s*/m, "").replace(/^```\s*$/m, "").trim();
      const parsedTasks = yaml.load(cleaned) as { tasks?: AgentTask[] } | null;
      if (parsedTasks && Array.isArray(parsedTasks.tasks)) {
        tasks.push(...parsedTasks.tasks);
      }
    } catch {
      // ignore malformed tasks
    }
  }

  // Write agent to Supabase
  const agentSlug = sanitizeName(name || "agent");
  try {
    await createAgent(
      {
        slug: agentSlug,
        name: (name || "").trim() || agentSlug.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        role: agentData.role?.trim() ?? "",
        goal: agentData.goal?.trim() ?? "",
        backstory: agentData.backstory?.trim() ?? "",
        appearance_prompt: agentData.appearance_prompt?.trim() ?? "",
        personality_primary: agentData.personality_primary?.trim() ?? (draft.personality?.primary ?? ""),
        personality_nuance: agentData.personality_nuance?.trim() ?? (draft.personality?.nuance ?? ""),
        personality_extras: agentData.personality_extras?.trim() ?? (draft.personality?.extras?.join(", ") ?? null),
        gender: agentData.gender?.trim() ?? (draft.gender ?? ""),
        department: agentData.department?.trim() ?? (draft.department ?? ""),
        status: "recruté",
        assigned_project: agentData.assigned_project?.trim() ?? (draft.assignedProject ?? ""),
        portrait_url: null,
        icon_url: null,
        mood: "neutre" as const,
        mood_cause: null,
        mood_updated_at: null,
        confidence_level: 50,
        recruited_at: new Date().toISOString(),
      },
      tasks
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Generate LPC pixel sprite in the background (fire-and-forget)
  try {
    const origin = req.nextUrl.origin;
    fetch(`${origin}/api/agents/${agentSlug}/generate-sprite`, { method: "POST" }).catch(
      () => {}
    );
  } catch {
    // Non-blocking — sprite can be regenerated manually from the office view
  }

  return NextResponse.json({
    success: true,
    agentSlug,
    agentYaml: yamlContent,
    tasksYaml,
  });
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

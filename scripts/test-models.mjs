// Comparatif modèles via la vraie route /api/ai/reply (dev server requis sur localhost:3000)
// Usage : node scripts/test-models.mjs [slug-agent]
// Exemple : node scripts/test-models.mjs kaida
// Résultat : scripts/test-models-result.md

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Contourne les erreurs de certificat SSL en environnement local
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge le .env local du dossier scripts/
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const BASE_URL = "http://localhost:3000";
const AGENT_SLUG = process.argv[2] ?? "kaida_kurosawa";

// ─── Modèles à comparer ───────────────────────────────────────────────────────

const MODELS = [
  { id: "google/gemma-3-27b-it",       label: "Google Gemma 3 27B" },
  { id: "xiaomi/mimo-v2-flash",         label: "Xiaomi MiMo-V2-Flash" },
  { id: "openai/gpt-oss-120b",          label: "OpenAI gpt-oss-120b" },
];

// ─── Conversation de test ──────────────────────────────────────────────────────
// Collègues qui s'entendent bien, majorité perso, boulot qui s'intercale naturellement

const EXCHANGES = [
  "Salut ! T'as passé un bon weekend ?",
  "Ah ouais ? Moi j'ai finalement regardé Arcane saison 2, j'avais jamais eu le temps",
  "Franchement t'as raison. Bon on reprend — t'en es où sur ce que t'avais à faire la semaine dernière ?",
  "Ok. Au fait t'as des frères et sœurs toi ?",
  "Haha. Et sinon t'as des projets ce soir ou cette semaine ?",
  "Sympa. Bon je retourne bosser moi",
];

// ─── Appel route ──────────────────────────────────────────────────────────────

async function callRoute(modelId, agentPayload, history, userMessage) {
  const res = await fetch(`${BASE_URL}/api/ai/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...agentPayload,
      conversationHistory: history,
      userMessage,
      modelOverride: modelId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.message ?? "(réponse vide)";
}

// ─── Récupération de l'agent depuis Supabase via une route légère ─────────────

async function fetchAgent(slug) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agents?slug=eq.${slug}&select=name,slug,role,personality_primary,personality_nuance,backstory,mood,mood_cause,confidence_level&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`Aucun agent avec le slug "${slug}"`);
  const data = rows[0];

  return {
    name: data.name,
    slug: data.slug,
    role: data.role,
    personalityPrimary: data.personality_primary,
    personalityNuance: data.personality_nuance ?? "",
    backstory: data.backstory ?? "",
    mood: data.mood ?? "neutre",
    moodCause: data.mood_cause ?? "",
    confidenceLevel: data.confidence_level ?? 0,
    agentSlug: data.slug,
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function runConversation(model, agentPayload) {
  console.log(`\n▶ ${model.label}`);
  const history = [];
  const turns = [];

  for (const userMsg of EXCHANGES) {
    process.stdout.write(`  → "${userMsg.slice(0, 45)}…" `);

    let reply;
    try {
      reply = await callRoute(model.id, agentPayload, history, userMsg);
    } catch (e) {
      reply = `ERREUR: ${e.message}`;
    }

    history.push({ sender: "user", content: userMsg });
    history.push({ sender: "agent", content: reply });
    turns.push({ user: userMsg, agent: reply });
    console.log("✓");
  }

  return turns;
}

function formatResult(model, agentName, turns) {
  const lines = [`## ${model.label}`, `\`${model.id}\`\n`];
  for (const { user, agent } of turns) {
    lines.push(`**Romain :** ${user}\n`);
    // Affiche les bulles ||| séparément
    const bubbles = agent.split("|||").map((b) => b.trim()).filter(Boolean);
    for (const bubble of bubbles) {
      lines.push(`**${agentName} :** ${bubble}\n`);
    }
  }
  return lines.join("\n");
}

async function main() {
  console.log("=== Test comparatif modèles Eden Studio ===");
  console.log(`Agent slug : ${AGENT_SLUG}`);
  console.log("Récupération de l'agent depuis Supabase...");

  let agentPayload;
  try {
    agentPayload = await fetchAgent(AGENT_SLUG);
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    console.error("Assure-toi que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont dans scripts/.env");
    process.exit(1);
  }

  console.log(`Agent : ${agentPayload.name} (${agentPayload.personalityPrimary}) — confiance ${agentPayload.confidenceLevel}`);
  console.log(`Modèles : ${MODELS.map((m) => m.label).join(", ")}`);
  console.log("Dev server requis sur localhost:3000\n");

  const sections = [];

  for (const model of MODELS) {
    const turns = await runConversation(model, agentPayload);
    sections.push("---\n");
    sections.push(formatResult(model, agentPayload.name, turns));
  }

  const outputPath = path.join(__dirname, "test-models-result.md");
  fs.appendFileSync(outputPath, "\n" + sections.join("\n"), "utf-8");
  console.log(`\n✅ Résultats ajoutés à la suite de scripts/test-models-result.md`);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});

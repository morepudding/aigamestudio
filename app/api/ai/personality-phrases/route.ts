import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug, updateAgentFields } from "@/lib/services/agentService";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PERSONALITY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type PersonalityCacheEntry = {
  bio: string;
  expiresAt: number;
};

const globalCache = globalThis as typeof globalThis & {
  __personalityPhrasesCache?: Map<string, PersonalityCacheEntry>;
};

const personalityPhrasesCache = globalCache.__personalityPhrasesCache ?? new Map<string, PersonalityCacheEntry>();
globalCache.__personalityPhrasesCache = personalityPhrasesCache;

function getCacheKey(params: { slug?: string; department?: string; traits: { trait: string; role: "primary" | "nuance" | "secondary" }[] }) {
  if (params.slug) return `slug:${params.slug}`;

  const normalizedTraits = [...params.traits]
    .sort((a, b) => `${a.role}:${a.trait}`.localeCompare(`${b.role}:${b.trait}`))
    .map((t) => `${t.role}:${t.trait}`)
    .join("|");

  return `dept:${params.department ?? "unknown"}|traits:${normalizedTraits}`;
}

function getFromMemoryCache(key: string): string | null {
  const entry = personalityPhrasesCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    personalityPhrasesCache.delete(key);
    return null;
  }
  return entry.bio;
}

function setMemoryCache(key: string, bio: string) {
  personalityPhrasesCache.set(key, {
    bio,
    expiresAt: Date.now() + PERSONALITY_CACHE_TTL_MS,
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { agentName, agentRole, department, traits, slug } = body as {
    agentName?: string;
    agentRole?: string;
    department: string;
    traits: { trait: string; label: string; emoji: string; role: "primary" | "nuance" | "secondary" }[];
    slug?: string;
  };

  const normalizedTraits = Array.isArray(traits) ? traits : [];

  const safeSlug = slug ? slug.replace(/[^a-z0-9_-]/gi, "") : undefined;
  const cacheKey = getCacheKey({ slug: safeSlug, department, traits: normalizedTraits });

  const memoryCachedBio = getFromMemoryCache(cacheKey);
  if (memoryCachedBio) {
    return NextResponse.json({ bio: memoryCachedBio, cached: true, cache: "memory" });
  }

  // Return cached bio if available
  if (safeSlug) {
    const agent = await getAgentBySlug(safeSlug);
    if (agent?.personality_bio) {
      setMemoryCache(cacheKey, agent.personality_bio);
      return NextResponse.json({ bio: agent.personality_bio, cached: true });
    }
  }

  if (normalizedTraits.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const primary = normalizedTraits.find((t) => t.role === "primary");
  const nuance = normalizedTraits.find((t) => t.role === "nuance");
  const secondaries = normalizedTraits.filter((t) => t.role === "secondary");

  const traitsDesc = [
    primary ? `Trait dominant : ${primary.label}` : "",
    nuance ? `Trait de nuance : ${nuance.label}` : "",
    secondaries.length > 0 ? `Traits secondaires : ${secondaries.map((t) => t.label).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const nameContext = agentName && agentRole
    ? `Personnage : ${agentName}, ${agentRole} (département ${department})`
    : `Un collaborateur du département ${department}`;

  const systemPrompt = `Tu écris des portraits psychologiques de collaborateurs pour un studio de jeu vidéo.
Tu reçois un mélange de traits de personnalité et tu génères une description en prose, en français, directe et naturelle.
La description doit :
- Être à la troisième personne (elle/il)
- Tenir en 2 paragraphes (pas de titres, pas de listes)
- Mêler les traits sans les citer mot pour mot — ils transparaissent dans ce qu'on dit concrètement de la personne
- Avoir un ton direct, honnête, comme si on décrivait quelqu'un qu'on connaît vraiment — ni poétique ni corporate
- Parler de comportements concrets, de façons d'être dans le travail, dans les relations, pas de métaphores vagues
- Éviter : les formulations cryptiques, les images abstraites, le style "roman psychologique". Dire les choses clairement.
Réponds UNIQUEMENT avec le texte brut — aucun JSON, aucun titre, aucun commentaire.`;

  const userPrompt = `${nameContext}\n\n${traitsDesc}\n\nÉcris la description de personnalité.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Eden Studio",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    const data = await response.json();
    const bio: string = (data.choices?.[0]?.message?.content ?? "").trim();

    if (bio) {
      setMemoryCache(cacheKey, bio);
    }

    // Persist to DB so next page load uses the cache
    if (safeSlug && bio) {
      await updateAgentFields(safeSlug, { personality_bio: bio }).catch(() => {
        // Non-blocking — cache miss is acceptable
      });
    }

    return NextResponse.json({ bio });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

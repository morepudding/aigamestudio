import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import {
  selectMomentType,
  savePendingMoment,
  markMomentSent,
} from "@/lib/services/momentVivantService";
import { getAgentMemories, formatMemoriesForPrompt } from "@/lib/services/memoryService";
import { sendMessage } from "@/lib/services/chatService";
import type { MomentVivantScenario } from "@/lib/types/momentVivant";

type AgentRow = {
  slug: string;
  name: string;
  role: string;
  personality_primary: string;
  personality_nuance: string | null;
  backstory: string | null;
  confidence_level: number;
};

/**
 * POST /api/moment-vivant/[agentSlug]/trigger
 *
 * Génère et envoie immédiatement un Moment Vivant pour cet agent.
 * Utilisé au chargement du chat — vérifie qu'aucun moment actif n'existe déjà,
 * puis génère, sauvegarde et envoie le message dans la conversation principale.
 *
 * Paramètre body optionnel : { force: true } pour bypasser la vérification
 * du délai minimum (utile en dev/test).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;
  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force ?? false;

  // 1. Vérifier qu'il n'y a pas déjà un moment actif (pending avec message envoyé, sent, ou opened)
  // On ignore les pending sans chat_message_id : ce sont des moments ratés/orphelins
  const { data: activeMoments } = await supabase
    .from("pending_moments")
    .select("id, status, chat_message_id")
    .eq("agent_slug", agentSlug)
    .in("status", ["pending", "sent", "opened"]);

  const activeCount = (activeMoments ?? []).filter(
    (m) => m.status !== "pending" || m.chat_message_id !== null
  ).length;

  // Nettoyer les orphelins au passage
  const orphanIds = (activeMoments ?? [])
    .filter((m) => m.status === "pending" && m.chat_message_id === null)
    .map((m) => m.id);
  if (orphanIds.length > 0) {
    await supabase.from("pending_moments").delete().in("id", orphanIds);
  }

  if (activeCount > 0) {
    return NextResponse.json({ skipped: "already_active" });
  }

  // 2. Vérifier qu'aucun moment n'a été complété dans les 20 dernières heures
  // (permet de tester plusieurs fois par jour tout en ayant un nouveau moment le lendemain)
  const since20h = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const { count: recentCount } = await supabase
    .from("pending_moments")
    .select("id", { count: "exact", head: true })
    .eq("agent_slug", agentSlug)
    .eq("status", "completed")
    .gte("completed_at", since20h.toISOString());

  if ((recentCount ?? 0) > 0) {
    return NextResponse.json({ skipped: "too_recent" });
  }

  // 3. Récupérer les données de l'agent
  const { data: agentData, error: agentErr } = await supabase
    .from("agents")
    .select("slug, name, role, personality_primary, personality_nuance, backstory, confidence_level")
    .eq("slug", agentSlug)
    .single();

  if (agentErr || !agentData) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agentData as AgentRow;

  // 4. Récupérer les mémoires
  const memories = await getAgentMemories(agentSlug);
  const formattedMemories = formatMemoriesForPrompt(memories);

  // 5. Sélectionner le type de moment
  const momentType = selectMomentType(
    agent.personality_primary,
    agent.confidence_level ?? 0,
    formattedMemories.length > 0
  );

  // 6. Générer le scénario via LLM
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const genRes = await fetch(`${baseUrl}/api/ai/moment-vivant/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentSlug,
      agentName: agent.name,
      role: agent.role,
      personalityPrimary: agent.personality_primary,
      personalityNuance: agent.personality_nuance ?? "",
      backstory: agent.backstory ?? "",
      memories: formattedMemories || undefined,
      confidenceLevel: agent.confidence_level ?? 0,
      momentType,
    }),
  });

  if (!genRes.ok) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }

  const genData = await genRes.json() as {
    messageOuverture: string;
    scene: MomentVivantScenario["scene"];
  };

  if (!genData.messageOuverture || !genData.scene?.firstReplique) {
    return NextResponse.json({ error: "Invalid generation output" }, { status: 500 });
  }

  // 7. Sauvegarder le scénario — scheduled maintenant (envoi immédiat)
  const momentId = await savePendingMoment({
    agentSlug,
    momentType,
    messageOuverture: genData.messageOuverture,
    scene: genData.scene,
    scheduledAt: new Date(),
  });

  if (!momentId) {
    return NextResponse.json({ error: "Failed to save moment" }, { status: 500 });
  }

  // 8. Trouver la conversation principale et envoyer le message
  const { data: convData } = await supabase
    .from("conversations")
    .select("id")
    .eq("agent_slug", agentSlug)
    .eq("is_pinned", true)
    .single();

  if (!convData) {
    return NextResponse.json({ error: "No conversation found" }, { status: 404 });
  }

  const sentMsg = await sendMessage(
    (convData as { id: string }).id,
    genData.messageOuverture,
    "agent",
    "moment_vivant",
    true // bypass awaiting_user_reply check for moment vivant
  );

  if (!sentMsg) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  await markMomentSent(momentId, sentMsg.id);

  // 9. Mettre le statut à "opened" directement (le message est là, le joueur peut cliquer)
  await supabase
    .from("pending_moments")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", momentId);

  return NextResponse.json({
    ok: true,
    momentId,
    momentType,
    messageId: sentMsg.id,
  });
}

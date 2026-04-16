import { supabase } from "@/lib/supabase/client";
import type { MomentVivantType, MomentVivantScenario } from "@/lib/types/momentVivant";

const MOMENT_VIVANT_TYPES: MomentVivantType[] = [
  "pause-café",
  "drague",
  "complicité",
  "petite-friction",
  "confidence",
];

/** Délai minimum en jours entre deux moments pour un même agent */
const MIN_DAYS_BETWEEN_MOMENTS = 3;

/**
 * Personnalités qui ont un rythme plus lent (moins de moments)
 */
const SLOW_PERSONALITY_TYPES = new Set(["froide", "mysterieuse", "arrogante"]);

/**
 * Sélectionne le type de moment le plus pertinent selon le contexte de l'agent.
 */
export function selectMomentType(
  personalityPrimary: string,
  confidenceLevel: number,
  hasMemories: boolean
): MomentVivantType {
  const pool: MomentVivantType[] = ["pause-café", "pause-café"]; // toujours possible, weight x2

  // Drague : plus probable avec confiance élevée ou personnalité dragueuse
  if (personalityPrimary === "dragueuse" || confidenceLevel >= 40) {
    pool.push("drague", "drague");
  } else {
    pool.push("drague");
  }

  // Complicité : nécessite des mémoires partagées
  if (hasMemories && confidenceLevel >= 20) {
    pool.push("complicité", "complicité");
  }

  // Petite friction : personnalités directes ou jalouses, ou confiance bien établie
  if (["sarcastique", "jalouse", "directe", "franche"].includes(personalityPrimary)) {
    pool.push("petite-friction");
  }
  if (confidenceLevel >= 50) {
    pool.push("petite-friction");
  }

  // Confidence : personnalités ouvertes ou confiance forte
  if (confidenceLevel >= 35 || ["chaleureuse", "timide"].includes(personalityPrimary)) {
    pool.push("confidence");
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Calcule l'heure d'envoi dans la journée selon la personnalité de l'agent.
 * Retourne une Date pour aujourd'hui à l'heure correspondante.
 */
export function scheduledTimeForPersonality(personalityPrimary: string): Date {
  const now = new Date();
  const scheduled = new Date(now);

  // Heure de base selon personnalité
  const scheduleHours: Record<string, number> = {
    "geek-obsessionnelle": 22, // noctambule
    mysterieuse: 23,
    sarcastique: 11, // milieu de matinée
    chaleureuse: 9,
    directe: 8,
    froide: 14,
    dragueuse: 16,
    timide: 15,
    arrogante: 10,
    jalouse: 13,
    focus: 12,
    franche: 9,
    cool: 17,
  };

  const baseHour = scheduleHours[personalityPrimary] ?? 14;
  // Ajouter une légère variation aléatoire (±30 min)
  const minuteOffset = Math.floor(Math.random() * 60) - 30;

  scheduled.setHours(baseHour, 0 + minuteOffset, 0, 0);

  // Si l'heure est déjà passée aujourd'hui, planifier pour plus tard (+2h min)
  if (scheduled <= now) {
    scheduled.setTime(now.getTime() + 2 * 60 * 60 * 1000);
  }

  return scheduled;
}

/**
 * Vérifie si un agent est éligible pour un Moment Vivant aujourd'hui.
 */
export async function isAgentEligible(
  agentSlug: string,
  personalityPrimary: string,
  messageCount: number
): Promise<boolean> {
  // Minimum de 5 messages échangés pour avoir un moment
  if (messageCount < 5) return false;

  // Personnalités lentes : délai doublé
  const minDays = SLOW_PERSONALITY_TYPES.has(personalityPrimary)
    ? MIN_DAYS_BETWEEN_MOMENTS * 2
    : MIN_DAYS_BETWEEN_MOMENTS;

  const since = new Date();
  since.setDate(since.getDate() - minDays);

  // Vérifier qu'il n'y a pas de moment récent (pending/sent/opened/completed)
  const { count } = await supabase
    .from("pending_moments")
    .select("id", { count: "exact", head: true })
    .eq("agent_slug", agentSlug)
    .gte("created_at", since.toISOString());

  return (count ?? 0) === 0;
}

/**
 * Sauvegarde un scénario généré en base.
 */
export async function savePendingMoment(params: {
  agentSlug: string;
  momentType: MomentVivantType;
  messageOuverture: string;
  scene: MomentVivantScenario["scene"];
  scheduledAt: Date;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("pending_moments")
    .insert({
      agent_slug: params.agentSlug,
      moment_type: params.momentType,
      message_ouverture: params.messageOuverture,
      scene: params.scene,
      scheduled_at: params.scheduledAt.toISOString(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("savePendingMoment error:", error?.message);
    return null;
  }

  return (data as { id: string }).id;
}

/**
 * Marque un moment comme envoyé et stocke l'ID du message dans le chat.
 */
export async function markMomentSent(momentId: string, chatMessageId: string): Promise<void> {
  await supabase
    .from("pending_moments")
    .update({ status: "sent", chat_message_id: chatMessageId })
    .eq("id", momentId);
}

/**
 * Récupère les moments en statut "pending" dont l'heure planifiée est passée.
 */
export async function getPendingMomentsToSend(): Promise<
  Array<{
    id: string;
    agentSlug: string;
    messageOuverture: string;
    scheduledAt: string;
  }>
> {
  const { data, error } = await supabase
    .from("pending_moments")
    .select("id, agent_slug, message_ouverture, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    agentSlug: row.agent_slug as string,
    messageOuverture: row.message_ouverture as string,
    scheduledAt: row.scheduled_at as string,
  }));
}

/**
 * Expire les moments non ouverts après 20h.
 */
export async function expireOldMoments(): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 20);

  await supabase
    .from("pending_moments")
    .update({ status: "expired" })
    .in("status", ["sent"])
    .lte("scheduled_at", cutoff.toISOString());
}

/**
 * Récupère le moment ouvert pour un agent (pour l'UI).
 */
export async function getOpenedMoment(agentSlug: string): Promise<MomentVivantScenario | null> {
  const { data, error } = await supabase
    .from("pending_moments")
    .select("*")
    .eq("agent_slug", agentSlug)
    .eq("status", "opened")
    .single();

  if (error || !data) return null;

  const row = data as {
    id: string;
    agent_slug: string;
    moment_type: string;
    message_ouverture: string;
    scene: unknown;
    status: string;
    chat_message_id: string | null;
    scheduled_at: string;
    opened_at: string | null;
    completed_at: string | null;
    created_at: string;
  };

  return {
    id: row.id,
    agentSlug: row.agent_slug,
    momentType: row.moment_type as MomentVivantType,
    messageOuverture: row.message_ouverture,
    scene: row.scene as MomentVivantScenario["scene"],
    status: "opened",
    chatMessageId: row.chat_message_id,
    scheduledAt: row.scheduled_at,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

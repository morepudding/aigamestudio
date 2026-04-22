import {
  getUsedScenarioIdsFromMetadata,
  normalizeConversationMetadata,
} from "@/lib/services/chatMetadata";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ScenarioHistory {
  usedScenarioIds: number[];
  lastScenarioAt?: number;
}

/**
 * Récupère l'historique des scénarios utilisés pour une conversation
 */
export async function getScenarioHistory(conversationId: string): Promise<ScenarioHistory> {
  const supabase = getSupabaseAdminClient();
  
  const { data: conversation } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();
    
  if (!conversation?.metadata) {
    return { usedScenarioIds: [] };
  }
  
  const metadata = normalizeConversationMetadata(conversation.metadata);
  return {
    usedScenarioIds: getUsedScenarioIdsFromMetadata(metadata),
    lastScenarioAt: typeof metadata.lastScenarioAt === "number" ? metadata.lastScenarioAt : undefined,
  };
}

/**
 * Ajoute un scénario à l'historique d'une conversation
 */
export async function addScenarioToHistory(
  conversationId: string, 
  scenarioId: number
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  // Récupérer l'historique actuel
  const history = await getScenarioHistory(conversationId);
  
  // Ajouter le nouveau scénario et limiter à 5 derniers
  const updatedIds = [...history.usedScenarioIds, scenarioId];
  if (updatedIds.length > 5) {
    updatedIds.shift(); // Retirer le plus ancien
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();

  const metadata = (conversation?.metadata as Record<string, unknown> | null) ?? {};
  
  // Mettre à jour les métadonnées
  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...metadata,
        usedScenarioIds: updatedIds,
        lastScenarioAt: Date.now()
      }
    })
    .eq('id', conversationId);
}

/**
 * Réinitialise l'historique des scénarios pour une conversation
 */
export async function resetScenarioHistory(conversationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: conversation } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();

  const metadata = (conversation?.metadata as Record<string, unknown> | null) ?? {};
  
  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...metadata,
        usedScenarioIds: [],
        lastScenarioAt: null
      }
    })
    .eq('id', conversationId);
}
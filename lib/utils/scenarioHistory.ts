import { createClient } from '@/lib/supabase/server';

export interface ScenarioHistory {
  usedScenarioIds: number[];
  lastScenarioAt?: number;
}

/**
 * Récupère l'historique des scénarios utilisés pour une conversation
 */
export async function getScenarioHistory(conversationId: string): Promise<ScenarioHistory> {
  const supabase = await createClient();
  
  const { data: conversation } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();
    
  if (!conversation?.metadata) {
    return { usedScenarioIds: [] };
  }
  
  const metadata = conversation.metadata as any;
  return {
    usedScenarioIds: metadata.usedScenarioIds || [],
    lastScenarioAt: metadata.lastScenarioAt
  };
}

/**
 * Ajoute un scénario à l'historique d'une conversation
 */
export async function addScenarioToHistory(
  conversationId: string, 
  scenarioId: number
): Promise<void> {
  const supabase = await createClient();
  
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
  const supabase = await createClient();
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
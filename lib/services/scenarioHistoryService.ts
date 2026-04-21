import type { SupabaseClient } from '@supabase/supabase-js';
import { recordScenarioUsage, getUsedScenarioIdsFromMetadata, normalizeConversationMetadata } from '@/lib/services/chatMetadata';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface ConversationMetadata {
  usedScenarioIds?: number[];
  lastScenarioAt?: number;
  [key: string]: any;
}

export class ScenarioHistoryService {
  private supabase?: SupabaseClient;

  private getClient(client?: SupabaseClient): SupabaseClient {
    if (client) {
      return client;
    }
    if (!this.supabase) {
      this.supabase = getSupabaseAdminClient();
    }
    return this.supabase;
  }

  async getUsedScenarioIds(conversationId: string, client?: SupabaseClient): Promise<number[]> {
    const { data, error } = await this.getClient(client)
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      return [];
    }

    return getUsedScenarioIdsFromMetadata(data.metadata);
  }

  async addUsedScenario(conversationId: string, scenarioId: number, client?: SupabaseClient): Promise<void> {
    const activeClient = this.getClient(client);

    const { data, error: readError } = await activeClient
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single();

    if (readError) {
      throw new Error(`[ScenarioHistory] Failed to read metadata for ${conversationId}: ${readError.message}`);
    }

    const metadata = recordScenarioUsage(data?.metadata, scenarioId);

    const { error } = await activeClient
      .from('conversations')
      .update({
        metadata,
      })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`[ScenarioHistory] Failed to update metadata for ${conversationId}: ${error.message}`);
    }
  }

  async resetScenarioHistory(conversationId: string, client?: SupabaseClient): Promise<void> {
    const activeClient = this.getClient(client);

    const { data } = await activeClient
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single();

    const metadata = normalizeConversationMetadata(data?.metadata);

    const { error } = await activeClient
      .from('conversations')
      .update({
        metadata: {
          ...metadata,
          usedScenarioIds: [],
          lastScenarioAt: null
        }
      })
      .eq('id', conversationId);

    if (error) {
      console.error('[ScenarioHistory] Failed to reset metadata:', error);
    }
  }

  async getScenarioRotationStatus(
    conversationId: string, 
    availableScenarioCount: number,
    client?: SupabaseClient
  ): Promise<{ usedCount: number; availableCount: number; needsReset: boolean }> {
    const usedIds = await this.getUsedScenarioIds(conversationId, client);
    const needsReset = usedIds.length >= availableScenarioCount * 0.8; // Reset si 80% des scénarios utilisés
    
    return {
      usedCount: usedIds.length,
      availableCount: availableScenarioCount,
      needsReset
    };
  }
}

// Singleton instance
export const scenarioHistoryService = new ScenarioHistoryService();
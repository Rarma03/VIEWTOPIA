import { isSupabaseConfigured } from './supabase';
import { getPartyMessages, sendPartyMessage, getProfilesByIds } from './store';
import { WatchPartyMessage } from '@/types';

/**
 * Watch-party chat service. Backed entirely by Supabase (`party_messages`
 * table) so messages sync across devices and browsers.
 */

export async function sendChatMessage(
  partyId: string,
  userId: string,
  text: string,
  userName?: string,
): Promise<WatchPartyMessage | null> {
  let resolvedName = userName;
  if (!resolvedName) {
    const profiles = await getProfilesByIds([userId]);
    const p = profiles[userId];
    resolvedName = p?.display_name || p?.username || 'Anonymous';
  }
  return sendPartyMessage(partyId, userId, resolvedName, text);
}

export async function fetchChatMessages(partyId: string): Promise<WatchPartyMessage[]> {
  return getPartyMessages(partyId);
}

export { isSupabaseConfigured as isChatLive };

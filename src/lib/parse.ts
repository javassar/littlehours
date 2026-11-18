/**
 * Milestone 2.2: Background AI parsing triggers and helpers
 */

import { supabase } from './supabase.ts';

/**
 * Triggers the parse-entry Edge Function in the background.
 * Saving never waits for this call to complete.
 */
export async function parseEntryInBackground(entryId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('Cannot parse entry in background: No active session.');
      return;
    }

    const { data, error } = await supabase.functions.invoke('parse-entry', {
      body: { entry_id: entryId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.warn(`parse-entry returned error for ${entryId}:`, error.message);

      // Milestone 3.9 Step 5 item 6: Check for demo_limit (HTTP 429)
      let isDemoLimit = false;
      try {
        if ('context' in error && (error as any).context) {
          const res = (error as any).context as Response;
          if (res.status === 429) {
            const body = await res.clone().json().catch(() => ({}));
            if (body?.error === 'demo_limit') {
              isDemoLimit = true;
            }
          }
        }
      } catch {
        // ignore
      }

      if (isDemoLimit) {
        // Keep parse_status = 'pending' with 'demo_limit' clarification
        await supabase
          .from('entries')
          .update({
            parse_status: 'pending',
            clarification_question: 'demo_limit',
            updated_at: new Date().toISOString(),
          })
          .eq('id', entryId);
        return;
      }

      // Mark as failed in DB with friendly explanation so UI shows "Try again"
      const friendlyMsg =
        error.message?.includes('non-2xx') || error.message?.includes('546')
          ? 'AI service was temporarily busy. Tap Try again in a moment.'
          : error.message;

      await supabase
        .from('entries')
        .update({
          parse_status: 'failed',
          clarification_question: friendlyMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);
    } else if (data?.status === 'failed') {
      console.warn(`parse-entry logic failed for ${entryId}:`, data.error);
    }
  } catch (err) {
    console.warn(`Exception during background parse for ${entryId}:`, err);
    try {
      await supabase
        .from('entries')
        .update({ parse_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', entryId);
    } catch {
      // Offline, ignore
    }
  }
}

/**
 * Re-trigger parsing for an entry that failed.
 */
export async function retryParseEntry(entryId: string): Promise<void> {
  try {
    await supabase
      .from('entries')
      .update({ parse_status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', entryId);
  } catch (err) {
    console.warn('Could not update parse_status to pending:', err);
  }

  // Trigger in background
  parseEntryInBackground(entryId);
}

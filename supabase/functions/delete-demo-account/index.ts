/**
 * Milestone 3.9: Supabase Edge Function `delete-demo-account`
 * Deletes the caller's anonymous demo sandbox and auth user record.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // 1. Verify token with Supabase Auth to identify the caller and verify claims
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired authentication token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check: ONLY anonymous users can be deleted via this endpoint.
    // Permanent user accounts (Jackie) must NEVER be touched.
    if (!user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Only anonymous demo accounts can be deleted via this endpoint.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Delete caller's rows in order:
    // pain_ratings, segments, entries, settings, demo_usage
    await admin.from('pain_ratings').delete().eq('user_id', userId);
    await admin.from('segments').delete().eq('user_id', userId);
    await admin.from('entries').delete().eq('user_id', userId);
    await admin.from('push_subscriptions').delete().eq('user_id', userId);
    await admin.from('settings').delete().eq('user_id', userId);
    await admin.from('demo_usage').delete().eq('user_id', userId);

    // Delete the auth user
    const { error: delUserErr } = await admin.auth.admin.deleteUser(userId);
    if (delUserErr) {
      console.warn(`[delete-demo-account] Failed to delete auth user ${userId}:`, delUserErr.message);
    } else {
      console.log(`[delete-demo-account] Successfully deleted demo user ${userId}.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[delete-demo-account] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

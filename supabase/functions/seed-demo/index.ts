/**
 * Milestone 3.9: Supabase Edge Function `seed-demo`
 * Seeds 7 days of realistic sample data for anonymous demo visitors.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateDemoSeedData } from './data.ts';
import demoCategories from '../_shared/demoCategories.json' with { type: 'json' };
import { DEMO_RESETS_PER_DAY } from '../_shared/demoConfig.ts';

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

    // Rule: Must be an anonymous user.
    // Check both user.is_anonymous and app_metadata / raw user properties.
    const isAnonymous = Boolean(user.is_anonymous);
    if (!isAnonymous) {
      return new Response(JSON.stringify({ error: 'Demo seeding is only available for anonymous demo accounts.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // 2. Parse input and validate timezone
    const body = await req.json().catch(() => ({}));
    let timeZone = typeof body.timezone === 'string' ? body.timezone.trim() : 'America/Phoenix';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone });
    } catch {
      timeZone = 'America/Phoenix';
    }

    const isReset = Boolean(body.reset);

    // 3. Admin client with service_role to read/write demo data safely
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    let currentResets = 0;

    // 3b. Query remaining resets for today
    if (body.get_resets) {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: usageRow } = await admin
        .from('demo_usage')
        .select('reset_count')
        .eq('user_id', userId)
        .eq('usage_date', todayDate)
        .maybeSingle();

      currentResets = usageRow?.reset_count || 0;
      return new Response(
        JSON.stringify({
          reset_count: currentResets,
          remaining_resets: Math.max(0, DEMO_RESETS_PER_DAY - currentResets),
          max_resets: DEMO_RESETS_PER_DAY,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Idempotency check: if reset is false and user already has entries, return seeded: false
    if (!isReset) {
      const { count, error: countErr } = await admin
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!countErr && (count || 0) > 0) {
        return new Response(JSON.stringify({ seeded: false, message: 'Sandbox already seeded' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Reset flow: Check reset_count for today in demo_usage
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: usageRow } = await admin
        .from('demo_usage')
        .select('reset_count')
        .eq('user_id', userId)
        .eq('usage_date', todayDate)
        .maybeSingle();

      currentResets = usageRow?.reset_count || 0;
      if (currentResets >= DEMO_RESETS_PER_DAY) {
        return new Response(
          JSON.stringify({
            error: 'demo_reset_limit',
            message: `You have reached the daily limit of ${DEMO_RESETS_PER_DAY} sample data resets.`,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Increment reset count preserving existing parse_count
      if (usageRow) {
        await admin
          .from('demo_usage')
          .update({ reset_count: currentResets + 1 })
          .eq('user_id', userId)
          .eq('usage_date', todayDate);
      } else {
        await admin
          .from('demo_usage')
          .insert({
            user_id: userId,
            usage_date: todayDate,
            reset_count: 1,
            parse_count: 0,
          });
      }

      // Delete caller's existing rows in order
      await admin.from('pain_ratings').delete().eq('user_id', userId);
      await admin.from('segments').delete().eq('user_id', userId);
      await admin.from('entries').delete().eq('user_id', userId);
    }

    // 5. Ensure caller's settings row exists with standardized demo categories and user timezone
    const { error: settingsErr } = await admin.from('settings').upsert(
      {
        user_id: userId,
        timezone: timeZone,
        categories: demoCategories,
        vacation_mode: false,
        reminders_enabled: false,
      },
      { onConflict: 'user_id' }
    );
    if (settingsErr) {
      console.error('[seed-demo] settings upsert error:', settingsErr);
      throw new Error(`Failed to save settings: ${settingsErr.message}`);
    }

    // 6. Generate 7 days of realistic seed data
    const seed = generateDemoSeedData(userId, timeZone, new Date());

    // 7. Insert entries, segments, and pain_ratings in batches
    if (seed.entries.length > 0) {
      for (let i = 0; i < seed.entries.length; i += 25) {
        const chunk = seed.entries.slice(i, i + 25);
        const { error: entErr } = await admin.from('entries').insert(chunk);
        if (entErr) {
          console.error('[seed-demo] entries insert error:', entErr);
          throw new Error(`Failed to insert seed entries: ${entErr.message}`);
        }
      }
    }

    if (seed.segments.length > 0) {
      // Chunk segment inserts in batches of 50
      for (let i = 0; i < seed.segments.length; i += 50) {
        const chunk = seed.segments.slice(i, i + 50);
        const { error: segErr } = await admin.from('segments').insert(chunk);
        if (segErr) {
          console.error('[seed-demo] segments insert error:', segErr);
          throw new Error(`Failed to insert seed segments: ${segErr.message}`);
        }
      }
    }

    if (seed.painRatings.length > 0) {
      for (let i = 0; i < seed.painRatings.length; i += 50) {
        const chunk = seed.painRatings.slice(i, i + 50);
        const { error: prErr } = await admin.from('pain_ratings').insert(chunk);
        if (prErr) {
          console.error('[seed-demo] pain ratings insert error:', prErr);
          throw new Error(`Failed to insert seed pain ratings: ${prErr.message}`);
        }
      }
    }

    console.log(
      `[seed-demo] Successfully seeded demo user ${userId}: ` +
        `${seed.entries.length} entries, ${seed.segments.length} segments, ${seed.painRatings.length} ratings.`
    );

    const currentResetsAfter = isReset ? currentResets + 1 : 0;
    return new Response(
      JSON.stringify({
        seeded: true,
        entriesCount: seed.entries.length,
        segmentsCount: seed.segments.length,
        ratingsCount: seed.painRatings.length,
        reset_count: currentResetsAfter,
        remaining_resets: isReset
          ? Math.max(0, DEMO_RESETS_PER_DAY - currentResetsAfter)
          : DEMO_RESETS_PER_DAY,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[seed-demo] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

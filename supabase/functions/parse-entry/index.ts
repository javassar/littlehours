/**
 * Milestone 2.1 & 2.2: Supabase Edge Function `parse-entry`
 * Parses a time-log entry into structured time segments using Gemini.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SYSTEM_PROMPT, PROMPT_VERSION } from './prompt.ts';
import { validateParseResult, ParseResponse } from './validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let entryId: string | undefined;
  let simulateBroken = false;

  try {
    const body = await req.json().catch(() => ({}));
    entryId = body.entry_id;
    simulateBroken = Boolean(body.simulate_broken || req.headers.get('x-simulate-broken') === '1');

    if (!entryId) {
      return new Response(JSON.stringify({ error: 'Missing required field: entry_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Create client using caller's JWT so Row-Level Security applies
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // 1. Load entry
    const { data: entry, error: entryErr } = await supabase
      .from('entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entryErr || !entry) {
      return new Response(
        JSON.stringify({ error: `Entry not found or unauthorized: ${entryErr?.message || ''}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Load settings & categories
    const { data: settings } = await supabase
      .from('settings')
      .select('timezone, categories')
      .eq('user_id', entry.user_id)
      .maybeSingle();

    const timeZone = settings?.timezone || 'America/Phoenix';
    const categories: string[] = Array.isArray(settings?.categories)
      ? settings.categories
      : [
          'work',
          'job search',
          'phone and social media',
          'sleep',
          'exercise',
          'meals',
          'chores',
          'social time',
          'reading',
          'entertainment',
          'travel',
          'personal care',
          'errands',
          'rest',
        ];

    // 3. Load labels used so far: distinct activity_label and category pairs, most frequent first, capped at 100
    const { data: segs } = await supabase
      .from('segments')
      .select('activity_label, category')
      .eq('user_id', entry.user_id);

    const freqMap = new Map<string, { activity_label: string; category: string; count: number }>();
    for (const s of segs || []) {
      const key = `${s.activity_label.trim().toLowerCase()}::${s.category.trim().toLowerCase()}`;
      const existing = freqMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        freqMap.set(key, {
          activity_label: s.activity_label,
          category: s.category,
          count: 1,
        });
      }
    }

    const labelsUsed = Array.from(freqMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(({ activity_label, category }) => ({ activity_label, category }));

    // 4. Gemini API Configuration
    const rawApiKey = Deno.env.get('GEMINI_API_KEY');
    const apiKey = rawApiKey ? rawApiKey.trim() : null;
    const configuredModel = (Deno.env.get('GEMINI_MODEL') || '').trim();

    if (!apiKey) {
      const missingKeyMsg = 'GEMINI_API_KEY secret is not set in Supabase. Run: npx supabase secrets set GEMINI_API_KEY=...';
      await supabase
        .from('entries')
        .update({
          parse_status: 'failed',
          clarification_question: missingKeyMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      return new Response(
        JSON.stringify({ error: missingKeyMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query Google AI Studio API for the live list of models enabled for this key
    let candidateModels: string[] = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
        console.log('Available models from ListModels for this key:', available);

        // Put preferred models first
        if (available.length > 0) {
          if (configuredModel && available.includes(configuredModel)) {
            candidateModels.push(configuredModel);
          }
          // Add Flash models
          const flashModels = available.filter((m: string) => m.toLowerCase().includes('flash'));
          candidateModels.push(...flashModels);
          // Add other remaining models
          candidateModels.push(...available);
        }
      } else {
        const listErrText = await listRes.text();
        console.warn(`ListModels returned status ${listRes.status}:`, listErrText);
      }
    } catch (listErr) {
      console.warn('Error querying ListModels:', listErr);
    }

    // Fallback model list if ListModels was empty
    if (candidateModels.length === 0) {
      candidateModels = [
        configuredModel || 'gemini-2.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro',
      ];
    }

    // Remove duplicates and empty strings
    candidateModels = Array.from(new Set(candidateModels.filter(Boolean)));
    console.log('Final candidate models to attempt:', candidateModels);

    const initialUserPayload = {
      raw_text: entry.raw_text,
      window_start: entry.window_start,
      window_end: entry.window_end,
      timezone: timeZone,
      category_list: categories,
      labels_used: labelsUsed,
      follow_ups: entry.follow_ups || [],
    };

    let usedModel = candidateModels[0];

    const callGemini = async (contentsHistory: Array<{ role: string; parts: Array<{ text: string }> }>) => {
      let lastErrorText = '';

      for (const m of candidateModels) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const reqBody = {
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: contentsHistory,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            responseSchema: {
              type: 'OBJECT',
              properties: {
                status: {
                  type: 'STRING',
                  enum: ['parsed', 'needs_clarification'],
                },
                question: {
                  type: 'STRING',
                  nullable: true,
                },
                segments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      start_time: {
                        type: 'STRING',
                        description: 'ISO 8601 with UTC offset',
                      },
                      end_time: {
                        type: 'STRING',
                        description: 'ISO 8601 with UTC offset',
                      },
                      activity_label: {
                        type: 'STRING',
                        description: 'Short lowercase phrase',
                      },
                      category: {
                        type: 'STRING',
                        description: 'One of the allowed categories',
                      },
                    },
                    required: ['start_time', 'end_time', 'activity_label', 'category'],
                  },
                },
              },
              required: ['status', 'segments'],
            },
          },
        };

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(reqBody),
        });

        if (res.ok) {
          usedModel = m;
          const resData = await res.json();
          const rawReplyText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawReplyText) {
            throw new Error('Gemini API returned empty response candidate.');
          }
          return { rawReplyText, parsed: JSON.parse(rawReplyText) as ParseResponse };
        }

        const errText = await res.text();
        lastErrorText = `Model ${m} returned ${res.status}: ${errText}`;
        console.warn(lastErrorText);

        // If it's a 400 or 403 API key issue, don't keep retrying other models
        if (res.status === 400 && errText.includes('API_KEY_INVALID')) {
          throw new Error('API key not valid. Please check your GEMINI_API_KEY secret.');
        }
        if (res.status === 403) {
          throw new Error(`Permission denied: ${errText}`);
        }
      }

      throw new Error(`All candidate models failed. Last error: ${lastErrorText}`);
    };

    // Contents sequence for multi-turn retry if needed
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      {
        role: 'user',
        parts: [{ text: JSON.stringify(initialUserPayload) }],
      },
    ];

    let parseResult: ParseResponse | null = null;
    let finalValidationError: string | null = null;

    if (simulateBroken) {
      finalValidationError = 'Simulated broken model reply';
    } else {
      try {
        // Attempt 1
        const attempt1 = await callGemini(contents);
        const val1 = validateParseResult(attempt1.parsed, entry.window_start, entry.window_end, categories);

        if (val1.valid) {
          parseResult = attempt1.parsed;
        } else {
          // Retry once with validation error added
          contents.push({
            role: 'model',
            parts: [{ text: attempt1.rawReplyText }],
          });
          contents.push({
            role: 'user',
            parts: [
              {
                text: `The previous result was invalid: ${val1.error}. Please correct the issues and output valid JSON adhering strictly to the rules.`,
              },
            ],
          });

          const attempt2 = await callGemini(contents);
          const val2 = validateParseResult(attempt2.parsed, entry.window_start, entry.window_end, categories);

          if (val2.valid) {
            parseResult = attempt2.parsed;
          } else {
            finalValidationError = val2.error || 'Second validation attempt failed.';
          }
        }
      } catch (err: unknown) {
        finalValidationError = err instanceof Error ? err.message : 'Unknown Gemini error';
      }
    }

    // 5. Handle Final Outcome
    if (!parseResult || finalValidationError) {
      console.error(`Setting entry ${entry.id} as failed:`, finalValidationError);

      await supabase
        .from('entries')
        .update({
          parse_status: 'failed',
          clarification_question: finalValidationError || 'Validation failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      return new Response(
        JSON.stringify({
          status: 'failed',
          error: finalValidationError || 'Validation failed',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (parseResult.status === 'needs_clarification') {
      await supabase
        .from('entries')
        .update({
          parse_status: 'needs_clarification',
          clarification_question: parseResult.question || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      return new Response(
        JSON.stringify({
          status: 'needs_clarification',
          question: parseResult.question,
          segments: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Status is 'parsed': Replace any existing segments and insert new segments
    const newSegments = (parseResult.segments || []).map((seg) => ({
      entry_id: entry.id,
      user_id: entry.user_id,
      start_time: seg.start_time,
      end_time: seg.end_time,
      activity_label: seg.activity_label.trim().toLowerCase(),
      category: seg.category.trim().toLowerCase(),
      confirmed: false,
      model: usedModel,
      prompt_version: PROMPT_VERSION,
    }));

    // Delete existing segments for this entry
    await supabase.from('segments').delete().eq('entry_id', entry.id);

    // Insert new segments
    const { error: segInsertErr } = await supabase.from('segments').insert(newSegments);
    if (segInsertErr) {
      throw new Error(`Failed to insert segments: ${segInsertErr.message}`);
    }

    // Update entry parse_status to 'parsed'
    await supabase
      .from('entries')
      .update({
        parse_status: 'parsed',
        clarification_question: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    return new Response(
      JSON.stringify({
        status: 'parsed',
        segments: newSegments,
        prompt_version: PROMPT_VERSION,
        model: usedModel,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';

    if (entryId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const authHeader = req.headers.get('Authorization');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: authHeader ? { Authorization: authHeader } : {} },
        });
        await supabase
          .from('entries')
          .update({
            parse_status: 'failed',
            clarification_question: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entryId);
      } catch (dbErr) {
        console.error('Failed to set parse_status failed on exception:', dbErr);
      }
    }

    return new Response(JSON.stringify({ status: 'failed', error: errorMsg }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

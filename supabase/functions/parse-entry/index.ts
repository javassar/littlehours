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
    const DEFAULT_CATEGORIES: Array<{ name: string; description: string }> = [
      { name: 'work', description: 'Paid or assigned work, including freelance work and work for family.' },
      { name: 'job search', description: 'Applications, resumes, cover letters, job boards, and interview prep.' },
      { name: 'networking', description: 'Conversations or messages with career contacts, including informational chats and follow-ups.' },
      { name: 'professional development', description: 'Learning and building skills for my field: courses, tutorials, reading about my field, and portfolio or skill-building projects.' },
      { name: 'admin', description: 'Paperwork, money, accounts, scheduling, and inbox upkeep: bills, taxes, forms, passwords, booking and rescheduling. Paperwork that serves one other category belongs to that category (an insurance claim is healthcare, application forms are job search). Never use for tasks that are not paperwork or logistics.' },
      { name: 'doomscrolling', description: 'Scrolling any app or site mindlessly or compulsively. Only when the text signals it.' },
      { name: 'social media', description: 'Chosen use of apps like Pinterest and BeReal, including browsing, posting, and commenting.' },
      { name: 'entertainment', description: 'Chosen content or routine viewing, alone or with others: TV, movies, YouTube videos, podcasts, music, and games. Not a ticketed or invited occasion.' },
      { name: 'events', description: 'Ticketed, invited, or formally scheduled occasions: ballet, concerts, theater, weddings, parties, games. Outranks entertainment, social time, and social meals.' },
      { name: 'texting', description: 'Messaging with friends and family. Career messages go to networking or job search.' },
      { name: 'social time', description: 'Time where interacting with people is the activity: visits, talking, calls and video calls, hanging out.' },
      { name: 'sleep', description: 'Sleeping, and lying in bed trying to fall asleep.' },
      { name: 'exercise', description: 'Workouts, walks for fitness, sports, and stretching.' },
      { name: 'functional meals', description: 'Preparing and eating ordinary meals, alone or with the people I live with. Dishes and cleanup are chores.' },
      { name: 'social meals', description: 'Meals out or hosted where the meal is also the social occasion. Formally invited meals are events.' },
      { name: 'chores', description: 'Housework inside the home: cleaning, laundry, dishes, tidying.' },
      { name: 'errands', description: 'Necessary tasks outside the home: groceries, bank, post office, returns.' },
      { name: 'shopping', description: 'Browsing or buying things I want, in store or online.' },
      { name: 'reading', description: 'Reading books or long-form pieces for pleasure. Reading about my field is professional development.' },
      { name: 'piano', description: 'Playing, practicing, or learning piano.' },
      { name: 'hobbies', description: 'Hobbies without their own category: crafts, baking for fun, writing, journaling. Specifics go in the label.' },
      { name: 'hygiene', description: 'Daily basics: showering, brushing teeth, getting dressed, skincare routine.' },
      { name: 'personal care', description: 'Occasional or discretionary care: hair, nails, spa, massage, self-care sessions.' },
      { name: 'healthcare', description: 'Appointments, medication, therapy, and related pharmacy trips.' },
      { name: 'vacation', description: 'Everything while on a trip, from leaving home until returning. Overrides all other categories.' },
    ];

    const { data: settings } = await supabase
      .from('settings')
      .select('timezone, categories')
      .eq('user_id', entry.user_id)
      .maybeSingle();

    const timeZone = settings?.timezone || 'America/Phoenix';
    const rawCategories = Array.isArray(settings?.categories) ? settings.categories : [];
    const categories: Array<{ name: string; description: string }> =
      rawCategories.length > 0
        ? rawCategories.map((c: any) => {
            if (typeof c === 'string') {
              const clean = c.trim().toLowerCase();
              const aliased = clean === 'digital media time' ? 'social media' : clean === 'misc hobby' ? 'hobbies' : clean;
              const found = DEFAULT_CATEGORIES.find((d) => d.name === aliased);
              return { name: aliased, description: found?.description || '' };
            }
            const name = String(c.name || '').trim().toLowerCase();
            const aliased = name === 'digital media time' ? 'social media' : name === 'misc hobby' ? 'hobbies' : name;
            const found = DEFAULT_CATEGORIES.find((d) => d.name === aliased);
            return {
              name: aliased,
              description: String(c.description || found?.description || ''),
            };
          })
        : DEFAULT_CATEGORIES;

    // 3. Load labels used so far and company names used so far: capped at 100
    const { data: segs } = await supabase
      .from('segments')
      .select('activity_label, category, company')
      .eq('user_id', entry.user_id);

    const freqMap = new Map<string, { activity_label: string; category: string; count: number }>();
    const companyFreq = new Map<string, { name: string; count: number }>();

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

      const rawComp: string[] = Array.isArray(s.company) ? s.company : [];
      for (const n of rawComp) {
        const trimmed = typeof n === 'string' ? n.trim() : '';
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        const existingC = companyFreq.get(lower);
        if (existingC) {
          existingC.count += 1;
        } else {
          companyFreq.set(lower, { name: trimmed, count: 1 });
        }
      }
    }

    const labelsUsed = Array.from(freqMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(({ activity_label, category }) => ({ activity_label, category }));

    const companyUsed = Array.from(companyFreq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map((item) => item.name);

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
    let availableModels: string[] = [];
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        availableModels = (listData.models || [])
          .filter(
            (m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent')
          )
          .map((m: any) => m.name.replace(/^models\//, ''));
        console.log('Available models from ListModels for this key:', availableModels);
      } else {
        const listErrText = await listRes.text();
        console.warn(`ListModels returned status ${listRes.status}:`, listErrText);
      }
    } catch (listErr) {
      console.warn('Error or timeout querying ListModels:', listErr);
    }

    // Filter to standard text generation Flash models only.
    // Exclude specialized / experimental audio, TTS, vision-only, and embedding models.
    const cleanFlashModels = availableModels.filter((m: string) => {
      const lower = m.toLowerCase();
      return (
        lower.includes('flash') &&
        !lower.includes('tts') &&
        !lower.includes('audio') &&
        !lower.includes('preview') &&
        !lower.includes('embed') &&
        !lower.includes('imagen') &&
        !lower.includes('realtime')
      );
    });

    // Priority order:
    // When Google's standard Flash servers experience high demand spikes (503),
    // Google's Lite Flash models (gemini-2.5-flash-lite, gemini-flash-lite-latest, gemini-3.1-flash-lite)
    // have dedicated high capacity and respond instantly without high-demand errors.
    const priorityOrder = [
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      configuredModel,
    ].filter(Boolean);

    let candidateModels: string[] = [];
    for (const p of priorityOrder) {
      if (cleanFlashModels.includes(p)) {
        candidateModels.push(p);
      }
    }
    // Add any other clean Flash models as backup
    candidateModels.push(...cleanFlashModels);

    // Fallback if ListModels was empty
    if (candidateModels.length === 0) {
      candidateModels = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
    }

    // Try up to 3 models (503 errors return in ~200ms so trying 3 models takes under 1s if one is busy)
    candidateModels = Array.from(new Set(candidateModels.filter(Boolean))).slice(0, 3);
    console.log('Candidate models to attempt (max 3):', candidateModels);

    const followUpsList = Array.isArray(entry.follow_ups) ? entry.follow_ups : [];
    const followUpsFormatted = followUpsList.map((f: any, idx: number) => ({
      round: idx + 1,
      question: f.question,
      answer: f.answer,
    }));

    const onVacation = Boolean(entry.on_vacation);

    const initialUserPayload = {
      raw_text: entry.raw_text,
      follow_ups: followUpsFormatted,
      window_start: entry.window_start,
      window_end: entry.window_end,
      timezone: timeZone,
      on_vacation: onVacation,
      categories: categories,
      labels_used: labelsUsed,
      company_used: companyUsed,
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
                  nullable: true,
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
                        description: 'One name from categories',
                      },
                      company: {
                        type: 'ARRAY',
                        items: { type: 'STRING' },
                        description: 'People the user was with during this segment',
                      },
                    },
                    required: ['start_time', 'end_time', 'activity_label', 'category', 'company'],
                  },
                },
              },
              required: ['status'],
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
          signal: AbortSignal.timeout(20000),
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

        // Immediate stop on quota / rate limit (429) - retrying other models won't help
        if (res.status === 429) {
          throw new Error('Google Gemini rate limit reached (free tier quota). Please wait a few seconds and tap Try again.');
        }

        // If it's a 400 or 403 API key issue, don't keep retrying other models
        if (res.status === 400 && errText.includes('API_KEY_INVALID')) {
          throw new Error('API key not valid. Please check your GEMINI_API_KEY secret.');
        }
        if (res.status === 403) {
          throw new Error(`Permission denied: ${errText}`);
        }
      }

      const availableSnippet = (cleanFlashModels.length > 0 ? cleanFlashModels : availableModels).slice(0, 6).join(', ');
      throw new Error(`Models attempted: [${candidateModels.join(', ')}]. Available on key: [${availableSnippet}]. Last error: ${lastErrorText}`);
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
    let finalSanitizedSegments: any[] | undefined = undefined;

    if (simulateBroken) {
      finalValidationError = 'Simulated broken model reply';
    } else {
      try {
        // Attempt 1
        const attempt1 = await callGemini(contents);
        const val1 = validateParseResult(attempt1.parsed, entry.window_start, entry.window_end, categories, {
          onVacation,
          companyUsed,
        });

        if (val1.valid) {
          parseResult = attempt1.parsed;
          finalSanitizedSegments = val1.sanitizedSegments;
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
          const val2 = validateParseResult(attempt2.parsed, entry.window_start, entry.window_end, categories, {
            onVacation,
            companyUsed,
          });

          if (val2.valid) {
            parseResult = attempt2.parsed;
            finalSanitizedSegments = val2.sanitizedSegments;
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
    const segmentsToUse = finalSanitizedSegments || parseResult.segments || [];
    const newSegments = segmentsToUse.map((seg) => ({
      entry_id: entry.id,
      user_id: entry.user_id,
      start_time: seg.start_time,
      end_time: seg.end_time,
      activity_label: seg.activity_label.trim().toLowerCase(),
      category: seg.category.trim().toLowerCase(),
      company: Array.isArray(seg.company) ? seg.company : [],
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

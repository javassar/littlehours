# Milestone 3.8: Demo mode with per-visitor sandboxes

This file extends `SPEC.md`, `SPEC-3.7.md`, and `SPEC-3.7.md`. Milestones 1.1 to 3.7 are finished. Do not edit any earlier spec file. Build only milestone 3.8 from this file, and follow the standing rules in `AGENTS.md`.

Before writing any code, read the earlier specs and the current code for login, row-level security, the Edge Functions (`parse-entry`, `send-reminders`), Settings, and History. Where the existing code differs from the specs, follow the code and mention the difference in your summary. Where this file conflicts with an earlier spec, this file wins.

## Goal

Add a "Try the demo" button to the Login screen. A visitor who taps it gets their own temporary account, filled with a week of invented sample data. They can log entries, edit and delete, rate pain, and use the AI parsing. Their changes are private to them and deleted after 7 days. My real account and my real data are never visible to them.

This is for portfolio visitors, so it must show the whole app while staying safe: no access to my data, no runaway AI costs, no bot flood, and no stale accounts piling up.

## Design decisions

These are settled. Do not change them without telling me.

1. **Each visitor gets a separate account** through Supabase anonymous sign-ins. There is no shared demo account and no shared state between visitors.
2. **All demo data is invented.** Nothing is copied or derived from my account, including the sample pain ratings and the names of people.
3. **My account stays single-user.** Normal email sign-ups stay closed. Only anonymous sign-ins are added.
4. **AI parsing works in the demo**, with strict limits and a separate Gemini API key.
5. **Demo accounts and their data are deleted 7 days after creation**, or immediately when a visitor taps "Exit demo".
6. **Push reminders do not exist in the demo.** The server blocks them, not only the interface.
7. **Demo detection uses the verified token.** On the server it is the `is_anonymous` claim in the caller's JWT. In the app it is `session.user.is_anonymous`. Never trust a value sent in a request body.
8. **Anonymous users use the `authenticated` database role**, the same as me, so row-level security must separate them by `user_id` and by the `is_anonymous` claim. Treat every policy as something an outsider can reach.

## Order of setup (who does what)

Follow this order. Anonymous sign-ins stay switched off until step 5, so nothing is exposed while the code is being built.

1. **Agent:** Step 0, the security audit. Report findings and fix any problems.
2. **Agent:** write the migration and the Edge Functions. Show me the migration and ask before running it.
3. **Agent:** build the app changes (Steps 4, 5, 7) and the limits in `parse-entry` (Step 6).
4. **Me:** create a Cloudflare Turnstile site (free) and a second Gemini API key from a separate Google AI Studio project. The agent tells me exactly where to paste each value.
5. **Me, when the agent says so:** in the Supabase dashboard, turn on CAPTCHA protection with the Turnstile secret, then turn on Anonymous sign-ins. The agent tells me where these settings are in the current dashboard, and which rate limit setting to check.
6. **Agent:** run the isolation tests (Step 10) against the deployed project and report each result.

## Step 0: Security audit

Before any change, audit the current database and functions, and report the result in your summary.

1. List every table, every row-level security policy, every view, and every database function in the `public` schema. Confirm each table has row-level security enabled.
2. Confirm every policy limits rows to the caller with `user_id = auth.uid()` and has a matching `with check`. Flag any policy that uses `using (true)`, is granted to a broad role, or reads another user's rows. Fix anything flagged.
3. List every Edge Function and say which ones use the service role key. For each one that does, confirm it only touches rows belonging to the caller, or skips anonymous users.
4. Confirm that no function that calls the Gemini API reads `pain_ratings`, as required in `SPEC-3.7.md`.
5. Confirm normal email sign-ups are closed, and describe how you checked.

## Step 1: Migration

Write a migration in `supabase/migrations/` and tell me how to apply it. Show me the migration before running it, and ask before running it. All changes are additive, except the policy replacement below.

1. Usage counters. Neither table gets any policy for the `authenticated` role, so only the service role can read or write them.

```sql
create table demo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  parse_count int not null default 0,
  reset_count int not null default 0,
  primary key (user_id, usage_date)
);

create table demo_global_usage (
  usage_date date primary key,
  parse_count int not null default 0
);

alter table demo_usage enable row level security;
alter table demo_global_usage enable row level security;
```

2. A function `increment_demo_usage(p_user uuid, p_user_cap int, p_global_cap int)`, callable only by the service role. It uses the current UTC date. In one atomic operation, it checks both counters. If the user's count or the global count is already at its cap, it increments nothing and returns `allowed = false` with `scope` set to `user` or `global`. Otherwise it increments both counters and returns `allowed = true`, plus the new counts.
3. A function `delete_expired_demo_users(retention interval default interval '7 days')`, callable only by the service role and the database owner. See Step 9 for what it deletes.
4. Replace the existing policy on `push_subscriptions` so that anonymous users cannot insert rows. Keep its `user_id = auth.uid()` condition and add this to the `with check` clause: `coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false`.
5. Do not add `on delete cascade` to any of my existing tables' foreign keys. The cleanup function deletes demo rows explicitly, so deleting a user by accident can never wipe my real data.

## Step 2: Demo configuration

Create one shared constants file for the Edge Functions (`supabase/functions/_shared/demoConfig.ts`) and a matching file for the app (`src/lib/demoConfig.ts`), with a comment in each saying they must match.

| Constant | Value |
| --- | --- |
| `DEMO_RETENTION_DAYS` | 7 |
| `DEMO_PARSES_PER_USER_PER_DAY` | 15 |
| `DEMO_PARSES_PER_DAY_GLOBAL` | 300 |
| `DEMO_MAX_TEXT_CHARS` | 500 |
| `DEMO_MAX_FOLLOWUP_CHARS` | 200 |
| `DEMO_RESETS_PER_DAY` | 3 |

## Step 3: The `seed-demo` Edge Function

Create `supabase/functions/seed-demo`. The app calls it right after a visitor signs in.

1. It identifies the caller only from the verified JWT. If the token is missing, invalid, or has `is_anonymous` not equal to true, return 403 and write nothing. This is what stops anyone from seeding sample data into my real account.
2. Input: `{ "timezone": "America/Los_Angeles", "reset": false }`. Validate the time zone with `Intl.DateTimeFormat`, and fall back to `America/Phoenix` if it is invalid.
3. Idempotent: if the caller already has any entries and `reset` is false, do nothing and return `{ "seeded": false }`.
4. When `reset` is true, first check `reset_count` in `demo_usage` against `DEMO_RESETS_PER_DAY` (return 429 if over), then delete the caller's rows from `pain_ratings`, `segments`, and `entries`, then seed again.
5. Use the service role to write, and set `user_id` to the caller's ID from the token, never from the request.
6. Create the caller's `settings` row with their time zone, `vacation_mode` false, and the 25 categories with descriptions from `SPEC-3.7.md`. Load the category list from a single JSON file shared with the rest of the code, so it stays in sync.
7. Generate 7 days of data in the visitor's time zone: six full days and today. Today's entries stop about 90 minutes before the current time, so the Log screen opens with a sensible default start time. The first entry of each day starts at the previous day's last window end (a morning entry that covers sleep).
8. Each day has 8 to 11 entries covering waking hours, written in the same voice as a real log. Every entry is stored as already parsed: `parse_status = 'parsed'`, with segments inserted directly (so seeding calls no AI), `confirmed = true`, `model = 'seed'`, and `prompt_version = 'seed'`. Segment times must be contiguous inside each entry's window.
9. Author the days from 3 templates (a working weekday, a weekend with an event, and a day with a vacation, where `on_vacation` is true and every segment is "vacation"), varied so no two days are identical. Together the week must use at least 15 of the 25 categories, including doomscrolling, social media, events, piano, hobbies, admin, and healthcare, and must show company on some segments.
10. Use invented names for people, such as "roommate", "Sam", "Priya", and "Dana". Do not use "mom", "Gray", or any name from my real data.
11. Add invented pain ratings: one per hourly entry on most days, linked by `entry_id`, plus 3 or 4 rating-only saves. Follow `SPEC-3.7.md` (each rating describes the hour ending at `rated_at`). Make the pattern plausible but plain, with ratings between 1 and 4, mostly 2 and 3.
12. Keep the authored data in `supabase/functions/seed-demo/data.ts`, easy to read and edit. Here are sample entries for the voice:

| Raw text | Segments |
| --- | --- |
| woke up, scrolled pinterest for 20 minutes, then made breakfast and ate | social media, functional meals |
| worked on the portfolio write-up the whole hour | professional development |
| doomscrolled on tiktok because i was avoiding the dishes | doomscrolling |
| drove to the dentist and had my cleaning | healthcare (label starts "driving to dentist") |
| ballet with Priya and Sam | events, company ["Priya", "Sam"] |
| piano practice for 40 minutes, then texted my roommate | piano, texting |

13. In your summary, list the categories used in the seed data and the number of entries, segments, and ratings it creates.

## Step 4: "Try the demo" on the Login screen

1. Below the password form, add a secondary button, "Try the demo", in the style of the Design section of `SPEC.md`. Under it, add one line of small text: "Sample data only. Entries you type are read by an AI service, so please do not enter personal information."
2. Tapping the button runs Turnstile (Step 8), then `supabase.auth.signInAnonymously({ options: { captchaToken } })`, then calls `seed-demo` with the browser's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), then opens the Log screen.
3. While this runs, show a full-screen loading state with the rotating sparkle and the text "Setting up your sandbox".
4. If a visitor already has an anonymous session, skip the sign-in and the seeding, and open the Log screen.
5. Error messages are gentle, one sentence, with no exclamation marks. For a rate limit or CAPTCHA failure: "The demo is busy right now. Please try again in a few minutes." For any other failure: "I couldn't set up the demo. Please try again."
6. If an anonymous visitor's session stops working because the cleanup job deleted their account, sign them out, return to Login, and show "Your demo session ended."
7. My normal login must keep working exactly as before.

## Step 5: The demo experience in the app

1. **Banner.** While `session.user.is_anonymous` is true, show a slim ribbon below the header on every screen, in `--lavender` with `--ink` text, Lora italic 15 px: "Demo with sample data. Your changes are private and deleted after 7 days." It cannot be dismissed. It has an "Exit demo" button on the right.
2. **Exit demo.** It asks "Exit the demo? Your sandbox will be deleted." On yes, call a `delete-demo-account` Edge Function that, after verifying `is_anonymous` from the token, deletes the caller's rows from `pain_ratings`, `segments`, `entries`, `settings`, and `demo_usage`, and then deletes the auth user. Then sign out and show the Login screen. If the function fails, sign out anyway and let the cleanup job handle it.
3. **Hidden in the demo:** the Reminders section of Settings, the "Turn on reminders" button and its install prompt, the "Re-read all entries" button, and the Log out button (replaced by Exit demo).
4. **Added in the demo:** a "Reset sample data" button in Settings that calls `seed-demo` with `reset: true`, with a confirmation, and shows the remaining resets for the day.
5. **Text limits.** In the demo, the Log text box shows a character counter and stops at `DEMO_MAX_TEXT_CHARS`. Follow-up answers stop at `DEMO_MAX_FOLLOWUP_CHARS`.
6. **AI limit state.** When a parse comes back with a `demo_limit` error (Step 6), keep the entry saved with `parse_status = 'pending'`, and show on its card: "Not read: demo limit reached." There is no Try again button for these. The sample days still show how a read entry looks.
7. **Everything else works as it does for my account:** logging, editing, deleting, History, categories, people, vacation mode, pain ratings, and export.

## Step 6: Limits in `parse-entry`

Change `supabase/functions/parse-entry` so that anonymous callers are limited and use a separate key.

1. Read `is_anonymous` from the verified JWT. This one flag decides which path runs.
2. For anonymous callers:
   - Reject the request with 400 and `{ "error": "too_long" }` if `raw_text` is longer than `DEMO_MAX_TEXT_CHARS`, or if any follow-up answer is longer than `DEMO_MAX_FOLLOWUP_CHARS`.
   - Call `increment_demo_usage` with the two caps. If `allowed` is false, return HTTP 429 with `{ "error": "demo_limit", "scope": "user" | "global" }`, and make no Gemini call.
   - Use the `GEMINI_API_KEY_DEMO` secret. If that secret is missing, return an error. Never fall back to my real key.
3. For non-anonymous callers (me), nothing changes. They use `GEMINI_API_KEY`.
4. A validation retry inside one `parse-entry` invocation counts as part of that invocation, not as an extra use.
5. Log the key scope used (`demo` or `owner`), never the key, and never the entry text or follow-up text.
6. The prompt, the model setting (`GEMINI_MODEL`), and the validation stay the same.

## Step 7: Keep reminders away from demo users

1. In `send-reminders`, skip any user whose auth record has `is_anonymous = true`, and log "skipped: demo user".
2. Confirm that the policy change in Step 1 blocks an anonymous user from inserting into `push_subscriptions`.

## Step 8: Bot protection

1. Add the Cloudflare Turnstile widget to the "Try the demo" flow. It runs in managed or invisible mode. The site key comes from `VITE_TURNSTILE_SITE_KEY`. The secret key goes only into the Supabase dashboard's CAPTCHA settings, never into code.
2. Check the current Supabase documentation. When CAPTCHA protection is turned on, sign-in calls for my normal email login may also need a token. Add the same Turnstile token to my normal login so that it keeps working, and tell me what you found.
3. Tell me where in the Supabase dashboard I can see and adjust the rate limit for anonymous sign-ins, and what its current default is.
4. For local development and tests, use Cloudflare's published test keys, and explain how.

## Step 9: Cleanup job

1. `delete_expired_demo_users(retention)` selects users where `auth.users.is_anonymous` is true and `created_at` is older than the retention. For those users it deletes the rows from `pain_ratings`, `segments`, `entries`, `push_subscriptions`, `settings`, and `demo_usage`, in that order, and then deletes the users from `auth.users`. It returns the number of users deleted. It only touches anonymous users and never a permanent one.
2. Also delete `demo_usage` rows older than 14 days and `demo_global_usage` rows older than 30 days.
3. Schedule it daily at 03:00 UTC with `pg_cron`, the same way as the reminders job. Tell me how to see the job's run history.
4. Test it: create a test anonymous user with data, backdate its `created_at` past the retention using the service role, run the function, and confirm that all of its rows and the user are gone, and that my real account's row counts are unchanged.

## Step 10: Isolation tests

Write an automated test script (`scripts/test-demo.ts`, with a README note on how to run it) and run it against the deployed project after the setup in step 5. Report each result. Use Turnstile's test keys, or another safe way to create anonymous test users, and explain which you used.

1. A new anonymous user, after seeding, sees only its own rows. The count of rows it can read in each table matches the seed data, and none belongs to my user ID.
2. An anonymous user cannot insert a row with someone else's `user_id`.
3. An anonymous user cannot read or write `demo_usage` or `demo_global_usage`.
4. An anonymous user cannot insert into `push_subscriptions`.
5. `seed-demo` returns 403 when called with my real token, and my data is unchanged afterward.
6. `seed-demo` called twice for the same anonymous user seeds once.
7. `parse-entry` called by an anonymous user uses the demo key (check the logged key scope), and rejects over-long text with `too_long`.
8. The 16th parse call from one anonymous user in a day returns 429 `demo_limit` with scope `user`, and makes no Gemini call.
9. With the global counter set to its cap, any anonymous parse call returns 429 with scope `global`.
10. `send-reminders` skips an anonymous user.
11. `delete-demo-account` called with my real token returns 403 and deletes nothing.

## Step 11: README and portfolio notes

Add a "Live demo" section to `README.md`:

1. A short description of the demo and a placeholder for the live URL.
2. A "How the demo is protected" list covering row-level security, the verified `is_anonymous` claim, the AI usage caps, the separate Gemini key, Turnstile, the cleanup job, and the isolation tests.
3. The environment variables and secrets added in this milestone.
4. A note on the privacy choice: demo text goes to the Gemini API, and visitors are told not to enter personal information.

## Environment variables added

| Name | Where it lives | Reaches the browser |
| --- | --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | `.env.local` and Vercel | Yes |
| `GEMINI_API_KEY_DEMO` | Supabase function secret | No |
| Turnstile secret key | Supabase dashboard (CAPTCHA settings) | No |

Update `.env.example` with the new names.

## Check

- [ ] Step 0's audit is in the summary, with every flagged item fixed or explained.
- [ ] The migration applies cleanly. My real account's data and login still work.
- [ ] Tapping "Try the demo" produces a sandbox with 7 days of sample data in the visitor's time zone, and opens the Log screen with a sensible default start time.
- [ ] The banner shows on every screen in the demo and nowhere in my real account.
- [ ] In the demo, I can log, edit, delete, and rate pain, and the AI reads a new entry.
- [ ] The Reminders section, the Re-read button, and the Log out button are hidden in the demo.
- [ ] A new entry over 500 characters is stopped by the counter, and the server also rejects it.
- [ ] After 15 parses in a day, the next entry saves but shows "Not read: demo limit reached."
- [ ] "Reset sample data" restores the seed data and stops after 3 uses per day.
- [ ] "Exit demo" removes the sandbox and the auth user.
- [ ] The cleanup test passes and my row counts are unchanged.
- [ ] My normal email login works with CAPTCHA turned on.
- [ ] Normal email sign-ups are still closed.
- [ ] All 11 isolation tests pass, or each failure is listed with its actual output.
- [ ] No key or secret appears in any file that ships to the browser, and no function logs entry text.
- [ ] The README has the "Live demo" section.

## Notes

- Show me the migration before running it, and ask before running it.
- Tell me when to switch on CAPTCHA and anonymous sign-ins, and do not assume I have done it.
- Propose one git commit message at the end, such as "Milestone 3.8: demo mode with per-visitor sandboxes", and wait for my yes.
- Update `README.md` as described in Step 11.

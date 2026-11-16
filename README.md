# Little Hours

A personal progressive web app (PWA) for logging how you spend your time in natural language.

## Design Philosophy

Little Hours is designed with a soft pink storybook aesthetic:
- **Palette**: Dusty rose, blush, mauve, deep plum ink, with quiet sage, slate, and lavender category accents.
- **Paper & Embossing**: Cream surface cards with subtle depth, letterpress sunk inputs, and fixed SVG paper noise.
- **Storybook Flourishes**: Scalloped lace header edge, double-ruled ornamental card frames, four-point gold sparkles, and hand-drawn line art illustrations (swan, deer, hummingbird, flower sprig, sparkles).
- **Typography**: Cormorant Garamond for display and headings; Lora (17px) for body and inputs.
- **No Emojis**: Hand-drawn thin-line SVGs only.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
Open your browser to `http://localhost:5173/`.

To build and preview locally:
```bash
npm run build
npm run preview
```

---

## Deploying to Vercel

1. **Push your code to GitHub**:
   Ensure all changes are committed and pushed to your GitHub repository on `main`.

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
   - Click **Add New...** → **Project**.
   - Select your `littlehours` repository and click **Import**.

3. **Configure Project**:
   - **Framework Preset**: Vite (detected automatically).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables**:
   In the **Environment Variables** section on Vercel, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (e.g. `https://xyzcompany.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Publishable / `anon` public key

   *(Do NOT add `service_role` secret keys to Vercel).*

5. **Deploy**:
   Click **Deploy**. Vercel will build the project and assign a custom HTTPS domain (e.g., `https://littlehours.vercel.app`). The included `vercel.json` ensures all route paths (`/history`, `/settings`, `/login`) cleanly rewrite to `index.html`.

---

## Installing on iPhone (PWA)

1. Open your deployed HTTPS URL in **Safari** on your iPhone.
2. Log into Little Hours.
3. Tap the Safari **Share** button (box with arrow pointing up).
4. Tap **Add to Home Screen**.
5. Tap **Add** in the top right corner.
6. Open the app from your home screen. It will open in full-screen standalone mode with no browser URL bar and the pink icon. The app shell is cached so it opens even in airplane mode.

---

## Environment Variables Reference

| Variable | Location | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` & Vercel | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` & Vercel | Supabase publishable anon public key |
| `GEMINI_API_KEY` | Supabase Vault / Secret | Google Gemini API key (Stage 2) |
| `GEMINI_MODEL` | Supabase Vault / Secret | Gemini model name (Stage 2) |
| `VITE_VAPID_PUBLIC_KEY` | `.env.local` & Vercel | Web Push VAPID public key (Stage 3) |
| `VAPID_PRIVATE_KEY` | Supabase Secret | Web Push VAPID private key (Stage 3) |
| `VAPID_SUBJECT` | Supabase Secret | Web Push contact `mailto:` address (Stage 3) |

---

## Project Status

### Stage 1: Core Logger (No AI)
- [x] **Milestone 1.1**: Scaffold, design tokens, shared components, `/design` page, and app shell.
- [x] **Milestone 1.2**: Supabase migration, authentication, password gate.
- [x] **Milestone 1.3**: Log screen and saving entries with draft persistence.
- [x] **Milestone 1.4**: History, day grouping (Arizona time), gaps/overlaps, editing, and deleting.
- [x] **Milestone 1.5**: Offline saving and sync via IndexedDB (`idb-keyval`).
- [x] **Milestone 1.6**: CSV & JSON export with date range filtering and RFC 4180 escaping.
- [x] **Milestone 1.7**: Installable PWA web app manifest, service worker shell precache, Safari banner, and Vercel deployment.

### Stage 2: AI Parsing
- [x] **Milestone 2.1**: Gemini AI parsing via Supabase Edge Function (`parse-entry`) with structured output validation.
- [x] **Milestone 2.2**: Non-blocking background parsing on save with rotating sparkle indicator and segment chips in History.
- [x] **Milestone 2.3**: Segment confirmation sheet with adjacent boundary adjustments and unconfirmed tags.
- [x] **Milestone 2.4**: Clarification follow-up questions with conversational roundtrip answers without touching raw text.
- [x] **Milestone 2.5**: Automatic segment overlap reconciliation (trimming and splitting) via transactional RPC.
- [x] **Milestone 2.6**: Category management (add, rename, reorder, delete protection), batch re-reading, and export with segments.

### Stage 3: Push Reminders & Intelligence
- [x] **Milestone 3.1**: VAPID keys, push subscription management, standalone PWA detection, and Settings UI.
- [x] **Milestone 3.2**: Service worker push event handling (`tag: 'hourly'` replacement) and notification click auto-focus (`/?focus=1`).
- [x] **Milestone 3.3**: Hourly sender Edge Function (`send-reminders`), quiet hours enforcement (8 AM - 11 PM), subscription pruning (404/410), and `pg_cron` schedule.
- [x] **Milestone 3.4**: Reminder schedule controls, 1-hour snooze support, test reminder trigger, and friendly next reminder calculations.
- [x] **Milestone 3.5**: Intelligent skip when user has logged within the last 30 minutes, with detailed logging of skip reasons.
- [x] **Milestone 3.6**: Categories, Company Field, and Vacation Mode:
  - **Database additions**: `segments.company text[]` with GIN index, `entries.on_vacation boolean`, `settings.vacation_mode boolean`, `settings.categories` updated to 25 objects with `{ name, description }`.
  - **AI Parser v2**: Prompt version `v2` in `parse-entry` with tie-break rules, company extraction with casing canonicalization, and `on_vacation` override.
  - **Vacation Mode Switch**: Persistent vacation toggle on Log screen with `--lavender` reminder ribbon and entry edit sheet toggle.
  - **Company & People Screen**: Outlined company chips on confirmation and history, in-place tag editing with autocomplete, and Settings People screen to view hours, rename/merge, and remove tags.
  - **Export Updates**: Segments CSV/JSON export includes `company`, entries include `on_vacation`, and export card shows Vacation hours for the filtered period.
- [x] **Milestone 3.7**: Hourly Pain Rating (1 to 5):
  - **Database additions**: `pain_ratings` table (`id`, `user_id`, `entry_id` references `entries(id) on delete set null`, `rating smallint 1..5`, `rated_at timestamptz`, `created_at`, `updated_at`) with RLS policy `"own ratings"`.
  - **Scale & Guide**: Fixed 1 to 5 anchors in `src/lib/painScale.ts` with modal guide sheet (`PainGuideSheet`).
  - **Rating Control**: Accessible radiogroup buttons with arrow navigation and clear-on-tap toggle (`PainRating`).
  - **Log Screen Integration**: Save text + rating together, or standalone rating in one tap without altering entry window start time.
  - **History Display**: "Pain X" pills on entry cards, compact cards for standalone ratings, and rating counts per day heading.
  - **Reminders Update**: Skip reminders when logged or rated pain within the past 30 minutes. Notification body asks to rate pain.
  - **Pain Ratings Export**: Dedicated CSV and JSON exports with client-side join in `src/lib/export.ts` computing lookback windows (60, 180, 1440 min) and unlogged time.
  - **Data Privacy**: Complete separation between health pain ratings and the AI parser (`parse-entry`).

---

## Data Model

### `pain_ratings` Table
```sql
create table pain_ratings (
  id uuid primary key,                         -- generated on the phone so offline retries never duplicate
  user_id uuid not null default auth.uid() references auth.users(id),
  entry_id uuid references entries(id) on delete set null,   -- kept if the entry is deleted
  rating smallint not null check (rating between 1 and 5),
  rated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pain_ratings_rated_at_idx on pain_ratings (rated_at desc);
create index pain_ratings_entry_id_idx on pain_ratings (entry_id);
create index pain_ratings_user_id_idx on pain_ratings (user_id);

alter table pain_ratings enable row level security;
create policy "own ratings" on pain_ratings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## Pain Ratings Export & Analysis Join

Pain ratings are exported via **Settings → Export pain ratings (CSV / JSON)**. The join between ratings, entries, and activity segments is performed entirely in client-side TypeScript (`src/lib/export.ts`) to maintain complete separation between private health data and database stored procedures or external APIs.

### Export Columns (18 fields)
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Rating ID |
| `rated_at` | ISO 8601 | End of the 60-minute hour being rated (UTC) |
| `local_rated_at` | String | Same time formatted in user's timezone |
| `hour_start` | ISO 8601 | `rated_at` minus 60 minutes |
| `rating` | Integer | Average pain rating over the hour (1 to 5) |
| `entered_at` | ISO 8601 | Actual timestamp when rating was submitted |
| `minutes_since_previous_rating` | Integer | Minutes elapsed since previous rating (empty for first; < 60 indicates overlapping rated hours) |
| `entry_id` | UUID | Associated entry ID (empty for standalone ratings) |
| `segment_category` | String | Category of the activity segment containing `rated_at` (`start_time <= rated_at < end_time`) |
| `segment_label` | String | Specific activity label of that containing segment |
| `segment_company` | String / Array | People in that segment (semicolon-separated in CSV, array in JSON) |
| `on_vacation` | Boolean | True if the containing segment/entry was marked as vacation time |
| `prior_60_min_by_category` | Object / JSON | Minutes per category in the 60 minutes before `rated_at` (same hour as rated) |
| `prior_180_min_by_category` | Object / JSON | Minutes per category in the 180 minutes before `rated_at` (3 hours) |
| `prior_1440_min_by_category` | Object / JSON | Minutes per category in the 1440 minutes before `rated_at` (24 hours) |
| `prior_60_unlogged_min` | Integer | Minutes in the 60m window not covered by any parsed segment |
| `prior_180_unlogged_min` | Integer | Minutes in the 180m window not covered by any parsed segment |
| `prior_1440_unlogged_min` | Integer | Minutes in the 1440m window not covered by any parsed segment |

### Join Methodology
1. **Containing Segment**: A segment contains `rated_at` when `start_time <= rated_at < end_time`.
2. **Lookback Windows**: For each lookback window `[rated_at - N minutes, rated_at]`, segments are clipped to the window boundaries. Overlapping minutes for each category are summed.
3. **Unlogged Time**: Unlogged minutes are computed as `N - total_covered_minutes`.
4. **Parsed Segments Only**: Only segments belonging to entries with `parse_status = 'parsed'` are counted. Unparsed or failed entries contribute zero minutes and are treated as unlogged.

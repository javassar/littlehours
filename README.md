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

### Stage 3: Push Reminders
- [x] **Milestone 3.1**: VAPID keys, push subscription management, standalone PWA detection, and Settings UI.
- [x] **Milestone 3.2**: Service worker push event handling (`tag: 'hourly'` replacement) and notification click auto-focus (`/?focus=1`).
- [x] **Milestone 3.3**: Hourly sender Edge Function (`send-reminders`), quiet hours enforcement (8 AM - 11 PM), subscription pruning (404/410), and `pg_cron` schedule.
- [x] **Milestone 3.4**: Reminder schedule controls, 1-hour snooze support, test reminder trigger, and friendly next reminder calculations.
- [x] **Milestone 3.5**: Intelligent skip when user has logged within the last 30 minutes, with detailed logging of skip reasons.

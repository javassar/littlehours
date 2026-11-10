# Little Hours

A personal progressive web app (PWA) for logging how you spend your time in natural language.

## Design Philosophy

Little Hours is designed with a soft pink fairy-tale aesthetic:
- **Palette**: Dusty rose, blush, mauve, deep plum ink, with quiet sage, slate, and lavender category accents.
- **Paper & Embossing**: Cream surface cards with subtle depth, letterpress sunk inputs, and fixed SVG paper noise.
- **Storybook Flourishes**: Scalloped lace header edge, double-ruled ornamental card frames, four-point gold sparkles, and hand-drawn line art illustrations (swan, deer, hummingbird, flower sprig, sparkles).
- **Typography**: Cormorant Garamond for display and headings; Lora (17px) for body and inputs.

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
Open your browser to `http://localhost:5173/` (or the port shown in your terminal).

To preview the production build:
```bash
npm run build
npm run preview
```

---

## Route Overview

- `/` — **Log Screen**: The main check-in screen (Milestone 1.3).
- `/history` — **History Screen**: Chronological log entries with empty state (Milestone 1.4).
- `/settings` — **Settings Screen**: Preferences, push reminders, snooze, and export (Milestone 1.6 & Stage 3).
- `/login` — **Login Screen**: Authentication with swan illustration (Milestone 1.2).
- `/design` — **Design System**: Visual showcase of all colors, typography, buttons, cards, chips, illustrations, and animations.

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development:
```bash
cp .env.example .env.local
```

| Variable | Location | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` / Vercel | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` / Vercel | Supabase anonymous public key |
| `VITE_VAPID_PUBLIC_KEY` | `.env.local` / Vercel | Web Push VAPID public key |
| `GEMINI_API_KEY` | Supabase Secret | Google Gemini API key (server only) |
| `GEMINI_MODEL` | Supabase Secret | Model name (e.g. Gemini 2.5 Flash) |
| `VAPID_PRIVATE_KEY` | Supabase Secret | Web Push VAPID private key |
| `VAPID_SUBJECT` | Supabase Secret | `mailto:` contact address for push notifications |

---

## Status

- **Stage 1: Core Logger**
  - [x] **Milestone 1.1**: Scaffold, design tokens, shared components, `/design` page, and app shell.
  - [ ] **Milestone 1.2**: Supabase migration, authentication, password gate.
  - [ ] **Milestone 1.3**: Log screen and saving entries.
  - [ ] **Milestone 1.4**: History, editing, and deleting.
  - [ ] **Milestone 1.5**: Offline saving and sync via IndexedDB.
  - [ ] **Milestone 1.6**: CSV & JSON export.
  - [ ] **Milestone 1.7**: Installable PWA manifest & Vercel deployment.

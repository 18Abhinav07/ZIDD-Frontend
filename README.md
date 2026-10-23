# Zidd Frontend

The web app for **Zidd**, an AI English coach for learners in India. Learners sign in with Google, take a short placement, and then practise with a coach that replies in real time:

- **School**: NCERT-aligned English for Classes 2–5, with chapter maps, a placement diagnostic, teaching sessions, recaps, and reports for parents.
- **Career**: communication drills, mock interviews and group-discussion simulations.

| | |
|---|---|
| **Live app** | https://zidd.onrender.com |
| **Backend** | [ZIDD-Backend](https://github.com/18Abhinav07/ZIDD-Backend), live at https://zidd-api.onrender.com |
| **Stack** | Next.js 14 (App Router) · React 18 · TypeScript · NextAuth v4 · Tailwind CSS 4 · Framer Motion · Playwright |

> The free Render tier sleeps when idle. The app checks backend readiness before letting a learner in, so the first visit after a quiet period shows a short wake-up state instead of an error.

---

## At a glance

| | |
|---|---|
| Source | 146 files under `src/`, App Router with route groups for School, Career and the simulators |
| Tests | 43 test files in `tests/` plus 21 contract check scripts in `scripts/`; Playwright browser suites for the School flows |
| Auth | Google sign-in via NextAuth, session gate in edge middleware, cookie policy module with its own tests |
| Streaming | Server-Sent Events proxied through a Next route handler, consumed by a lifecycle-tested SSE client |

---

## Architecture

```
Browser ──▶ Next.js middleware ──▶ page / route handler ──▶ ZIDD-Backend
             │  session check          │
             │  profile gate           ├─ /api/auth/*     NextAuth (Google)
             │  (onboarded? school     ├─ /api/session/*  streaming proxy (SSE, 402 bodies kept)
             │   or career?)           ├─ /api/school/*   School route handler
             │                         └─ /api/*          rewrite → BACKEND_INTERNAL_URL
```

Design decisions worth knowing:

- **Backend traffic goes through the Next server.** Browsers only ever talk to one origin, so the backend URL never reaches client code and CORS stays simple. A guard script (`check-no-product-local-storage`) fails if product state is written to browser storage outside the one allowed module.
- **Streaming has its own route handler.** Generic rewrites time out on long streams and flatten error bodies, so `/api/session/*` is handled explicitly. It streams tokens as they arrive and preserves structured `402` bodies, which the paywall UI relies on.
- **Middleware owns the entry gate.** It verifies the session, fetches the learner's profile (cached 30 s, bounded to 500 entries) and routes them to onboarding, School or Career. Expired or invalid auth clears stale cookies instead of looping.
- **Idempotent and guarded streams.** Session start carries a `client_start_id`, so a retried request can't open two sessions. Dedicated checks cover double-submit, stream lifecycle, abort handling and pending-answer UI states.
- **Pure policy modules.** School activity, onboarding, request and teaching-presentation rules live in small side-effect-free modules (`*Policy.ts`), each with unit tests, so UI components stay thin.
- **Billing is a switch.** `NEXT_PUBLIC_BETA_BILLING_DISABLED=1` hides credits, paywall and checkout entirely; a presentation test pins both modes.

---

## Project layout

```
src/
  app/
    auth/                 Login (Google)
    onboarding/           First-run flow and welcome
    school/               classes · placement · curriculum · masterclass · recap
                          · support · readiness · reports · parent · session
    career/ · simulator/  Communication, interview and group-discussion practice
    (gamified)/           Map and mode select
    api/                  NextAuth · session streaming proxy · school proxy
  components/             cards · tutor · simulator · billing · shared
  hooks/                  Session state (useZiddSession)
  services/               API client, SSE client, billing, authenticated fetch
  lib/                    Auth cookie policy, avatars, emotion, school policies
  middleware.ts           Session and profile gate
tests/                    Node test runner and Playwright specs
scripts/                  Contract checks and the browser test runner
docs/                     QA notes and integration records
```

---

## Run locally

Requires Node 20+ and a running [ZIDD-Backend](https://github.com/18Abhinav07/ZIDD-Backend).

```bash
npm ci
cp .env.example .env.local     # fill in the values below
npm run dev                    # http://localhost:3000
```

### Configuration

| Variable | Purpose |
|---|---|
| `BACKEND_INTERNAL_URL` | Backend base URL reachable from the Next server. **Required at build and run time.** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials. The secret is server-only. |
| `NEXTAUTH_URL` | Public URL of this app |
| `NEXTAUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_BETA_BILLING_DISABLED` | `1` hides credits, paywall and checkout |
| `NEXT_PUBLIC_SCHOOL_QWEN_UNBOUNDED` | `1` lifts request deadlines; use only with the local Qwen backend |

The backend's `CORS_ALLOWED_ORIGINS` must include this app's origin.

### Tests

```bash
npm run lint
npm run test:auth-middleware
npm run test:session-stream-guards
npm run test:sse-client-lifecycle
npm run test:school-activity-policy
npm run test:school-browser          # Playwright; needs backend and browsers installed
```

`package.json` lists every suite (auth flow, cookie policy, session proxy, billing presentation, School placement and teaching UX, simulator runtime safety).

---

## Deploy

This is a Node server app (NextAuth handlers, streaming proxy and middleware need a server runtime), so deploy it to a host that runs Next.js natively: Render, Vercel or any Node container.

1. Set the variables above. `BACKEND_INTERNAL_URL` must point at the deployed backend.
2. Build with `npm ci && npm run build`, start with `npm start`.
3. Add the app's origin to the backend's `CORS_ALLOWED_ORIGINS` and to the Google OAuth client's authorised redirect URIs (`<NEXTAUTH_URL>/api/auth/callback/google`).

Images are served unoptimised (`images.unoptimized`), which keeps memory low enough for 512 MB instances.

---

## Related

- Backend: [ZIDD-Backend](https://github.com/18Abhinav07/ZIDD-Backend): engine, curriculum, API contract and SSE protocol

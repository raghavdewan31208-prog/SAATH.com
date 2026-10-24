# Saath — evening travel and emergency companion

A mobile-first, installable React + TypeScript PWA for planning evening journeys, sharing a trip with trusted contacts, and reaching help deliberately. The name means “together” / “with company”.

Saath is a working product demo, **not an emergency service**. It cannot dispatch police or an ambulance, guarantee safety, or confirm that help is coming. The device’s own emergency dialler is always kept available.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm test             # deterministic domain tests (Vitest)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build to dist/
npm run preview      # production build with the API middleware, port 4173
```

The app runs with **no credentials at all**. With no AI provider configured, every AI surface uses a clearly labelled deterministic simulation. No key is ever required to complete the demo.

### Preview in this cloud workspace

`vite` binds to `0.0.0.0`. If the host validates the Host header, start it with the preview hostname:

```bash
PREVIEW_HOST=pv-…style.dev npm run dev
```

The dev server and `vite preview` both serve `/api/*` through the small middleware in [`server/vitePlugin.ts`](server/vitePlugin.ts).

---

## What is real, what is simulated

### Working features

- Eight-step onboarding: display name, language, trusted contacts (manual add/edit/remove/priority), SOS action choices, check-in interval, escalation and information-sharing preferences.
- English/Hindi interface, light/dark/system theme, installable PWA manifest, icons and an offline app shell.
- **Journey planning** with a live Leaflet map:
  - Demo area (Koramangala, Bengaluru) compares two sample evening routes and their lighting, walkway, activity, transport and incident observations.
  - Outside the demo area, live road alternatives, distances and travel times come from the public **OSRM demo server**; map tiles come from OpenStreetMap/ CARTO.
  - Every observation displays its source, age, confidence and moderation state. Unavailable conditions are shown as **Unknown**, never as “safe”.
  - Route recommendations are produced by visible deterministic rules, with a written reason. Missing incident reports are explicitly not treated as evidence of safety.
- **Journey Mode** with progress, ETA, latest simulated location and timestamp, sharing recipients, pause/resume, check-ins (“I’m okay”, “update my journey”, “I need help”), notes, end journey and immediate sharing revocation.
- Deterministic check-in triggers (deviation, unexpected stop, overdue, scheduled), one pending check-in at a time, deduplicated alerts, and a single bounded escalation.
- **SOS** behind a 3-second hold or an optional two-step arm/confirm mode. Actions have separate states: pending, sent, delivered (simulated), calling, unanswered, acknowledged, failed.
- **Simulated AI assistant call** in English or Hindi, constrained to authorised facts, with explicit acknowledgement detection, no-answer and retry paths, device speech support and no cloud voice requirement.
- **Simulated emergency-operator conversation**, labelled “Demo — no emergency service contacted”.
- Trusted contacts with priority order, per-contact sharing permissions, AI-call consent, edit/remove, and immediate contact-list deletion.
- Simulated sharing links with unguessable tokens, automatic expiry, preview of what each recipient may see, and immediate revocation. No public map of users exists.
- Anonymous community reports with a moderation queue; only approved reports appear publicly or can influence route observations. Phone numbers and emails are redacted in previews.
- Honest integration status: unconfigured services show “Not configured”, never “connected”.
- Offline, loading, empty, permission-denied, routing-failure, stale-location and unanswered-call states.
- Data controls: clear activity, delete individual reports, and “delete all local data”. No logs of contact data, locations or request bodies.

### Simulations (clearly labelled in the app)

- Location updates in Journey Mode are simulated along the selected route. Real device location is read only when the user taps “Use my current location” or enables approximate report location.
- Sharing links, delivery receipts, AI calls and operator conversations are local simulations. No SMS, WhatsApp, phone call or map link is actually sent.
- The **demo dataset** for Koramangala is fictional: routes, observations, incidents, contacts and phone numbers are invented for demonstration. The map tiles themselves are real.
- In demo/offline conditions, route reasoning uses the sample dataset. There is no live crowd measurement, crime probability or lighting feed.
- Device speech synthesis/recognition is used when available; otherwise the call is a readable, labelled transcript.
- A local rules assistant provides report interpretation and duplicate suggestions when no provider is configured. It is labelled “On-device rules”, not AI.

### Future integrations (not implemented)

- A secure sharing backend with signed, expiring links and real recipient delivery/read receipts.
- Real SMS/WhatsApp/push delivery, push notifications and background location (neither is possible in this PWA today).
- A production incident/lighting data source, geocoding and place search, and crowd-sourced moderation at scale.
- An authorised voice-agent provider that permits this use case. **AI-to-emergency-service communication is a future authorised integration only**; it is not supported, claimed or simulated as real.
- Accounts, encrypted server-side storage, multi-device sync and audited operator tooling.

---

## Environment variables

Copy `.env.example` to `.env` (git-ignored) if you want live provider responses. These are **server-only** variables; never prefix them with `VITE_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SAATH_AI_BASE_URL` | No | OpenAI-compatible base URL, e.g. `https://api.example.com/v1`. |
| `SAATH_AI_API_KEY` | No | Server-side provider key. Never shipped to the browser. |
| `SAATH_AI_MODEL` | No | Model identifier permitted for this use case. |
| `SAATH_AI_PROVIDER_LABEL` | No | Human-readable provider name in Settings/integration status. |
| `PREVIEW_HOST` | No | Optional exact hostname for Vite’s dev/preview allowlist. |

With all three AI variables present, `/api/ai/agent`, `/api/ai/report` and `/api/ai/route-explain` call the provider. Without them, those routes return `503` and the UI falls back to simulation. The server also rate-limits requests, enforces same-origin mutations, rejects oversized bodies, sanitises facts, validates provider actions/categories/duplicate IDs, and rejects responses that claim emergency dispatch, help on the way, a location when none exists, or a guaranteed-safe route.

Provider calls are a demonstration path, not a production voice/SMS integration. `vite preview` serves the API for local production checks; a static-only host would need those handlers deployed to a serverless/Worker endpoint (the handlers are web-standard `Request`/`Response` in [`server/api.ts`](server/api.ts)).

---

## Guided demo

Open **Home → Run demo** (bottom shortcut or `/demo`). The walkthrough checks real app state, not a slide deck.

1. Tap **Load demo data** — fictional contacts and reports.
2. **Open comparison → Compare routes** — compare the two sample routes and read the reasons, sources and freshness.
3. **Start journey** — begins Journey Mode and a simulated sharing session.
4. **Simulate deviation** — raises exactly one check-in, never a danger classification.
5. **Open check-in** — choose “I’m okay”, “update my journey” or “I need help”.
6. **Open SOS → hold “Hold to activate SOS”** for three seconds.
7. **Open sharing** — watch the simulated action advance and inspect the recipient preview.
8. **Open AI call → Start simulated call** — the assistant identifies itself, states the alert, and answers from authorised facts.
9. Reply as the contact with “I acknowledge the alert” to record an acknowledgement, or use **Simulate no answer**.
10. **End journey** — revokes the sharing session immediately.

The Demo screen also contains explicit edge-case controls: permission denial, network loss, unanswered calls, and reset/clear data.

### Edge cases worth trying manually

- Deny location when picking “Current”, then use saved places or coordinates — manual travel still works.
- Open the assistant call, then **Simulate no answer** — the action stays unanswered; no delivery is claimed.
- End a journey — open **Sharing** and confirm the session is revoked.
- Toggle **Simulate network loss**, then compare routes outside the demo area — an explicit offline failure appears.
- Submit a report with an obvious phone number, then approve it in the moderation queue — the public preview redacts the number.
- Switch to Hindi in Settings; switch between light, dark and system themes.
- Revoke a share link, then check its expired/revoked status on the Sharing screen.

---

## PWA and platform limitations

- **No background or continuous location.** Browser geolocation is read on demand while the page is open. Journey updates stop when the app is closed or suspended. Keep Saath open on the Journey screen for the demo.
- **No push notifications.** Notification permission can be requested, but no push service exists in this MVP; alerts are in-app only.
- **No real calls or messages.** `tel:` links open the device dialler. Saath never reports that a call connected, was answered, or that help is coming.
- **Installability** is browser-dependent. The manifest, maskable icons and service worker are present; installation prompts vary by browser and require a secure context (HTTPS or localhost).
- **Offline** the app shell, saved data, demo area planning and manifest load from cache. Live routing, new map tiles and any live provider call require network access. Cached map tiles are bounded to 120.
- **iOS Safari** has stricter PWA storage and speech behaviour; verify installation and speech on the target device.
- The production build uses client-side routing, so a static host needs an SPA fallback to `/index.html` for deep links such as `/journey`. `vite preview` handles this locally.
- No account system: data is device-local and clearing site data removes it. Share tokens are simulated and do not resolve on another device.

---

## Privacy and safety boundaries

- Consent is explicit and stored per contact. AI-call consent defaults to **off**; toggling it on records consent for that contact.
- AI is used for report interpretation, duplicate suggestions, route explanations and voice interaction. **Deterministic code** owns recipients, permissions, timers, SOS action states, acknowledgement recording and escalation.
- AI cannot record an acknowledgement. Only an explicit contact phrase (English or Hindi) triggers it, and the UI repeats that an acknowledgement is not confirmation that help is coming.
- Reports store no author identity, never link to a journey and are not public until a moderator approves them. Route observations ignore pending, rejected or non-shared reports.
- No API key is read or stored in the browser. The service worker never caches `/api/` responses.
- The demo uses fictional people, contacts and incidents. Do not test emergency actions against a stranger’s phone number.

---

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

The deterministic suite covers check-in deduplication, bounded escalation, SOS idempotence and action states, share expiry/revocation, paused ETA, ended-journey revocation, contact priority, AI fact boundaries, acknowledgement detection and moderation-gated route observations.

This build was also exercised in headless Chromium against the running app, including: full onboarding with a manual contact, denied location with manual fallback, live OSRM routing outside the demo area showing Unknown conditions, report submission → moderator approval, SOS hold activation, unanswered AI call, offline failure, dark/light token switching, and the production service worker serving a deep link offline.

## Project layout

```
shared/        Types, demo data, deterministic engine, planner reasoning, AI/assistant/
               operator/reporting rules, share tokens and unit tests
server/        Web-standard API handlers and Vite dev/preview middleware
src/screens/   Onboarding, Home, Plan, Journey, SOS, AI call, operator, contacts,
               sharing, reports, settings and guided demo
src/lib/       Store/reducer wiring, geolocation, local storage, AI client, i18n, planner
src/components UI kit, icons, map, hold gesture, contact form
public/        Manifest, service worker, icons
```

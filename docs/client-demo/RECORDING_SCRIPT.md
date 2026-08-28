# Client Demo Video — Recording Script (~6–8 min)

Open the slide deck first, then the live app. Record with **Loom**, **OBS**, or Windows **Xbox Game Bar** (`Win + G`).

## Before you hit Record

1. Start backend (port must match `.env.local`):
   ```bat
   cd /d "d:\Web Projects\digital-signage-saas\backend"
   .venv\Scripts\activate.bat
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```
2. Start frontend: `cd frontend` → `npm run dev`
3. Browser: one window, hide bookmarks, zoom 100%
4. Open two tabs ready:
   - `docs/client-demo/index.html` (slides)
   - `http://localhost:3000` (app)

---

## Part A — Slides (2 min)

| Time | Slide | Say this (English for client) |
|------|-------|-------------------------------|
| 0:00 | 1 Title | “Hi — quick progress update on the Digital Menu Board SaaS. This is a multi-tenant platform to design menus and push them to in-store screens from one dashboard.” |
| 0:25 | 2 Product | “Four surfaces: marketing site, operator dashboard, visual menu designer, and the kiosk display with pairing.” |
| 0:50 | 3 Progress | “We’re at roughly 65–70% of MVP. Frontend, backend foundation, and live APIs for organizations, locations, screens, pairing, menus, and templates are done. Next is realtime sync, themes, and deploy.” |
| 1:20 | 4 Walkthrough | “I’ll now walk the live product so you can see what already works.” |

*(Optional: skip architecture slide during video; keep for Q&A.)*

---

## Part B — Live product (4–5 min)

### 1) Marketing (30s)
- Go to `http://localhost:3000`
- **Say:** “This is the public marketing page — positioning, industries, designer preview, and signup CTA.”

### 2) Dashboard (45s)
- Sign in → `/dashboard`
- **Say:** “After Clerk login, the user is provisioned into the API and lands in the org dashboard. Demo tenant is Harbor & Hearth.”

### 3) Org / Locations / Screens (60s)
- Open Organization, Locations, Screens
- **Say:** “Operators manage the company, store locations, and physical screens. Data is live from FastAPI + Supabase, not just mock UI.”

### 4) Pairing (60s)
- Open `/pair` in a second window (kiosk-style)
- In dashboard, complete pairing with the code shown
- **Say:** “A new screen shows a short code. Staff enter that code in the dashboard to claim the device — standard digital signage onboarding.”

### 5) Menus / Designer / Publish (90s)
- Menus list → open a menu → edit / designer if available → Templates → Publish
- **Say:** “Menus and items are editable; templates can be reused; Publish targets screens. This is the core operator workflow.”

### 6) Kiosk display (45s)
- Open `/display/[screenId]` for a seeded screen
- **Say:** “This is what guests see on the TV. Heartbeat keeps the device visible as online. Full instant push after publish is the next engineering milestone.”

---

## Part C — Close (45s)

Back to slides → Remaining work + Ready for feedback.

**Say:**  
“What’s left for MVP: WebSocket push under three seconds, theme scheduling, and staging deploy. AI menu assist and PWA are post-MVP. Happy to take feedback on hosting and template priorities.”

---

## Aap ke liye Urdu cues (sirf recording ke waqt)

- Pehle slides se story batao, phir app dikhao — client confuse nahi hoga.
- “Mock” mat bolo jab live API chal rahi ho; bolo “live backend connected.”
- Jo abhi nahi hai (WebSocket instant update, production URL) clearly “next milestone” keh do — overpromise mat karo.
- Agar banner aaye “API sync failed” to pehle seed + onboard fix karo, phir record karo.
- Secret keys / `.env` screen pe mat dikhana.

---

## Suggested filename for client

`Digital-Menu-Board-SaaS_Progress-Demo_YYYY-MM-DD.mp4`

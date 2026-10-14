# PARKLY — Parking, reserved

PARKLY is a web app for reserving a parking space in Delhi NCR before you arrive. You pick a place and your hours,
see the full price (fees and GST included) before you pay, and get a pass with a QR code to scan at the barrier.
From there you can check in, extend, change or cancel the booking (the refund is shown first), and settle any
overstay when you leave.

It is a Next.js 15 (App Router) + React 19 + TypeScript app with no backend: all data is demo data kept in the
browser (`localStorage`, key `parkly.app.v1`). Payments are simulated and no money moves.

## Run locally

Needs Node.js 18.18 or newer.

```bash
npm install
npm run dev                  # development server on http://localhost:3000
npm run build && npm start   # production build, served on http://localhost:3000
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Two versions, switched at 900 px

- Screens **900 px wide or more** get the **desktop** version: sidebar, split list and map, centred modals.
- Screens **under 900 px** get the **mobile** version, which looks and feels like a native app: push and pop
  transitions, swipe from the left edge to go back, a bottom tab bar, large titles that collapse as you scroll,
  bottom sheets you can drag down, wheel pickers and pull to refresh. It runs edge to edge and can be added to the
  home screen as a standalone app (web manifest, Apple meta tags and theme colour are included).
- The server makes a first guess from the `sec-ch-ua-mobile` / user-agent request headers, so the first paint is
  right (`<body class="m">` or `<body class="d">`). The browser then checks the real width with
  `matchMedia('(min-width: 900px)')` and switches live when you resize or rotate. Both versions read the same data,
  so a booking shows the same times, price, bay and pass on either one.

Every route works as a deep link on both versions: `/explore`, `/map`, `/parking/<id>`, `/reserve/<id>`,
`/checkout/<id>`, `/confirmation/<id>`, `/bookings`, `/bookings/<id>`, `/bookings/<id>/arrive`, `/saved`, `/compare`,
`/notifications`, `/profile` (plus `/welcome` for the mobile onboarding).

## No login

Nothing needs an account. There is no OTP and no email verification anywhere. The user is a local profile
("Riya Sharma") that you can edit on the Profile page; **Sign in** and **Sign out** only switch between guest and
named mode on this device.

For testing, tap the version line on Profile 5 times to open the developer options: a test clock (move time
forward to reach check-in, the end of a booking or an overstay), "fail the next payment", refresh availability and
reset all data. On desktop the test clock is also in the sidebar.

## Deploy on Vercel

Import the repository in Vercel; the defaults (framework Next.js, `npm run build`) work as they are and no
environment variables are needed:

https://vercel.com/new/import?s=https://github.com/ai-bitmonky/samiti_gupta_parkly_app

After the import, every push to `main` deploys automatically.

## Project layout

- `app/` — routes; each `page.tsx` renders `<ScreenSwitch mobile={…} desktop={…} />`. `app/layout.tsx` holds the
  PWA metadata and the server-side device guess.
- `components/mobile/` — the mobile shell (`MobileShell.tsx`: screen stack, tab bar, edge swipe) and the 15 screens.
- `components/desktop/` — the desktop shell and views.
- `components/shared/` — map, dial, QR code, pass, sheets and modals, toasts, illustrations.
- `lib/` — data, pricing and availability engine, actions, store, device switch.
- `prototype/` — the HTML prototypes the app was ported from (`prototype/out/*.html`), for reference.
- `docs/` — research, specs and build status.
- `scripts/mobile-shell-check.js` — Playwright check of the mobile shell against a running production build.

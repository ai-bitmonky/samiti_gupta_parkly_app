# PARKLY — build status (final, 14 Oct 2026)

## State
The Next.js app is complete and audited. `npx tsc --noEmit`, `npm run lint` and `npm run build` are green.
Committed locally on `main`; not pushed yet (the build session could not push).

- Mobile version (< 900 px): persistent native-style shell (`components/mobile/MobileShell.tsx`) with push/pop and
  tab transitions, edge-swipe back, tab bar with live-bookings badge, collapsing large titles, draggable bottom
  sheets, wheel pickers, pull to refresh; all 15 screens.
- Desktop version (≥ 900 px): sidebar shell, landing page and all views (`components/desktop/`).
- Device switch: server guess from `sec-ch-ua-mobile` / user-agent sets `<body class="m|d">` for the first paint;
  `matchMedia('(min-width: 900px)')` confirms and switches live both ways.
- PWA: `/manifest.webmanifest` (display standalone, 192/512/maskable/SVG icons), Apple meta tags, theme colour,
  `viewport-fit=cover`.
- No login anywhere; Sign in / Sign out only toggle guest mode locally.
- Styled 404 page (`app/not-found.tsx`) for paths outside the app; unknown ids inside a route show empty states.
- The `/_dev` check page and the components only it used (`AmenityIcons`, `Skeleton`) were removed.

## Audit (production build, `next start`, Playwright with fresh browser contexts)
- Mobile at 360×780 and 390×844 (iPhone UA) and 412×915 (Android UA): onboarding → explore (destination search,
  time sheet, filters, sort, pull to refresh, compare) → map → facility → reserve → checkout with a failed payment
  (developer options) then success → confirmation and pass → booking detail → modify → arrive / check in → extend →
  test clock to overstay → exit with fee; cancel with refund; saved places, saved searches and alerts;
  notifications (swipe to delete, mark all read); profile (larger text, reduce motion, edit, sign out / guest /
  sign in, reset); edge swipe back, browser back/forward, unknown ids. All pass.
- Desktop at 1024×768 and 1440×900: the same flows. All pass.
- Device switch: SSR body class correct for iPhone, Android, desktop and client-hint headers (also with JS off);
  live switch across 900 px both ways on 11 routes; deep links on both; mismatched guesses (phone UA on a wide
  window, desktop UA on a narrow one, iPad, phone landscape) settle correctly without hydration warnings.
- Consistency: every booking shows the same paid total, times, plate, bay, reference or gate code and QR on mobile
  and desktop with the same `localStorage`.
- Zero console errors or warnings, page errors, failed requests or hydration warnings; no horizontal overflow on
  any screen tested; `prefers-reduced-motion` (system and the in-app switch) turns off transitions and animations.
- Screens compared with `prototype/out/PARKLY_Mobile_v1.0.html` / `PARKLY_Desktop_v1.0.html` at the same sizes:
  they match (the web app has no fake status bar or phone frame, by design).

## Known, kept as in the prototype
- On mobile, a first-time visitor opening a deep link sees the welcome screen first and then lands on Explore,
  not on the linked screen.
- "By the day" is offered wherever a place has a daily rate; at places that close at night every daily booking is
  then blocked by the opening-hours check, with a clear message.
- After paying, the browser back button returns to the Reserve screen (the app's own back goes to Bookings).

## Next steps
1. Push `main` to GitHub.
2. Import in Vercel: https://vercel.com/new/import?s=https://github.com/ai-bitmonky/samiti_gupta_parkly_app

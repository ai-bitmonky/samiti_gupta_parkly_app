# PARKLY — HTML prototype spec (mobile + desktop)

Source of truth: `/mnt/user-data/uploads/1791871073956_parkly-app__.html` (existing React build — port its DATA and LOGIC, not its look) and the research brief PDF (MoSCoW requirements). Read-only; never edit uploads.

## 0. Deliverables & file layout
```
/home/claude/parkly/
  src/core.css        shared tokens + components (both builds)
  src/data.js         facilities, destinations, vehicles, seed bookings, promo rules, policies
  src/engine.js       state store, pricing, availability, validation, booking ops, router, SVG map, QR, dial, helpers
  src/mobile.html     mobile screens + mobile-only CSS/JS; includes core via <!--#include core.css--> etc.
  src/desktop.html    desktop screens + desktop-only CSS/JS; same includes
  build.py            inlines the includes → out/PARKLY_Mobile_v1.0.html, out/PARKLY_Desktop_v1.0.html (single self-contained files; only external deps = Google Fonts link)
  out/
```
Include syntax (exact): `<!--#include core.css-->`, `<!--#include data.js-->`, `<!--#include engine.js-->` placed inside `<style>` / `<script>` tags. build.py does literal replacement. Run `python3 build.py` after every milestone so `out/` always has a working file.

No frameworks, no build tools, vanilla JS (ES2020), one HTML file each. Everything deterministic (seeded pseudo-random), state in `localStorage` key `parkly.proto.v1` (wrapped in try/catch). Must work from `file://`.

## 1. Visual system (core.css)
Brand continuity with the PARKLY research deck, pushed cinematic-dark.

Tokens (CSS vars on :root; dark is the ONLY theme):
- `--asphalt:#0A0F0C` (page), `--surface:#121A15`, `--surface-2:#1A2420`, `--surface-3:#223129` (hover/raised), `--line:rgba(245,244,239,.10)`, `--line-strong:rgba(245,244,239,.18)`
- `--forest:#0F2A1F` (brand panel), `--lime:#C6F432` (THE accent: CTAs, selected, price pins, lane paint), `--on-lime:#0F2A1F`
- `--ink:#F5F4EF`, `--ink-2:rgba(245,244,239,.72)`, `--muted:rgba(245,244,239,.50)`, `--muted-2:rgba(245,244,239,.32)`
- status (never used decoratively): `--ok:#3DDC97` available, `--warn:#FFB020` few left / ending soon, `--danger:#FF5A5F` full / overstay / cancel, `--info:#7CB8FF` links/route
- `--r-card:20px --r-ctl:14px --r-chip:10px`, `--shadow-lift: 0 24px 60px -24px rgba(0,0,0,.7)`, lime glow `0 0 0 1px rgba(198,244,50,.35), 0 10px 40px -12px rgba(198,244,50,.45)` on primary CTA hover/active pins.
- Type: `--font-display:"Schibsted Grotesk"` (800, tight tracking -0.03em for hero numerals), `--font-body:"Onest"`, `--font-mono:"JetBrains Mono"` (plates, bay codes, times, prices in bills, countdowns). Google Fonts link: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Onest:wght@400;500;600;700&family=Schibsted+Grotesk:wght@500;600;700;800&display=swap`.
- Numerals always `font-variant-numeric: tabular-nums`.
- Signature motifs: (a) **lane-paint dividers** — dashed lime/ink lines (`border-top:2px dashed`) as section separators; (b) **boarding-pass** card with perforated tear line (notches) for the digital pass; (c) **price pins** on map (lime pill with tail); (d) **time dial** (EasyPark-style circular dial) for duration / extension; (e) grain: subtle noise overlay via inline SVG feTurbulence at 4% opacity on the page background; (f) the P logo (rounded square forest, white P, lime dot) — reuse from the deck.
- Components to define in core.css: `.btn` (primary lime / secondary surface / outline / ghost / danger; sizes sm/md/lg; `.btn-lg` 52px), `.chip` (+`.is-on`), `.badge` (tone ok/warn/danger/neutral/lime), `.card`, `.input/.select`, `.switch`, `.seg` (segmented control), `.sheet` (bottom sheet mobile) / `.modal` (desktop dialog) sharing one overlay, `.toast`, `.plate` (IND plate chip: mono, white bg, dark text, blue IND tab), `.occ` occupancy bar (`38 of 120 free`, ok/warn/danger fill), `.pass` boarding pass, `.pin` map price pin, `.dial` time dial, `.stars`, `.eyebrow`, `.skeleton`, `.lane` (dashed divider), `.kv` key/value rows, `.bill` itemised bill.
- Motion: springy (`cubic-bezier(.2,.8,.2,1)`), 180–320ms. Keyframes: `rise`, `fade`, `pop`, `sheet-up`, `pin-drop`, `pulse-ring`, `print` (pass slides up from the sheet edge with a slight overshoot), `roll` (number roll: wrap old/new in a 1-line clip and translateY). Respect `prefers-reduced-motion`.
- Focus: `outline:2px solid var(--info); offset 2px`. Hit targets ≥44px on mobile.

## 2. Data (data.js) — port from the React bundle
Port verbatim (rename to readable identifiers, keep every field): the 16 facilities array (`ng=[{id:"cp-palika"...}]` — includes name, area, address, lat/lng, type, covered, capacity, rate, dailyRate, open/close/is24h, overnight, security[], accessible, motorcycle, instant, ev{count,kw,connector,perKwh}, amenities[], rating, reviewCount, reviews[], heightLimit, vehicleTypes[], policy, phone, hue, busyness, levels[], rules[], entry[]); the 16 destinations (`Ih`); vehicles (`td`); promo codes (`rg`); pricing consts (`pn`: convenienceFee 15, gst .18, evReserve 49, billingStepMin 30, overstayMultiplier 1.5); vehicle multipliers (`mc`); cancellation policies (`qt`); hourly busyness curve (`lg`); the seed bookings builder (`Wh`) incl. 6 seed bookings (active, tomorrow Saket, airport daily+EV+promo, 2 completed, 1 cancelled), saved ids, saved search, saved places, notifications, user Riya Sharma; also the schematic map geometry (`vv` river, `yv` parks, `id` roads, `kv` minor roads, `wv` runways, `jv` labels, projection consts 77.03/28.71 and scale 97.7/110.6×40). Export as `window.PARKLY_DATA = {...}`.

## 3. Engine (engine.js) — port logic, expose a small API
Port from bundle: time helpers (`Pt,uo,Lt,$h,At,Ba,Xu,Ot,se,el,Fe,yt,We,fo,Fh`), money `₹` formatter (en-IN), `rateFor`, `dailyFor`, `applyPromo`, `quote` (the `Vt` price breakdown with lines[]), `refundPreview`, `overstayFee`, haversine `distKm`, `walkMin`, `mapsUrl`, deterministic `hash`, `simulatedOccupied`, `overlapBookings`, `availability(f,start,end,bookings,seed,excludeId)→{free,fullSlot}`, `hourlyAvailability`, `isOpenAt`, `hoursLabel`, `availTone`, `validateBooking` (issues[] with field+message), `bookingStatus`, `isOverstay`, `genRef`, `genBay`, `rankResults` (score+reason), `activeFilters`, filter defaults, sort labels. Store: `S.state`, `S.set(fn)`, `S.subscribe(fn)`, persisted. Actions: completeOnboarding, setSearch, setFilters, setDestination, toggleSaved, toggleCompare(max 3), upsert/removeVehicle, createBooking (fails → {ok:false,error}), modifyBooking, quoteExtension, extendBooking, cancelBooking, markArrived, markExited, notifications, saveSearch/checkAlerts, demo clock `setClockOffset(min)`, `now()`.
Also implement:
- `Router`: hash routes (`#/explore`, `#/map`, `#/parking/:id`, `#/reserve/:id`, `#/checkout/:id`, `#/confirmation/:id`, `#/bookings`, `#/bookings/:id`, `#/bookings/:id/arrive`, `#/saved`, `#/compare`, `#/notifications`, `#/profile`, `#/welcome`; desktop adds `#/` landing). `Router.go(path)`, `Router.on(render)`. Scroll to top on change.
- `SvgMap.render(container, {items, dest, radiusKm, selectedId, routeTo, compact, onSelect})` — the schematic Delhi vector map (port geometry + projection; pan/zoom with pointer + wheel; price pins (lime pill = available, dim = full, amber ring = few left, `EV` tag); destination marker with pulse ring; dashed route line + walk-time tag; scale bar; "Search this area" button when panned). Dark-styled: map bg `#0E1511`, roads `#1E2A23`/`#2B3A31`, water `#13303A`, parks `#17301F`, labels muted mono caps.
- `QR.svg(text)` — port the qrcode-generator (it's inlined in the bundle) or write a compact QR encoder; must render a real scannable QR for `PARKLY|ref|plate`.
- `Dial.mount(el,{valueMin, minMin:30, maxMin:1440, stepMin:30, onChange})` — circular time dial: drag the knob around a 270° arc, lime arc fill, centre shows duration big (`2 h 30 m`) and exit time below; keyboard arrows ±30 min. Used in Reserve (duration) and Extend (+30…+180).
- `Illus.facility(f, scene)` — port the 3 SVG facility scenes (entrance / bays / inside) from the bundle (`It`) but recolour to the dark palette with the facility `hue`.
- `rollNumber(el, newText)` helper for animated price/time changes; `toast(text, tone, action)`; `fmt` helpers.
Export as `window.PARKLY = {S, A (actions), Router, SvgMap, QR, Dial, Illus, fmt..., quote, availability, ...}`.

## 4. Screens — MOBILE (`src/mobile.html`, 390px design width)
Shell: `<body class="m">`. On viewports ≥ 520px, render inside a centred phone frame (390×844, rounded 44px, dark bezel, status bar time from `now()`), so it previews nicely on a laptop; below 520px it is edge-to-edge full-screen (true mobile). Bottom tab bar (Explore / Map / Bookings / Saved / Profile) with lime pill on the active tab; sticky translucent top bars with back + title + bell badge. Sheets slide up for pickers/filters/extend/cancel.

1. **Welcome** (`#/welcome`): forest panel, giant display headline "Your spot. Before you arrive." (lime second line), the reserved-bay grid motif (12 bays, one lit `L2·14`), 3 swipeable value slides (space for your hours / price fixed before you pay / scan and park), CTAs "Find parking" / "Continue as guest". Skippable (`onboarded`).
2. **Explore / Home** (`#/explore`): greeting; destination search (combobox with recents, saved places Home/Work, "Near me" → sets Mandi House with toast); **Enter after / Exit before** row (tap → sheet with date strip + time selects + quick chips 1/2/3/4/6/8 h + mini dial) showing duration pill; quick-intent chips (Quick 1 hour / All-day / Airport long-stay); compact map strip (tap → Map); "Recommended near {dest}" list — result cards: illustration thumb, name, area, distance+walk, rating, amenity icons (EV/♿/🏍/covered/CCTV as small SVG icons), **occupancy bar** `38 of 120 free`, big total-for-window price + `₹50/h`, reason line (lime), Compare checkbox, heart. Filter bar + sort select + active filter chips. Save-this-search button. Recent destinations + Saved places + Recently viewed.
3. **Map** (`#/map`): full-bleed SvgMap with search + time window overlaid on top, filter/sort row, price pins; tapping a pin opens a preview card (bottom) with Reserve / Details; list/map toggle; compare tray floats above the tab bar.
4. **Filters sheet**: max price slider, distance chips, type chips, security chips, rating chips, switches (available for my time, EV, accessible, motorcycle, overnight, instant). Footer "Show N results" live count.
5. **Facility detail** (`#/parking/:id`): hero illustration with 3 scene thumbs; badges (type, instant/operator-confirms); title, address, stars, distance/walk; actions (save / directions); **Availability by hour** heatmap grid (24 cells, tap sets entry; legend); **price strip 3h / 6h / 12h / day** (research pattern); facts grid (hours, capacity, height limit, overnight, accessibility, vehicles); EV block; security & amenities chips; rules; cancellation policy; reviews; location mini map with route; sticky bottom bar: total for window + "Reserve a spot" (disabled "Full" when 0 free).
6. **Reserve** (`#/reserve/:id`): step 1 Date & time — date strip + Enter after select + **time dial** for duration (hourly) or days select (daily); step 2 Vehicle radio cards (plate chip; "Not allowed" badge when type not permitted; add/edit vehicle sheet with Indian plate validation); step 3 Requirements chips (EV charging +₹49 only if facility has EV, accessible bay, near exit, extra-wide, covered) + note (160 chars). Live validation messages (past time, closes at, min 30 min, max 7 days, vehicle overlap, full from HH:MM). Summary card with availability + bill. Sticky bar: total + Continue.
7. **Checkout** (`#/checkout/:id?…`): booking review card (lot, window, duration, vehicle, requirements, note, policy); promo code (PARK10/FIRSTPARK/WEEKEND20 with success/error msgs); payment method radios (UPI riya@okaxis / Card Visa 4242 / PARKLY Wallet ₹1,250); itemised bill; "Pay ₹X and reserve" → processing overlay (1.4s) → confirmation; failure path when `demo.nextPaymentFails` (retry/change method).
8. **Confirmation** (`#/confirmation/:id`): lime check pop; "You're booked" / "Booking received" (non-instant); the **boarding-pass** prints up (animation): PARKLY PASS header, status badge, Bay huge, lot, Entry/Exit, plate chip, reference or gate code (driveways), perforation, QR + "Scan at entry"; paid summary; entry instructions numbered; buttons View booking / Directions / Add to calendar (sheet: Google link / .ics download / copy) / Home.
9. **Bookings** (`#/bookings`): tabs Upcoming/Active/Completed/Cancelled with counts; cards with status badge (Overstay danger), ref mono, window, plate, amount.
10. **Booking detail** (`#/bookings/:id`): hero status card — upcoming: "Starts in" countdown; active: **countdown ring** (SVG arc) with time left, exit-by, progress; warn state <15 min; overstay red block with live fee; pending: operator confirming; action pair (I'm arriving / View pass / Extend / I've exited); details card; actions list (View pass, Directions, Modify, Extend, Add to calendar, Contact, Payment summary, Book again, Cancel); activity timeline. Sheets: Pass; Modify (date/time + vehicle, live diff "Pay ₹X more / Refund ₹Y"); **Extend** (dial +30/+60/+120/+180, next-slot check, extra to pay); **Cancel** dialog with refund amount + **cancellation deadline countdown** + policy text; Exit confirm with overstay fee.
11. **Arriving** (`#/bookings/:id/arrive`): countdown, "bay held" + others free, arrival checklist (checkboxes), entry steps, map with route + walk time + Drive button, "I've entered — check in" (enabled from 15 min before) / "Show pass".
12. **Saved** (`#/saved`): segmented Parking/Searches; saved spot cards with occupancy + Quick book; saved searches with alert bell toggle, Run search, "Check now" alerts.
13. **Compare** (`#/compare`): horizontally scrollable table of 2–3 lots: illustration, total for window, hourly, daily, distance, free spaces, rating, type, hours, security, EV, height, cancellation; ticks on best value; Reserve/Remove.
14. **Notifications** (`#/notifications`): list with kind icons, unread dot, mark read, delete, clear all.
15. **Profile** (`#/profile`): user card; vehicles (default/edit/remove); payment pref + saved places; notification switches; display (larger text, reduce motion); **Developer options** (tap version 5×): test clock +30m/+1h/+3h, jump to 10 min before next event, back to real time, fail next payment, refresh availability, reset data; help FAQ accordion; terms/privacy sheets; sign out.

## 5. Screens — DESKTOP (`src/desktop.html`, 1280–1440 design width, min 1024)
Shell: left sidebar (244px) with logo, nav (Explore, Map, Bookings, Saved, Notifications w/ badge, Profile), bottom "Test clock" mini control; content max 1360px. Modals centred (not sheets). Everything from §4 exists here too, re-laid-out:
0. **Landing** (`#/`): full-viewport hero — left: eyebrow "Parking in Delhi NCR", display headline (2 lines, second lime), sub-copy, **search bar** (Where → Enter after → Exit before → lime "Find parking"), guarantee badges row (Space guaranteed · Price fixed upfront · Cancel with refund shown · Scan to enter); right: the SvgMap as hero canvas with live price pins and a floating boarding-pass card tilted 6° that animates in. Below: "How it works" 4 steps (search → compare → book → scan), stats band from the research deck (1.22 cr vehicles · ~30,000 spaces · 10–15 min lost per trip · ~250 parking-dispute calls/day) styled as a departure board, "Why drivers pre-book" 3 insight cards (I2 price at the gate, I3 bill shock, I4 conflict) with the 4 HMWs, featured facilities carousel, footer with lane-paint divider.
1. **Explore / Results** (`#/explore`): top bar with search + time window + filters/sort; **split view**: left results rail (420px, scroll) with the same cards (wider: amenities row + occupancy + 3h/6h/12h mini strip), right sticky map (full height) with pins; hover card ↔ pin highlight; preview card over map; compare tray bottom-left.
2. **Map** (`#/map`): same split with map dominant (rail collapsible).
3. **Detail**: 2-col (content 1.4fr / sticky price card 1fr with dial-free time summary, availability badge, bill, Reserve, Save, Directions).
4. **Reserve**: 2-col (steps / sticky summary). **Checkout**: 2-col (review+promo+payment / sticky bill + Pay). **Confirmation**: centred pass (max 560px) + entry steps + actions.
5. **Bookings**: master-detail — list rail left, booking detail right (same content as mobile detail, countdown ring larger). Arrive view inside detail.
6. **Saved**, **Compare** (full table, no scroll), **Notifications**, **Profile** (2-col sections).
Keyboard: `/` focuses search, Esc closes modals, arrow keys pan map, +/- zoom.

## 6. Quality bar (both)
- Beginner-proof copy, plain words; every error says what to do next.
- No layout breaks at 360px (mobile) and 1024/1440 (desktop). No horizontal page scroll.
- Zero console errors; all flows work end-to-end from a fresh localStorage: welcome → search → detail → reserve → checkout → pass → bookings → extend → cancel; test clock makes "ending soon"/overstay reachable.
- Every number shown comes from the engine (price on card = checkout = pass).
- Visual polish: consistent 4px spacing grid, generous whitespace, one accent, status colours only for status, mono for codes/numbers, illustration scenes on every card, animated pins/numbers/pass/ring.

## 7. Motion & polish cookbook (from award-winning-site research; both builds must follow)
- Easing: standard `cubic-bezier(.2,0,0,1)`; entrances `cubic-bezier(0,0,.2,1)`; spring only on the dial knob `cubic-bezier(.34,1.56,.64,1)`.
- Durations: 150ms hover/press · 240ms state change · 320ms sheets/panels · 600ms page reveal · nothing >800ms except ambient loops.
- Staggered reveal: fade-up 16px, 70–80ms stagger, applied to hero lines and the first 4 result cards only.
- Price pins: scale .6→1 + fade 240ms, 40ms stagger; selected pin 1.15× lime with a 2s pulsing ring at 30%.
- Price count-up 700ms (tabular mono) on first paint; on dial/time change, a 180ms vertical odometer roll on changed digits only (never re-render the whole card).
- Dial: arc fills with the drag (no lag), snaps to 30-min steps with a 120ms knob spring, tick flashes lime on snap.
- Route lines: `stroke-dashoffset` draw-in 900ms; walking path = moving dashes 1.2s/cycle.
- Hover lift (desktop): translateY(-2px), border 8%→16% white, glow `0 0 0 1px #C6F43233, 0 8px 32px #C6F43214`. No heavy drop shadows.
- Press: scale .97 100ms. Primary button magnetic on desktop (≤6px drift toward cursor).
- Skeleton shimmer #121A15→#1A2420 sweep 1.4s during slot search; 200ms crossfade to content.
- Pass reveal: slides up, perforation dashes draw in (500ms), QR fades in +150ms with one lime scan-line sweep. Boom-barrier icon on the pass lifts on check-in. Step rail on pass: Drive → Enter → Park → Exit, current step lime.
- Grain feTurbulence 4% on hero + pass only. `prefers-reduced-motion`: no loops, count-ups, staggers or grain movement.
- Surfaces climb in fixed steps (#0A0F0C → #121A15 → #1A2420 → #223129); borders are white at 6–16% alpha, never grey hex. Lime appears only where the user can act or where selection/status lives.
- Desktop hero: 12-col grid, max 1280px; text+search 5 cols, live map 7 cols bleeding off the right; faint 1px grid at 6–8% behind. Display type `clamp(56px,7vw,104px)`, weight 700, tracking -0.035em, line-height .95, ≤2 lines, ≤1 word in lime.
- Labels: Onest 12px uppercase 0.08em at 55%. Body Onest 16px/1.55. Every price/time/code/distance in JetBrains Mono tabular; ₹ sign ~60% size; price is the largest element on a card (28–32px).
- Mobile result card: 16px side margin, 20px radius, 1px 8% border; rows = (name · distance) / (price left · free spaces right) / (occupancy bar + 44px Book button); 12px gap; selected card gets a 3px lime left edge. Sections 56px apart mobile, 96px desktop. Pills only for buttons and chips.

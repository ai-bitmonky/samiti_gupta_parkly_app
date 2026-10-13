# PARKLY — Design research behind the prototypes (v1.0, 13 Oct 2026)

Two passes: (A) the top 10 parking-booking products, (B) 10 award-winning sites in mobility, travel, maps and dark data UIs. Everything below is paraphrased from the pages and write-ups listed in Sources.

## A. Top 10 parking-booking products

| Product | What it does well | Borrowed for PARKLY |
|---|---|---|
| SpotHero (US) | Photo hero + "how it works" in 4 steps; guaranteed spot at the price paid, free changes until start | One "everything you need" pass screen with entry steps and scan code |
| ParkWhiz / Arrive (US) | Duration shown as soon as times are set; price pins on map; amenity icons in the map pop-up; no upsell at checkout | 3h / 6h / 12h price strip side by side |
| JustPark (UK) | Where / When / From–To search; heavy trust layer (guarantee, driver count, reviews); warns before double booking | In-flow warnings so errors are prevented, not refunded |
| YourParkingSpace (UK) | "Enter after / Exit before" labels; four guarantee badges above search; "minutes saved" stats | The Enter-after / Exit-before wording and guarantee badges |
| Park+ (India) | Vehicle profile keyed by registration number; UPI / FASTag native; QR scanner built in | Plate-first vehicle cards, UPI as default payment |
| ParkMobile (US, 2025) | Precise zone map; time wheel to set end time in one motion; review screen before confirming | "Confirm everything" card before paying |
| EasyPark / RingGo (EU) | Circular dial: rotate to set end time, turn again to extend, one tap to stop | The time dial as the hero control for duration and extension |
| Parkopedia | "Where are you going?" entry; sort by distance / price / relevance; honest listing data (hours, payments, covered) | Facts grid per facility |
| Parkimeter (EU) | Built around comparison; cancellation rule shown plainly (full refund up to 24h) | Cancellation deadline as a countdown with the refund amount |
| MyParkings / Get My Parking (Delhi civic) | Capacity / occupied / free counts per site; QR booking, cashless, passes | The "38 of 120 free" occupancy bar — a format Delhi drivers already know |

### The 10 patterns adopted
1. Map as canvas, price pins showing the **total for the chosen window**; bottom sheet on mobile, list rail on desktop.
2. A clear time window (Enter after / Exit before + dial) with duration shown instantly.
3. Price upfront, itemised (base, EV, fee, GST) — the same number on card, checkout and pass.
4. Amenity icons on cards and pins (EV, accessible, two-wheeler, covered, CCTV, valet).
5. Occupancy bar with ok / warn / danger status on every card.
6. Compare tray (2–3 lots) with the 3h/6h/12h strip.
7. Review card before paying; UPI / card / wallet.
8. Boarding-pass style pass: large QR, plate, level + bay, entry steps, live countdown.
9. Extend and cancel in place: dial to extend with the price difference shown; cancel shows refund + deadline countdown.
10. Trust and mistake-proofing: guarantee badges, overlap warnings, vehicle-size notes.

## B. Award-winning references
- **Flighty** (Apple Design Award 2023): oversized monospaced countdown, tabular digits, colour = status only, cards show only what matters now.
- **Igloo Inc** (Awwwards SOTD 2024, 9.6 animation): two-colour discipline.
- **Lusion v3** (SOTD 2023, Developer Award): cursor-reactive, scroll-driven motion → magnetic primary button, soft glow.
- **Lightship** (Awwwards + CSSDA SOTD): deep base + one warm accent; staggered full-screen mobile menu.
- **Polestar "Making aNew"** (2 Webby Awards 2022): every section pairs information with interaction; 60+ pages became one → sticky split layout, map fixed while steps scroll.
- **Stripe** (Sessions 2024 Honorable Mention): faint grid lines, only changed fields animate, sticky scroll progress → update only price/time digits on change.
- **Airbnb 2025 redesign**: icons with state (door open = checked in); delight must have a practical reason → boom barrier lifts on check-in.
- **Linear**: LCH-spaced surfaces, white-alpha borders, accent used sparingly.
- **Citymapper**: trips split into swipeable stages → step rail on the pass (Drive → Enter → Park → Exit).
- **Revolut**: 56px tabular balances, 1.2s count-up, 16px fade-up with 80ms stagger → price count-up on cards.

## C. Visual direction chosen for PARKLY
Brand continuity with the research deck (forest #0F2A1F, lime #C6F432, Schibsted Grotesk / Onest / JetBrains Mono), pushed cinematic-dark: asphalt #0A0F0C base, surfaces stepping #121A15 → #1A2420 → #223129, borders as white alpha, lime only where the user acts or where selection lives, status colours (teal ok / amber warn / coral danger) never decorative. Signature motifs: lane-paint dashed dividers, price pins on a dark schematic Delhi map, the boarding-pass pass with a perforated tear line, and a circular time dial. Motion rules (easings, durations, staggers, pin drop, odometer digits, pass print, countdown ring, grain, reduced-motion) are in PLAN §7.

## Sources
Parking products: https://spothero.com/ · https://dribbble.com/SpotHero/shots · https://www.parkwhiz.com/ · https://screensdesign.com/showcase/parkwhiz-1-parking-app · https://www.justpark.com/ · https://builtformars.com/company/justpark · https://www.yourparkingspace.co.uk/ · https://parkplus.io/ · https://apps.apple.com/in/app/park-rto-parivahan-fastag/id1244749178 · https://parkmobile.io/about-us/newsroom/articles/the-future-of-parking-starts-now-parkmobile-unveils-enhanced-app-experience · https://www.easypark.com/en-de/help/parking-app/how-does-it-work/starting-extending-stopping-parking · https://www.myringgo.co.uk/ · https://www.parksy.com/blog/parkopedia-global-parking-review · https://apps.apple.com/app/409340361 · https://apps.apple.com/app/id842520244 · https://archive.opengovasia.com/2021/10/20/delhi-india-launches-smart-parking-application/

Award-winning references: https://www.apple.com/newsroom/2023/06/apple-announces-winners-of-the-2023-apple-design-awards · https://blakecrosley.com/guides/design/flighty · https://www.awwwards.com/sites/igloo-inc · https://www.awwwards.com/sites/lusion-v3 · https://www.awwwards.com/sites/lightship · https://locomotive.ca/en/work/lightship · https://winners.webbyawards.com/2022/websites-and-mobile-sites/features-design/best-use-of-video-or-moving-image/212768/polestar--making-anew · https://www.codeandtheory.com/work/polestar · https://www.awwwards.com/sites/stripe-sessions-2024 · https://anthonyhobday.com/sideprojects/attentiontodetail/stripe.html · https://www.designweek.co.uk/it-was-a-bit-nuts-teo-connor-on-designing-the-new-airbnb-app/ · https://linear.app/now/how-we-redesigned-the-linear-ui · https://ixd.prattsi.org/2026/09/design-critique-citymapper/ · https://www.webdesignhot.com/design.md/revolut/ · https://www.shadcn.io/design/polestar · https://contra.com/p/vcNWvsXP-parko

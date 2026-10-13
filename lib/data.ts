/* PARKLY · lib/data.ts
   Typed port of the prototype's data.js: facilities, destinations, vehicles, pricing, policies,
   seed state and the schematic Delhi map geometry. No logic lives here (see lib/engine.ts).
   The constant `D` below is generated from data.js — keep values identical to the prototype. */

export type VehicleType = "hatchback" | "sedan" | "suv" | "motorcycle" | "ev";
export type FacilityType = "garage" | "uncovered" | "covered" | "driveway" | "ev";
export type FilterType = "covered" | "uncovered" | "garage" | "driveway" | "ev";
export type SecurityId = "cctv" | "guarded" | "gated";
export type PolicyId = "flexible" | "moderate" | "strict";
export type SortKey = "recommended" | "price" | "distance" | "rating" | "spaces";
export type BookingStatus = "pending" | "upcoming" | "active" | "completed" | "cancelled";
export type BookingMode = "hourly" | "daily";
export type PaymentMethodId = "upi" | "card" | "wallet";
export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "lime";
export type AvailTone = "ok" | "low" | "none";

export interface LatLng { lat: number; lng: number }

export interface Review { name: string; rating: number; date: string; text: string }
export interface EvInfo { count: number; kw: number; connector: string; perKwh: number }

export interface Facility extends LatLng {
  id: string;
  name: string;
  area: string;
  address: string;
  type: FacilityType;
  covered: boolean;
  capacity: number;
  rate: number;
  dailyRate?: number;
  open: string;
  close: string;
  is24h: boolean;
  overnight: boolean;
  security: SecurityId[];
  accessible: boolean;
  motorcycle: boolean;
  instant: boolean;
  ev?: EvInfo;
  amenities: string[];
  rating: number;
  reviewCount: number;
  reviews: Review[];
  heightLimit: number | null;
  vehicleTypes: VehicleType[];
  policy: PolicyId;
  phone: string;
  hue: number;
  busyness: number;
  levels: string[];
  rules: string[];
  entry: string[];
}

export interface Destination extends LatLng { id: string; name: string; area: string; kind: string }

export interface Vehicle { id: string; name: string; plate: string; type: VehicleType; color?: string }

export interface Pricing { convenienceFee: number; gst: number; evReserve: number; billingStepMin: number; overstayMultiplier: number }

export interface Filters {
  maxPrice: number;
  maxDistance: number;
  types: FilterType[];
  security: SecurityId[];
  accessible: boolean;
  ev: boolean;
  motorcycle: boolean;
  overnight: boolean;
  instant: boolean;
  minRating: number;
  onlyAvailable: boolean;
}

export interface PaymentMethod { id: PaymentMethodId; label: string; detail: string; balance?: number }

/** One line of an itemised bill (quote().lines). Negative amount = discount. */
export interface BillLine { label: string; amount: number; hint?: string }

/** Result of engine.quote() */
export interface Quote {
  hours: number;
  billedHours: number;
  mode: BookingMode;
  base: number;
  additional: number;
  dailyCapApplied: boolean;
  vehicleAdj: number;
  evCharging: number;
  subtotal: number;
  convenience: number;
  discount: number;
  promo?: string;
  tax: number;
  total: number;
  lines: BillLine[];
}

export interface PaymentAdjustment { at: string; amount: number; reason: string }
export interface Payment { method: PaymentMethodId | string; txnId: string; amount: number; paidAt: string; adjustments: PaymentAdjustment[] }
export interface Refund { amount: number; percent: number; note: string }
export interface HistoryItem { at: string; action: string; detail?: string }

export interface Booking {
  id: string;
  ref: string;
  facilityId: string;
  vehicleId: string;
  vehicle: { name: string; plate: string; type: VehicleType };
  start: string; // ISO
  end: string; // ISO
  mode: BookingMode;
  notes: string;
  requirements: string[];
  createdAt: string;
  confirmedAt: string;
  price: Quote;
  payment: Payment;
  cancelledAt?: string;
  refund?: Refund;
  arrivedAt?: string;
  exitedAt?: string;
  bay: string;
  history: HistoryItem[];
}

export type NotificationKind =
  | "confirmed" | "availability" | "reminder" | "cancelled" | "price" | "modified" | "extended" | "ending" | string;

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string; // ISO
  read: boolean;
  bookingId?: string;
  facilityId?: string;
}
/** What a caller passes to actions.notify() */
export interface NotificationInput { kind: NotificationKind; title: string; body: string; bookingId?: string; facilityId?: string }

export interface CustomPlace extends LatLng { name: string }

export interface SavedSearch {
  id: string;
  label: string;
  destId: string;
  custom?: CustomPlace;
  filters: Filters;
  durationH: number;
  alerts: boolean;
  createdAt: string;
  lastPrice?: number;
  lastSpaces?: number;
}

export interface SavedPlace { id: string; label: string; destId: string }

export interface NotifyPrefs { reminders: boolean; updates: boolean; priceAlerts: boolean; availability: boolean }
export interface Prefs {
  payment: PaymentMethodId;
  notify: NotifyPrefs;
  largeText: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  theme: "dark";
}

export interface User { name: string; email: string; phone: string; guest: boolean }

export interface Search {
  destId: string;
  custom?: CustomPlace;
  start: string; // ISO
  end: string; // ISO
  mode: BookingMode;
  filters: Filters;
  sort: SortKey;
}

export interface DemoState { clockOffsetMin: number; seed: number; nextPaymentFails: boolean }

/** The whole persisted app state (localStorage `parkly.app.v1`). */
export interface AppState {
  version: number;
  onboarded: boolean;
  user: User;
  vehicles: Vehicle[];
  defaultVehicleId: string;
  bookings: Booking[];
  savedIds: string[];
  savedSearches: SavedSearch[];
  savedPlaces: SavedPlace[];
  notifications: Notification[];
  recentDest: string[];
  recentlyViewed: string[];
  prefs: Prefs;
  search: Search;
  compareIds: string[];
  demo: DemoState;
}

/* ── seed shapes (turned into real records by engine.buildSeedState) ── */
export type SeedWhen = { relMin: number } | { day: number; time: string };
export interface SeedBooking {
  id: string;
  ref: string;
  fid: string;
  vehicle: number;
  start: SeedWhen;
  end: SeedWhen;
  arrived?: SeedWhen;
  exited?: SeedWhen;
  cancelled?: SeedWhen;
  refund?: Refund;
  method?: PaymentMethodId;
  mode?: BookingMode;
  ev?: boolean;
  promo?: string;
  bay: string;
  createdAgoH: number;
}
export interface SeedData {
  user: User;
  bookings: SeedBooking[];
  savedIds: string[];
  savedSearches: (Omit<SavedSearch, "filters" | "createdAt"> & { filters: Partial<Filters>; createdAgoH: number })[];
  savedPlaces: SavedPlace[];
  notifications: (Omit<Notification, "at"> & { agoH: number })[];
  recentDest: string[];
  prefs: Prefs;
}

export type MapPoint = [number, number]; // [lat, lng]
export interface MapGeometry {
  projection: { lng0: number; lat0: number; kx: number; ky: number; scale: number; note: string };
  river: MapPoint[];
  parks: MapPoint[][];
  roads: MapPoint[][];
  minorRoads: MapPoint[][];
  runways: MapPoint[][];
  labels: { text: string; at: MapPoint; big: boolean }[];
}

export interface ParklyData {
  vehicleTypes: VehicleType[];
  facilities: Facility[];
  destinations: Destination[];
  vehicles: Vehicle[];
  promos: Record<string, { label: string; describe: string }>;
  pricing: Pricing;
  vehicleMultipliers: Record<VehicleType, number>;
  vehicleLabels: Record<VehicleType, string>;
  policies: Record<PolicyId, { title: string; rules: string[] }>;
  busynessCurve: number[];
  typeLabels: Record<FilterType, string>;
  securityLabels: Record<SecurityId, string>;
  sortLabels: Record<SortKey, string>;
  statusLabels: Record<BookingStatus, string>;
  filterDefaults: Filters;
  paymentMethods: PaymentMethod[];
  requirements: string[];
  seed: SeedData;
  map: MapGeometry;
}


/** All static data, ported 1:1 from the prototype's data.js (window.PARKLY_DATA). */
export const D: ParklyData = {
  vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
  facilities: [
    {
      id: "cp-palika",
      name: "City Centre Secure Parking",
      area: "Connaught Place",
      address: "Palika Bazaar Underground, Inner Circle, Connaught Place, New Delhi 110001",
      lat: 28.6309,
      lng: 77.2183,
      type: "garage",
      covered: true,
      capacity: 220,
      rate: 50,
      dailyRate: 400,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      ev: { count: 8, kw: 30, connector: "CCS2 / Type 2", perKwh: 18 },
      amenities: ["Lift access", "Washrooms", "Valet on request", "Card & UPI at exit"],
      rating: 4.6,
      reviewCount: 1284,
      reviews: [
        {
          name: "Ananya K.",
          rating: 5,
          date: "2026-09-28",
          text: "Walked straight to my reserved bay on L2. Lift lands right at Block F.",
        },
        {
          name: "Rohit S.",
          rating: 4,
          date: "2026-09-12",
          text: "Ramp is tight for big SUVs but guards guide you in. Worth it on Saturdays.",
        },
        {
          name: "Meher J.",
          rating: 5,
          date: "2026-08-30",
          text: "EV charger was free when I arrived, as the app showed.",
        },
      ],
      heightLimit: 2.1,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 4050 2201",
      hue: 152,
      busyness: 0.82,
      levels: ["L1", "L2", "L3"],
      rules: [
        "Show booking pass at the boom barrier",
        "Grace period of 15 minutes after exit time",
        "No vehicle washing inside the basement",
      ],
      entry: [
        "Enter from Inner Circle via Gate 3 (opposite H-Block).",
        "Scan your pass at the right-hand lane barrier.",
        "Follow lime signage to your level and bay.",
      ],
    },
    {
      id: "cp-metro",
      name: "Metro Station Parking",
      area: "Barakhamba Road",
      address: "Barakhamba Road Metro, Gate 2, Connaught Place, New Delhi 110001",
      lat: 28.6285,
      lng: 77.2276,
      type: "uncovered",
      covered: false,
      capacity: 120,
      rate: 20,
      dailyRate: 150,
      open: "06:00",
      close: "23:30",
      is24h: false,
      overnight: false,
      security: ["cctv"],
      accessible: false,
      motorcycle: true,
      instant: true,
      amenities: ["Metro access", "Two-wheeler zone"],
      rating: 4.1,
      reviewCount: 642,
      reviews: [
        {
          name: "Karan M.",
          rating: 4,
          date: "2026-10-02",
          text: "Cheapest near CP. Park, take the Blue Line, done.",
        },
        { name: "Divya P.", rating: 4, date: "2026-09-18", text: "Open lot, so the car gets hot in afternoon sun." },
      ],
      heightLimit: null,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 2334 7710",
      hue: 205,
      busyness: 0.7,
      levels: ["Lot A", "Lot B"],
      rules: ["Closes at 23:30; vehicles left after closing are towed to the depot", "Two-wheelers park in Lot B only"],
      entry: [
        "Turn into Gate 2 service road beside the metro entry.",
        "Attendant scans your pass at the kiosk.",
        "Lot A is for cars, Lot B for two-wheelers.",
      ],
    },
    {
      id: "rajghat",
      name: "Riverside Public Parking",
      area: "Rajghat",
      address: "Ring Road, near Shanti Van, Rajghat, New Delhi 110006",
      lat: 28.6418,
      lng: 77.2488,
      type: "uncovered",
      covered: false,
      capacity: 260,
      rate: 15,
      dailyRate: 100,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      amenities: ["Bus & coach bays", "Drinking water"],
      rating: 3.9,
      reviewCount: 388,
      reviews: [
        {
          name: "Sanjay T.",
          rating: 4,
          date: "2026-09-21",
          text: "Big lot and easy to enter from Ring Road. Lighting at night could be better.",
        },
        {
          name: "Farah A.",
          rating: 4,
          date: "2026-08-14",
          text: "Good for an overnight park when visiting Old Delhi.",
        },
      ],
      heightLimit: null,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 2336 0918",
      hue: 190,
      busyness: 0.45,
      levels: ["North lot", "South lot"],
      rules: ["Overnight parking allowed", "Keep valuables out of sight"],
      entry: ["Enter from Ring Road service lane (southbound).", "Show pass at the gate cabin.", "Cars to the North lot."],
    },
    {
      id: "lajpat",
      name: "Central Market Parking",
      area: "Lajpat Nagar II",
      address: "Central Market, Lajpat Nagar II, New Delhi 110024",
      lat: 28.5677,
      lng: 77.2433,
      type: "uncovered",
      covered: false,
      capacity: 180,
      rate: 30,
      dailyRate: 200,
      open: "08:00",
      close: "22:30",
      is24h: false,
      overnight: false,
      security: ["cctv", "guarded"],
      accessible: false,
      motorcycle: true,
      instant: true,
      amenities: ["Market access", "Two-wheeler zone"],
      rating: 4,
      reviewCount: 917,
      reviews: [
        {
          name: "Pooja R.",
          rating: 4,
          date: "2026-10-05",
          text: "Saturday evenings fill up by 6. Booking ahead saved me a lot of circling.",
        },
        { name: "Vikram N.", rating: 3, date: "2026-09-02", text: "Exit lane gets jammed around 9 pm." },
      ],
      heightLimit: null,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "moderate",
      phone: "+91 11 2981 4432",
      hue: 38,
      busyness: 0.88,
      levels: ["Lane 1", "Lane 2", "Lane 3"],
      rules: ["Market closed Mondays; lot opens at 10:00 on Mondays", "Grace period 10 minutes"],
      entry: [
        "Enter from Ring Road side, next to the flyover.",
        "Guard scans your pass.",
        "Reserved bays are marked with green paint in Lane 1.",
      ],
    },
    {
      id: "nehru-place",
      name: "Business District Garage",
      area: "Nehru Place",
      address: "Multi-level Parking, Nehru Place, New Delhi 110019",
      lat: 28.5492,
      lng: 77.2526,
      type: "garage",
      covered: true,
      capacity: 500,
      rate: 40,
      dailyRate: 300,
      open: "07:00",
      close: "22:00",
      is24h: false,
      overnight: false,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      ev: { count: 6, kw: 22, connector: "Type 2", perKwh: 16 },
      amenities: ["Lift access", "Washrooms", "Office shuttle"],
      rating: 4.3,
      reviewCount: 756,
      reviews: [
        {
          name: "Arjun B.",
          rating: 5,
          date: "2026-09-30",
          text: "Monthly regular. Reserved floor means no hunting at 10 am.",
        },
        { name: "Sneha G.", rating: 4, date: "2026-09-09", text: "Ramps are steep but well lit." },
      ],
      heightLimit: 2.2,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "moderate",
      phone: "+91 11 4161 7700",
      hue: 168,
      busyness: 0.76,
      levels: ["B1", "G", "L1", "L2", "L3"],
      rules: ["Weekday peak 09:30–11:00", "Closed on national holidays"],
      entry: [
        "Enter from Outer Ring Road slip road.",
        "Use the lane marked “Pre-booked”.",
        "Your level is printed on the pass.",
      ],
    },
    {
      id: "igi-t3",
      name: "Airport Long-Stay Parking",
      area: "IGI Airport T3",
      address: "Terminal 3 Multi-Level Car Park, IGI Airport, New Delhi 110037",
      lat: 28.5555,
      lng: 77.0879,
      type: "covered",
      covered: true,
      capacity: 900,
      rate: 60,
      dailyRate: 600,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: false,
      instant: true,
      ev: { count: 20, kw: 60, connector: "CCS2", perKwh: 21 },
      amenities: ["Terminal walkway", "Trolleys", "Washrooms", "Long-stay rates"],
      rating: 4.5,
      reviewCount: 2210,
      reviews: [
        {
          name: "Ishaan D.",
          rating: 5,
          date: "2026-10-07",
          text: "Five-day trip, daily rate made it cheaper than two cab rides.",
        },
        {
          name: "Nisha V.",
          rating: 4,
          date: "2026-09-25",
          text: "Long walk from Level 4 to departures, give yourself 10 minutes.",
        },
      ],
      heightLimit: 2.1,
      vehicleTypes: ["hatchback", "sedan", "suv", "ev"],
      policy: "moderate",
      phone: "+91 124 337 6000",
      hue: 220,
      busyness: 0.62,
      levels: ["L1", "L2", "L3", "L4"],
      rules: ["Two-wheelers not permitted", "Long stays up to 7 days", "Security check at entry"],
      entry: [
        "Follow “T3 Car Park – Pre-booked” signs from NH48.",
        "Use lane 1 for ANPR plate recognition.",
        "Walk via the covered bridge to Departures.",
      ],
    },
    {
      id: "khan",
      name: "Khan Market Smart Parking",
      area: "Khan Market",
      address: "Rabindra Nagar side, Khan Market, New Delhi 110003",
      lat: 28.6005,
      lng: 77.2273,
      type: "garage",
      covered: true,
      capacity: 60,
      rate: 60,
      dailyRate: 450,
      open: "08:00",
      close: "23:00",
      is24h: false,
      overnight: false,
      security: ["cctv", "gated"],
      accessible: true,
      motorcycle: false,
      instant: true,
      amenities: ["Automated stack", "Valet"],
      rating: 4.4,
      reviewCount: 531,
      reviews: [
        {
          name: "Tara L.",
          rating: 5,
          date: "2026-10-01",
          text: "The only way to park at Khan Market on a Friday night.",
        },
        {
          name: "Dev C.",
          rating: 4,
          date: "2026-09-15",
          text: "Small automated stack, so the wait at exit can be 5 minutes.",
        },
      ],
      heightLimit: 1.9,
      vehicleTypes: ["hatchback", "sedan", "ev"],
      policy: "strict",
      phone: "+91 11 2469 8812",
      hue: 12,
      busyness: 0.96,
      levels: ["Stack A", "Stack B"],
      rules: [
        "Max height 1.9 m (no SUVs)",
        "Valet handles the stack; keep your key fob",
        "Exit retrieval takes up to 6 minutes",
      ],
      entry: [
        "Drive to the Rabindra Nagar gate.",
        "Valet scans your pass and takes the car.",
        "Request retrieval from the pass screen 10 minutes before you leave.",
      ],
    },
    {
      id: "saket",
      name: "Select Citywalk Mall Parking",
      area: "Saket",
      address: "A-3, District Centre, Saket, New Delhi 110017",
      lat: 28.5286,
      lng: 77.2193,
      type: "covered",
      covered: true,
      capacity: 700,
      rate: 40,
      dailyRate: 350,
      open: "09:00",
      close: "23:30",
      is24h: false,
      overnight: false,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      ev: { count: 10, kw: 30, connector: "CCS2 / Type 2", perKwh: 19 },
      amenities: ["Mall access", "Lift access", "Washrooms", "Car wash"],
      rating: 4.5,
      reviewCount: 1890,
      reviews: [
        {
          name: "Kabir H.",
          rating: 5,
          date: "2026-10-06",
          text: "Pre-booked lane at P2 skips the weekend queue completely.",
        },
        { name: "Ritika S.", rating: 4, date: "2026-09-20", text: "Car wash while you shop is handy." },
      ],
      heightLimit: 2.2,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 4211 4000",
      hue: 280,
      busyness: 0.72,
      levels: ["P1", "P2", "P3"],
      rules: ["Mall hours apply", "Car wash bookings at the P1 counter"],
      entry: [
        "Enter via Press Enclave Road gate.",
        "Keep left for the pre-booked lane.",
        "Scan pass, then follow signs to your level.",
      ],
    },
    {
      id: "aiims",
      name: "AIIMS Visitor Parking",
      area: "Ansari Nagar",
      address: "Gate 1 Visitor Lot, AIIMS, Ansari Nagar, New Delhi 110029",
      lat: 28.5675,
      lng: 77.2085,
      type: "uncovered",
      covered: false,
      capacity: 300,
      rate: 20,
      dailyRate: 160,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "guarded"],
      accessible: true,
      motorcycle: true,
      instant: true,
      amenities: ["Hospital access", "Wheelchair bays", "Drop-off zone"],
      rating: 3.8,
      reviewCount: 1022,
      reviews: [
        {
          name: "Manoj K.",
          rating: 4,
          date: "2026-09-29",
          text: "Booked for my father’s early appointment, had a bay waiting at 7 am.",
        },
        { name: "Aisha F.", rating: 3, date: "2026-09-03", text: "Crowded, but reserved bays are respected." },
      ],
      heightLimit: null,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 2658 8500",
      hue: 0,
      busyness: 0.9,
      levels: ["Visitor A", "Visitor B"],
      rules: ["Wheelchair bays reserved for blue-badge holders", "Ambulance lane must stay clear"],
      entry: [
        "Enter from Aurobindo Marg at Gate 1.",
        "Show pass to the guard.",
        "Reserved bays are in Visitor A, row 1–3.",
      ],
    },
    {
      id: "hkv",
      name: "Hauz Khas Village Lot",
      area: "Hauz Khas",
      address: "Hauz Khas Village Road, near Deer Park, New Delhi 110016",
      lat: 28.5536,
      lng: 77.1946,
      type: "uncovered",
      covered: false,
      capacity: 80,
      rate: 50,
      dailyRate: 300,
      open: "10:00",
      close: "23:30",
      is24h: false,
      overnight: false,
      security: ["guarded"],
      accessible: false,
      motorcycle: true,
      instant: false,
      amenities: ["Valet"],
      rating: 3.7,
      reviewCount: 412,
      reviews: [
        { name: "Neel R.", rating: 4, date: "2026-09-27", text: "Valet is quick even on a busy evening." },
        { name: "Simran B.", rating: 3, date: "2026-09-11", text: "Narrow lane to get in. Pre-booking helps." },
      ],
      heightLimit: null,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "moderate",
      phone: "+91 98110 44120",
      hue: 60,
      busyness: 0.8,
      levels: ["Lot"],
      rules: ["Operator confirms each booking (usually within a minute)", "Valet only after 19:00"],
      entry: ["Enter from Hauz Khas Village Road.", "Hand the pass to the valet.", "Collect your car from the same gate."],
    },
    {
      id: "jorbagh",
      name: "Private Driveway · Jor Bagh",
      area: "Jor Bagh",
      address: "172 Jor Bagh (side gate), New Delhi 110003",
      lat: 28.5878,
      lng: 77.2168,
      type: "driveway",
      covered: false,
      capacity: 2,
      rate: 35,
      dailyRate: 250,
      open: "08:00",
      close: "21:00",
      is24h: false,
      overnight: false,
      security: ["gated"],
      accessible: false,
      motorcycle: false,
      instant: false,
      amenities: ["Residential street", "Host on site"],
      rating: 4.8,
      reviewCount: 64,
      reviews: [
        {
          name: "Leela M.",
          rating: 5,
          date: "2026-09-19",
          text: "Lovely host. Five minutes to Lodhi Garden on foot.",
        },
        { name: "Harsh P.", rating: 5, date: "2026-08-22", text: "Quiet street, gate opens with the pass code." },
      ],
      heightLimit: 2,
      vehicleTypes: ["hatchback", "sedan", "ev"],
      policy: "moderate",
      phone: "+91 98990 12034",
      hue: 100,
      busyness: 0.4,
      levels: ["Driveway"],
      rules: ["Host confirms each booking", "Do not block the neighbour’s gate", "No two-wheelers"],
      entry: [
        "Use the side gate on the lane behind 172 Jor Bagh.",
        "Enter the 4-digit code shown on your pass.",
        "Park nose-in on the left side.",
      ],
    },
    {
      id: "karolbagh",
      name: "Karol Bagh Market Parking",
      area: "Karol Bagh",
      address: "Ajmal Khan Road Multi-level Parking, Karol Bagh, New Delhi 110005",
      lat: 28.6514,
      lng: 77.1909,
      type: "garage",
      covered: true,
      capacity: 400,
      rate: 25,
      dailyRate: 180,
      open: "08:00",
      close: "22:30",
      is24h: false,
      overnight: false,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      amenities: ["Lift access", "Two-wheeler deck"],
      rating: 4,
      reviewCount: 678,
      reviews: [
        { name: "Gaurav L.", rating: 4, date: "2026-10-04", text: "Good value and a short walk to Ajmal Khan Road." },
        {
          name: "Priya D.",
          rating: 4,
          date: "2026-09-06",
          text: "Two-wheeler deck is separate, which keeps the car ramps clear.",
        },
      ],
      heightLimit: 2.1,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 2575 3301",
      hue: 25,
      busyness: 0.74,
      levels: ["G", "L1", "L2", "L3", "L4"],
      rules: ["Market closed Mondays", "Grace period 15 minutes"],
      entry: ["Enter from Pusa Road side.", "Scan pass at lane 2.", "Cars from L1 upward; two-wheelers at G."],
    },
    {
      id: "aerocity-ev",
      name: "Aerocity EV Hub",
      area: "Aerocity",
      address: "Asset 9, Hospitality District, Aerocity, New Delhi 110037",
      lat: 28.5504,
      lng: 77.1203,
      type: "ev",
      covered: true,
      capacity: 90,
      rate: 45,
      dailyRate: 380,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "gated"],
      accessible: true,
      motorcycle: false,
      instant: true,
      ev: { count: 32, kw: 60, connector: "CCS2 / Type 2", perKwh: 20 },
      amenities: ["Fast charging", "Lounge", "Washrooms", "Airport shuttle"],
      rating: 4.7,
      reviewCount: 296,
      reviews: [
        {
          name: "Yash A.",
          rating: 5,
          date: "2026-10-08",
          text: "Charged from 20% to 80% while I had lunch. Shuttle to T3 every 20 min.",
        },
        { name: "Mira T.", rating: 5, date: "2026-09-17", text: "Clean, bright and every charger worked." },
      ],
      heightLimit: 2.3,
      vehicleTypes: ["hatchback", "sedan", "suv", "ev"],
      policy: "flexible",
      phone: "+91 11 4920 8800",
      hue: 140,
      busyness: 0.55,
      levels: ["Ground"],
      rules: ["EV bays for electric vehicles while charging", "Idle fee applies after charging completes"],
      entry: [
        "Enter from Aerocity main road, Asset 9.",
        "Scan pass; charger number is on your pass.",
        "Plug in and start from the charger screen.",
      ],
    },
    {
      id: "chandni",
      name: "Chandni Chowk Multilevel",
      area: "Chandni Chowk",
      address: "Gandhi Maidan Multi-level Parking, Chandni Chowk, Delhi 110006",
      lat: 28.6566,
      lng: 77.2296,
      type: "garage",
      covered: true,
      capacity: 600,
      rate: 30,
      dailyRate: 200,
      open: "07:00",
      close: "22:00",
      is24h: false,
      overnight: false,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      amenities: ["Lift access", "E-rickshaw stand"],
      rating: 4.1,
      reviewCount: 845,
      reviews: [
        {
          name: "Rahul V.",
          rating: 4,
          date: "2026-09-26",
          text: "Park here and take an e-rickshaw down Chandni Chowk.",
        },
        {
          name: "Zoya Q.",
          rating: 4,
          date: "2026-09-01",
          text: "Huge building, rarely full if you come before noon.",
        },
      ],
      heightLimit: 2.1,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 11 2386 5512",
      hue: 330,
      busyness: 0.6,
      levels: ["B2", "B1", "G", "L1", "L2"],
      rules: ["Closed on Sundays after 18:00", "Two-wheelers at B2"],
      entry: [
        "Enter from Esplanade Road.",
        "Scan pass at the pre-booked kiosk.",
        "Exit to the e-rickshaw stand at gate 4.",
      ],
    },
    {
      id: "cyberhub",
      name: "Cyber Hub Parking",
      area: "DLF Cyber City, Gurugram",
      address: "Cyber Hub, DLF Cyber City Phase 2, Gurugram 122002",
      lat: 28.495,
      lng: 77.089,
      type: "garage",
      covered: true,
      capacity: 550,
      rate: 60,
      dailyRate: 500,
      open: "00:00",
      close: "23:59",
      is24h: true,
      overnight: true,
      security: ["cctv", "guarded", "gated"],
      accessible: true,
      motorcycle: true,
      instant: true,
      ev: { count: 12, kw: 50, connector: "CCS2", perKwh: 22 },
      amenities: ["Lift access", "Washrooms", "Valet"],
      rating: 4.4,
      reviewCount: 1530,
      reviews: [
        {
          name: "Aditi N.",
          rating: 5,
          date: "2026-10-03",
          text: "Friday dinner without the 20-minute parking queue.",
        },
        {
          name: "Siddharth K.",
          rating: 4,
          date: "2026-09-13",
          text: "Expensive but secure and right at the food court.",
        },
      ],
      heightLimit: 2.2,
      vehicleTypes: ["hatchback", "sedan", "suv", "motorcycle", "ev"],
      policy: "strict",
      phone: "+91 124 456 9000",
      hue: 250,
      busyness: 0.78,
      levels: ["B1", "B2", "B3"],
      rules: ["Night rate applies after 23:00 (included in price)", "Valet available after 18:00"],
      entry: [
        "Enter from Cyber City loop road, gate C.",
        "Use the left lane for pre-booked passes.",
        "Lift lobby B leads to Cyber Hub.",
      ],
    },
    {
      id: "defcol",
      name: "Private Driveway · Defence Colony",
      area: "Defence Colony",
      address: "C-Block Lane 4, Defence Colony, New Delhi 110024",
      lat: 28.5733,
      lng: 77.2316,
      type: "driveway",
      covered: true,
      capacity: 1,
      rate: 40,
      open: "07:00",
      close: "22:00",
      is24h: false,
      overnight: false,
      security: ["gated", "cctv"],
      accessible: false,
      motorcycle: true,
      instant: true,
      amenities: ["Covered carport", "Host on site"],
      rating: 4.9,
      reviewCount: 38,
      reviews: [
        {
          name: "Kriti S.",
          rating: 5,
          date: "2026-09-24",
          text: "Covered carport, five minutes to Defence Colony market.",
        },
      ],
      heightLimit: 2,
      vehicleTypes: ["hatchback", "sedan", "motorcycle", "ev"],
      policy: "flexible",
      phone: "+91 98100 77231",
      hue: 80,
      busyness: 0.5,
      levels: ["Carport"],
      rules: ["Single space; one vehicle at a time", "No SUVs"],
      entry: [
        "Lane 4 behind C-Block, look for the green gate.",
        "Gate code is on your pass.",
        "Park in the carport and close the gate.",
      ],
    },
  ],
  destinations: [
    {
      id: "cp",
      name: "Connaught Place",
      area: "Central Delhi",
      lat: 28.6315,
      lng: 77.2167,
      kind: "Shopping & offices",
    },
    { id: "khan", name: "Khan Market", area: "Rabindra Nagar", lat: 28.6003, lng: 77.227, kind: "Market" },
    { id: "indiagate", name: "India Gate", area: "Kartavya Path", lat: 28.6129, lng: 77.2295, kind: "Landmark" },
    { id: "aiims", name: "AIIMS Hospital", area: "Ansari Nagar", lat: 28.5672, lng: 77.21, kind: "Hospital" },
    {
      id: "lajpat",
      name: "Lajpat Nagar Central Market",
      area: "Lajpat Nagar II",
      lat: 28.5679,
      lng: 77.2436,
      kind: "Market",
    },
    {
      id: "nehru",
      name: "Nehru Place",
      area: "South Delhi",
      lat: 28.5494,
      lng: 77.2519,
      kind: "Business district",
    },
    { id: "saket", name: "Select Citywalk", area: "Saket", lat: 28.5285, lng: 77.219, kind: "Mall" },
    { id: "hkv", name: "Hauz Khas Village", area: "Hauz Khas", lat: 28.554, lng: 77.194, kind: "Restaurants" },
    { id: "lodhi", name: "Lodhi Garden", area: "Lodhi Estate", lat: 28.5931, lng: 77.2197, kind: "Park" },
    { id: "karol", name: "Karol Bagh", area: "Central Delhi", lat: 28.6519, lng: 77.1909, kind: "Market" },
    { id: "chandni", name: "Chandni Chowk", area: "Old Delhi", lat: 28.6562, lng: 77.231, kind: "Market" },
    { id: "redfort", name: "Red Fort", area: "Old Delhi", lat: 28.6562, lng: 77.241, kind: "Landmark" },
    { id: "t3", name: "IGI Airport Terminal 3", area: "New Delhi", lat: 28.5562, lng: 77.087, kind: "Airport" },
    {
      id: "aerocity",
      name: "Aerocity",
      area: "Hospitality District",
      lat: 28.5505,
      lng: 77.1205,
      kind: "Hotels",
    },
    {
      id: "cyberhub",
      name: "Cyber Hub",
      area: "Gurugram",
      lat: 28.4952,
      lng: 77.0886,
      kind: "Restaurants & offices",
    },
    {
      id: "defcol",
      name: "Defence Colony Market",
      area: "Defence Colony",
      lat: 28.5745,
      lng: 77.233,
      kind: "Market",
    },
  ],
  vehicles: [
    { id: "v-swift", name: "Maruti Swift", plate: "DL 8C AF 4521", type: "hatchback", color: "Pearl white" },
    { id: "v-creta", name: "Hyundai Creta", plate: "DL 1C AK 9087", type: "suv", color: "Titan grey" },
    { id: "v-nexon", name: "Tata Nexon EV", plate: "DL 3C EV 2210", type: "ev", color: "Teal blue" },
    { id: "v-activa", name: "Honda Activa", plate: "DL 7S BQ 6612", type: "motorcycle", color: "Matte black" },
  ],
  promos: {
    PARK10: { label: "10% off parking", describe: "10% off the parking charge, up to ₹100" },
    FIRSTPARK: { label: "₹50 off", describe: "₹50 off bookings of ₹150 or more" },
    WEEKEND20: { label: "20% off weekends", describe: "20% off Saturday and Sunday bookings, up to ₹150" },
  },
  pricing: { convenienceFee: 15, gst: 0.18, evReserve: 49, billingStepMin: 30, overstayMultiplier: 1.5 },
  vehicleMultipliers: { hatchback: 1, sedan: 1, suv: 1.2, motorcycle: 0.5, ev: 1 },
  vehicleLabels: { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", motorcycle: "Motorcycle", ev: "Electric vehicle" },
  policies: {
    flexible: {
      title: "Flexible",
      rules: ["Full refund up to 1 hour before entry", "50% refund within 1 hour of entry", "No refund after entry time"],
    },
    moderate: {
      title: "Moderate",
      rules: [
        "Full refund up to 24 hours before entry",
        "50% refund up to 2 hours before entry",
        "No refund within 2 hours of entry",
      ],
    },
    strict: { title: "Strict", rules: ["50% refund up to 24 hours before entry", "No refund within 24 hours of entry"] },
  },
  busynessCurve: [
    0.18,
    0.15,
    0.12,
    0.12,
    0.12,
    0.15,
    0.25,
    0.4,
    0.6,
    0.75,
    0.82,
    0.88,
    0.9,
    0.86,
    0.78,
    0.74,
    0.8,
    0.92,
    1,
    1,
    0.95,
    0.8,
    0.55,
    0.32,
  ],
  typeLabels: {
    covered: "Covered",
    uncovered: "Open-air",
    garage: "Multi-level garage",
    driveway: "Private driveway",
    ev: "EV charging hub",
  },
  securityLabels: { cctv: "CCTV", guarded: "Guarded entry", gated: "Gated access" },
  sortLabels: {
    recommended: "Recommended",
    price: "Lowest price",
    distance: "Closest",
    rating: "Highest rated",
    spaces: "Most spaces",
  },
  statusLabels: {
    pending: "Awaiting operator",
    upcoming: "Upcoming",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  filterDefaults: {
    maxPrice: 0,
    maxDistance: 5,
    types: [],
    security: [],
    accessible: false,
    ev: false,
    motorcycle: false,
    overnight: false,
    instant: false,
    minRating: 0,
    onlyAvailable: false,
  },
  paymentMethods: [
    { id: "upi", label: "UPI", detail: "riya@okaxis" },
    { id: "card", label: "Card", detail: "Visa ending 4242" },
    { id: "wallet", label: "PARKLY Wallet", detail: "Balance ₹1,250", balance: 1250 },
  ],
  requirements: ["EV charging", "Accessible bay", "Near the exit", "Extra-wide bay", "Covered bay"],
  seed: {
    user: { name: "Riya Sharma", email: "riya.sharma@example.com", phone: "+91 98765 43210", guest: false },
    bookings: [
      {
        id: "b-active",
        ref: "PK-7HQK-42",
        fid: "cp-palika",
        vehicle: 0,
        start: { relMin: -60 },
        end: { relMin: 120 },
        arrived: { relMin: -50 },
        bay: "L2 · Bay 14",
        createdAgoH: 20,
      },
      {
        id: "b-saket",
        ref: "PK-M2TR-18",
        fid: "saket",
        vehicle: 1,
        start: { day: 1, time: "17:00" },
        end: { day: 1, time: "20:00" },
        method: "card",
        bay: "P2 · Bay 31",
        createdAgoH: 6,
      },
      {
        id: "b-airport",
        ref: "PK-AX9D-73",
        fid: "igi-t3",
        vehicle: 2,
        start: { day: 4, time: "05:30" },
        end: { day: 7, time: "23:00" },
        mode: "daily",
        ev: true,
        promo: "PARK10",
        bay: "L3 · Bay 08",
        createdAgoH: 30,
      },
      {
        id: "b-lajpat",
        ref: "PK-Q4LN-09",
        fid: "lajpat",
        vehicle: 0,
        start: { day: -6, time: "18:00" },
        end: { day: -6, time: "20:00" },
        arrived: { day: -6, time: "18:04" },
        exited: { day: -6, time: "19:52" },
        method: "wallet",
        bay: "Lane 1",
        createdAgoH: 26,
      },
      {
        id: "b-aiims",
        ref: "PK-HT7C-55",
        fid: "aiims",
        vehicle: 1,
        start: { day: -12, time: "07:00" },
        end: { day: -12, time: "12:00" },
        arrived: { day: -12, time: "06:58" },
        exited: { day: -12, time: "11:40" },
        bay: "Visitor A · Bay 03",
        createdAgoH: 14,
      },
      {
        id: "b-khan",
        ref: "PK-ZR3W-61",
        fid: "khan",
        vehicle: 0,
        start: { day: -2, time: "19:00" },
        end: { day: -2, time: "22:00" },
        bay: "Stack B",
        createdAgoH: 50,
        cancelled: { day: -4, time: "12:10" },
        refund: { amount: 106, percent: 50, note: "50% refund under the strict policy, after the ₹18 non-refundable fee." },
      },
    ],
    savedIds: ["khan", "igi-t3", "nehru-place", "aerocity-ev"],
    savedSearches: [
      {
        id: "ss-khan",
        label: "Khan Market · Friday evening",
        destId: "khan",
        filters: { maxDistance: 2, types: ["covered"] },
        durationH: 3,
        alerts: true,
        createdAgoH: 120,
        lastPrice: 60,
        lastSpaces: 4,
      },
    ],
    savedPlaces: [
      { id: "sp-home", label: "Home", destId: "defcol" },
      { id: "sp-work", label: "Work", destId: "nehru" },
    ],
    notifications: [
      {
        id: "n1",
        kind: "confirmed",
        title: "Booking confirmed",
        body: "City Centre Secure Parking, L2 · Bay 14. Pass is ready in Bookings.",
        agoH: 20,
        read: false,
        bookingId: "b-active",
      },
      {
        id: "n2",
        kind: "availability",
        title: "Spaces opened up at Khan Market",
        body: "6 spaces are now free this Friday 7–10 pm.",
        agoH: 3,
        read: false,
        facilityId: "khan",
      },
      {
        id: "n3",
        kind: "reminder",
        title: "Tomorrow: Select Citywalk at 5:00 pm",
        body: "Hyundai Creta · P2 · Bay 31. Use the pre-booked lane.",
        agoH: 5,
        read: true,
        bookingId: "b-saket",
      },
      {
        id: "n4",
        kind: "cancelled",
        title: "Booking cancelled",
        body: "Khan Market Smart Parking. ₹106 refunded to UPI.",
        agoH: 96,
        read: true,
        bookingId: "b-khan",
      },
      {
        id: "n5",
        kind: "price",
        title: "Price alert: Aerocity EV Hub",
        body: "Daily rate holds at ₹380 for your saved search.",
        agoH: 26,
        read: true,
        facilityId: "aerocity-ev",
      },
    ],
    recentDest: ["khan", "saket", "t3"],
    prefs: {
      payment: "upi",
      notify: { reminders: true, updates: true, priceAlerts: true, availability: true },
      largeText: false,
      reduceMotion: false,
      highContrast: false,
      theme: "dark",
    },
  },
  map: {
    projection: {
      lng0: 77.03,
      lat0: 28.71,
      kx: 97.7,
      ky: 110.6,
      scale: 40,
      note: "x=(lng-lng0)*kx*scale, y=(lat0-lat)*ky*scale; 1 km ≈ scale px",
    },
    river: [
      [28.72, 77.226],
      [28.69, 77.232],
      [28.665, 77.243],
      [28.64, 77.256],
      [28.615, 77.262],
      [28.59, 77.268],
      [28.565, 77.283],
      [28.54, 77.302],
      [28.51, 77.315],
      [28.45, 77.33],
    ],
    parks: [
      [
        [28.62, 77.14],
        [28.645, 77.165],
        [28.675, 77.2],
        [28.67, 77.212],
        [28.645, 77.19],
        [28.61, 77.165],
        [28.595, 77.15],
      ],
      [[28.597, 77.214], [28.597, 77.225], [28.589, 77.225], [28.589, 77.214]],
      [[28.535, 77.165], [28.54, 77.185], [28.525, 77.19], [28.518, 77.172]],
      [[28.558, 77.188], [28.558, 77.2], [28.548, 77.2], [28.548, 77.188]],
      [[28.617, 77.22], [28.617, 77.236], [28.611, 77.236], [28.611, 77.22]],
      [[28.64, 77.243], [28.652, 77.25], [28.645, 77.255], [28.635, 77.249]],
    ],
    roads: [
      [
        [28.665, 77.17],
        [28.685, 77.21],
        [28.666, 77.244],
        [28.625, 77.258],
        [28.585, 77.258],
        [28.566, 77.243],
        [28.567, 77.205],
        [28.585, 77.165],
        [28.63, 77.15],
        [28.665, 77.17],
      ],
      [[28.6, 77.06], [28.555, 77.13], [28.53, 77.2], [28.535, 77.25], [28.55, 77.29]],
      [[28.595, 77.17], [28.56, 77.125], [28.535, 77.1], [28.5, 77.085], [28.45, 77.065]],
      [[28.625, 77.245], [28.59, 77.25], [28.56, 77.265], [28.52, 77.29]],
      [[28.612, 77.215], [28.575, 77.207], [28.54, 77.2], [28.5, 77.19]],
    ],
    minorRoads: [
      [[28.6315, 77.2167], [28.6129, 77.2295]],
      [[28.6315, 77.2167], [28.655, 77.192]],
      [[28.6315, 77.2167], [28.657, 77.232]],
      [[28.6129, 77.2295], [28.6, 77.227], [28.57, 77.232]],
      [[28.6129, 77.2295], [28.628, 77.245]],
      [[28.6, 77.227], [28.6, 77.2]],
      [[28.567, 77.205], [28.555, 77.19], [28.553, 77.16]],
      [[28.553, 77.16], [28.552, 77.12]],
      [[28.55, 77.25], [28.53, 77.22]],
      [[28.6315, 77.2167], [28.618, 77.198], [28.6, 77.2]],
    ],
    runways: [
      [[28.575, 77.07], [28.577, 77.073], [28.55, 77.115], [28.548, 77.112]],
      [[28.567, 77.08], [28.569, 77.083], [28.545, 77.12], [28.543, 77.117]],
    ],
    labels: [
      { text: "CONNAUGHT PLACE", at: [28.636, 77.219], big: true },
      { text: "OLD DELHI", at: [28.661, 77.226], big: true },
      { text: "KAROL BAGH", at: [28.648, 77.181], big: false },
      { text: "LUTYENS DELHI", at: [28.604, 77.205], big: true },
      { text: "SOUTH DELHI", at: [28.54, 77.225], big: true },
      { text: "IGI AIRPORT", at: [28.563, 77.1], big: true },
      { text: "GURUGRAM", at: [28.48, 77.1], big: true },
      { text: "Yamuna", at: [28.6, 77.272], big: false },
      { text: "Ridge", at: [28.64, 77.18], big: false },
      { text: "Lodhi Garden", at: [28.586, 77.22], big: false },
      { text: "AEROCITY", at: [28.545, 77.13], big: false },
      { text: "SAKET", at: [28.522, 77.212], big: false },
      { text: "NEHRU PLACE", at: [28.543, 77.258], big: false },
    ],
  },
};

export default D;

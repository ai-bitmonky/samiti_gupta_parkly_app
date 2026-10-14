/* Mobile screen registry. MobileShell renders these by route name; app/<route>/page.tsx keeps the same names.
   Builder A owns ./screens-a (welcome → confirmation), builder B owns ./screens-b (bookings → profile). */
export { Home, Welcome, Explore, MapScreen, Facility, Reserve, Checkout, Confirmation } from "./screens-a";
export { Bookings, BookingDetail, Arrive, Saved, Compare, Notifications, Profile } from "./screens-b";

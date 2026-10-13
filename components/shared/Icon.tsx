/* Icon by prototype name (same 80 names as engine.js icon()), rendered with lucide-react.
   <Icon name="zap" size={14} className="..."/>  → <svg class="ico ..."> (core.css .ico rules apply) */
import {
  AlarmClock, Accessibility, ArrowLeft, ArrowRight, ArrowUpRight, BellOff, Bell, Bike, BookmarkCheck, BookmarkPlus,
  CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, Car, CheckCheck, Check, ChevronRight, CircleCheck, CircleHelp,
  CircleX, Clock, Compass, Copy, CreditCard, Crosshair, FastForward, FileText, Footprints, Heart, Info, List, LoaderCircle,
  LocateFixed, Lock, LogOut, MapPin, Map as MapIcon, Minus, Moon, Navigation, Pencil, Phone, Plane, Plus, QrCode, Receipt,
  RefreshCw, RotateCcw, Ruler, Scale, SearchX, Search, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Sun, Tag,
  Timer, TriangleAlert, User, Wallet, X, Zap, House, Briefcase, Umbrella, Video, ChevronLeft, ChevronDown, ChevronUp, Trash2,
  Download, Layers, Columns2, Menu, Ellipsis, DoorOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  "alarm-clock": AlarmClock, accessibility: Accessibility, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight, "bell-off": BellOff, bell: Bell, bike: Bike, "bookmark-check": BookmarkCheck,
  "bookmark-plus": BookmarkPlus, "calendar-check": CalendarCheck, "calendar-clock": CalendarClock, "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus, car: Car, "check-check": CheckCheck, check: Check, "chevron-right": ChevronRight,
  "circle-check": CircleCheck, "circle-help": CircleHelp, "circle-x": CircleX, clock: Clock, compass: Compass, copy: Copy,
  "credit-card": CreditCard, crosshair: Crosshair, "fast-forward": FastForward, "file-text": FileText, footprints: Footprints,
  heart: Heart, info: Info, list: List, "loader-circle": LoaderCircle, "locate-fixed": LocateFixed, lock: Lock, "log-out": LogOut,
  "map-pin": MapPin, map: MapIcon, minus: Minus, moon: Moon, navigation: Navigation, pencil: Pencil, phone: Phone, plane: Plane,
  plus: Plus, "qr-code": QrCode, receipt: Receipt, "refresh-cw": RefreshCw, "rotate-ccw": RotateCcw, ruler: Ruler, scale: Scale,
  "search-x": SearchX, search: Search, "shield-check": ShieldCheck, "sliders-horizontal": SlidersHorizontal, smartphone: Smartphone,
  sparkles: Sparkles, star: Star, sun: Sun, tag: Tag, timer: Timer, "triangle-alert": TriangleAlert, user: User, wallet: Wallet,
  x: X, zap: Zap, house: House, briefcase: Briefcase, umbrella: Umbrella, video: Video, "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown, "chevron-up": ChevronUp, trash: Trash2, download: Download, layers: Layers, columns: Columns2,
  menu: Menu, more: Ellipsis, door: DoorOpen,
};
export type IconName = keyof typeof ICONS;

export default function Icon({ name, size = 18, className = "", strokeWidth = 2, title }: { name: string; size?: number; className?: string; strokeWidth?: number; title?: string }) {
  const C = ICONS[name] || Info;
  return <C className={`ico ${className}`.trim()} width={size} height={size} strokeWidth={strokeWidth} aria-hidden={title ? undefined : true} aria-label={title} />;
}

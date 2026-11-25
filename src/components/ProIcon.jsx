import React from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Award,
  Baby,
  BadgeCheck,
  Bandage,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Database,
  Download,
  Droplet,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  FlaskConical,
  Folder,
  FolderOpen,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Home,
  Hospital,
  Hourglass,
  IdCard,
  Image,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  Laptop,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  Map,
  MapPin,
  Medal,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  Microscope,
  Moon,
  Navigation,
  Package,
  Palette,
  Paperclip,
  PenTool,
  Phone,
  PhoneCall,
  Pill,
  Play,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  Radio,
  Receipt,
  RefreshCw,
  Rocket,
  Save,
  ScanLine,
  ScrollText,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sliders,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Sun,
  Syringe,
  Target,
  Thermometer,
  Trash2,
  TrendingUp,
  Trophy,
  Unlock,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Volume2,
  Wallet,
  Wrench,
  X,
  XCircle,
  Zap,
  Ban,
  Brain,
  Bone
} from 'lucide-react';

/**
 * Drapeau officiel du Sénégal en SVG vectoriel net (remplace l'emoji 🇸🇳).
 */
export function SenegalFlag({ size = 16, className = '', style = {} }) {
  const w = typeof size === 'number' ? Math.round(size * 1.45) : '1.35em';
  const h = typeof size === 'number' ? size : '0.95em';
  return (
    <svg
      viewBox="0 0 30 20"
      width={w}
      height={h}
      aria-label="Sénégal"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: '-0.14em',
        borderRadius: '2px',
        boxShadow: '0 0 0 0.5px rgba(15,23,42,0.18)',
        flexShrink: 0,
        ...style
      }}
    >
      <rect x="0" y="0" width="10" height="20" fill="#00853F" />
      <rect x="10" y="0" width="10" height="20" fill="#FDEF42" />
      <rect x="20" y="0" width="10" height="20" fill="#E31B23" />
      <polygon
        points="15,5.5 16.1,8.8 19.6,8.8 16.8,10.8 17.8,14.1 15,12.1 12.2,14.1 13.2,10.8 10.4,8.8 13.9,8.8"
        fill="#00853F"
      />
    </svg>
  );
}

/**
 * Registre central d'icônes professionnelles (Lucide React) pour toute la plateforme
 * UNAMUSC / SenMutuelles. Remplace définitivement les emojis génériques.
 */
export const ICON_MAP = {
  // Navigation & structure
  home: Home,
  menu: Menu,
  search: Search,
  settings: Settings,
  sliders: Sliders,
  wrench: Wrench,
  globe: Globe,
  link: Link2,
  'external-link': ExternalLink,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'chevron-right': ChevronRight,
  filter: Filter,
  layers: Layers,
  database: Database,
  laptop: Laptop,
  smartphone: Smartphone,
  qrcode: QrCode,
  scan: ScanLine,

  // Statuts & actions
  check: Check,
  'check-circle': CheckCircle2,
  'badge-check': BadgeCheck,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'x-circle': XCircle,
  x: X,
  ban: Ban,
  info: Info,
  help: HelpCircle,
  plus: Plus,
  'plus-circle': PlusCircle,
  trash: Trash2,
  edit: Edit3,
  'pen-tool': PenTool,
  save: Save,
  copy: Copy,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  printer: Printer,
  eye: Eye,
  'eye-off': EyeOff,
  send: Send,
  share: Share2,
  play: Play,
  logout: LogOut,
  'status-green': Circle,
  'status-red': Circle,
  'status-amber': Circle,

  // Sécurité & accès
  lock: Lock,
  unlock: Unlock,
  key: KeyRound,
  shield: Shield,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  siren: Siren,

  // Santé & médical (CSU / UNAMUSC)
  hospital: Hospital,
  stethoscope: Stethoscope,
  pill: Pill,
  syringe: Syringe,
  bandage: Bandage,
  'heart-pulse': HeartPulse,
  heart: Heart,
  'heart-handshake': HeartHandshake,
  activity: Activity,
  droplet: Droplet,
  flask: FlaskConical,
  microscope: Microscope,
  thermometer: Thermometer,
  baby: Baby,
  brain: Brain,
  bone: Bone,

  // Finance, paiements & cotisations
  'credit-card': CreditCard,
  wallet: Wallet,
  banknote: Banknote,
  coins: Coins,
  receipt: Receipt,
  'bar-chart': BarChart3,
  'trending-up': TrendingUp,

  // Documents & administration
  'file-text': FileText,
  'file-check': FileCheck,
  'file-spreadsheet': FileSpreadsheet,
  'scroll-text': ScrollText,
  clipboard: Clipboard,
  'clipboard-list': ClipboardList,
  'clipboard-check': ClipboardCheck,
  'list-checks': ListChecks,
  folder: Folder,
  'folder-open': FolderOpen,
  archive: Archive,
  'id-card': IdCard,
  'book-open': BookOpen,
  paperclip: Paperclip,
  inbox: Inbox,

  // Utilisateurs & institutions
  user: User,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  users: Users,
  crown: Crown,
  briefcase: Briefcase,
  building: Building,
  building2: Building2,
  landmark: Landmark,
  'graduation-cap': GraduationCap,
  handshake: Handshake,

  // Communication, médias & localisation
  bell: Bell,
  phone: Phone,
  'phone-call': PhoneCall,
  mail: Mail,
  'message-square': MessageSquare,
  'message-circle': MessageCircle,
  megaphone: Megaphone,
  radio: Radio,
  camera: Camera,
  video: Video,
  image: Image,
  mic: Mic,
  volume: Volume2,
  'map-pin': MapPin,
  map: Map,
  navigation: Navigation,

  // Temps, récompenses & divers
  clock: Clock,
  hourglass: Hourglass,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  sun: Sun,
  moon: Moon,
  sparkles: Sparkles,
  zap: Zap,
  lightbulb: Lightbulb,
  flame: Flame,
  star: Star,
  award: Award,
  medal: Medal,
  trophy: Trophy,
  gift: Gift,
  package: Package,
  target: Target,
  rocket: Rocket,
  palette: Palette,
  sprout: Sprout
};

/**
 * Correspondance complète Emoji → { name, color? } pour remplacer automatiquement
 * tous les emojis UI par des icônes vectorielles Lucide cohérentes.
 */
export const EMOJI_TO_ICON = {
  '🇸🇳': { flag: true },
  '✅': { name: 'check-circle', color: '#059669' },
  '✔': { name: 'check', color: '#059669' },
  '✓': { name: 'check', color: '#059669' },
  '⚠': { name: 'alert-triangle', color: '#d97706' },
  '⚠️': { name: 'alert-triangle', color: '#d97706' },
  '❌': { name: 'x-circle', color: '#dc2626' },
  '✖': { name: 'x' },
  '✕': { name: 'x' },
  '⛔': { name: 'ban', color: '#dc2626' },
  '🚫': { name: 'ban', color: '#dc2626' },
  '🟢': { name: 'status-green', color: '#10b981', fill: '#10b981', sizeScale: 0.65 },
  '🔴': { name: 'status-red', color: '#ef4444', fill: '#ef4444', sizeScale: 0.65 },
  '🟡': { name: 'status-amber', color: '#f59e0b', fill: '#f59e0b', sizeScale: 0.65 },
  '🟠': { name: 'status-amber', color: '#f97316', fill: '#f97316', sizeScale: 0.65 },
  '🔵': { name: 'status-green', color: '#3b82f6', fill: '#3b82f6', sizeScale: 0.65 },
  '💊': { name: 'pill' },
  '🏥': { name: 'hospital' },
  '🩺': { name: 'stethoscope' },
  '💉': { name: 'syringe' },
  '🩹': { name: 'bandage' },
  '🩸': { name: 'droplet', color: '#dc2626' },
  '🧪': { name: 'flask' },
  '🔬': { name: 'microscope' },
  '🧬': { name: 'activity' },
  '🩻': { name: 'scan' },
  '🦴': { name: 'bone' },
  '🧠': { name: 'brain' },
  '🫀': { name: 'heart-pulse', color: '#dc2626' },
  '🫁': { name: 'activity' },
  '🌡️': { name: 'thermometer' },
  '🌡': { name: 'thermometer' },
  '👶': { name: 'baby' },
  '🤰': { name: 'heart-pulse' },
  '🤱': { name: 'baby' },
  '👨‍⚕️': { name: 'stethoscope' },
  '👩‍⚕️': { name: 'stethoscope' },
  '⚕️': { name: 'stethoscope' },
  '⚕': { name: 'stethoscope' },
  '👤': { name: 'user' },
  '👥': { name: 'users' },
  '👨‍👩‍👧‍👦': { name: 'users' },
  '👨‍👩‍👧': { name: 'users' },
  '🧑': { name: 'user' },
  '👨': { name: 'user' },
  '👩': { name: 'user' },
  '🧑‍⚕️': { name: 'stethoscope' },
  '🛡️': { name: 'shield-check' },
  '🛡': { name: 'shield-check' },
  '🔒': { name: 'lock' },
  '🔐': { name: 'lock' },
  '🔓': { name: 'unlock' },
  '🔑': { name: 'key' },
  '🚨': { name: 'siren', color: '#dc2626' },
  '🗑️': { name: 'trash' },
  '🗑': { name: 'trash' },
  '📊': { name: 'bar-chart' },
  '📈': { name: 'trending-up' },
  '📉': { name: 'trending-up' },
  '🔍': { name: 'search' },
  '🔎': { name: 'search' },
  '📋': { name: 'clipboard-list' },
  '💳': { name: 'credit-card' },
  '💰': { name: 'wallet' },
  '💵': { name: 'banknote' },
  '🪙': { name: 'coins' },
  '🧾': { name: 'receipt' },
  '💡': { name: 'lightbulb' },
  '➕': { name: 'plus' },
  '🤝': { name: 'handshake' },
  '📄': { name: 'file-text' },
  '📃': { name: 'file-text' },
  '📑': { name: 'file-spreadsheet' },
  '📜': { name: 'scroll-text' },
  '📝': { name: 'edit' },
  '✏️': { name: 'edit' },
  '✏': { name: 'edit' },
  '✍️': { name: 'pen-tool' },
  '✍': { name: 'pen-tool' },
  '📍': { name: 'map-pin' },
  '🗺️': { name: 'map' },
  '🗺': { name: 'map' },
  '🧭': { name: 'navigation' },
  '📥': { name: 'download' },
  '📤': { name: 'upload' },
  '💾': { name: 'save' },
  '🖨️': { name: 'printer' },
  '🖨': { name: 'printer' },
  '👁️': { name: 'eye' },
  '👁': { name: 'eye' },
  '💬': { name: 'message-square' },
  '🗣️': { name: 'message-circle' },
  '🗣': { name: 'message-circle' },
  '📅': { name: 'calendar' },
  '📆': { name: 'calendar-days' },
  '🗓️': { name: 'calendar-days' },
  '🗓': { name: 'calendar-days' },
  '⏰': { name: 'clock' },
  '🕒': { name: 'clock' },
  '⏱️': { name: 'clock' },
  '⏱': { name: 'clock' },
  '⏳': { name: 'hourglass' },
  '⌛': { name: 'hourglass' },
  '⚡': { name: 'zap' },
  '🔄': { name: 'refresh' },
  '🔁': { name: 'refresh' },
  '📲': { name: 'smartphone' },
  '📱': { name: 'smartphone' },
  '📞': { name: 'phone' },
  '☎️': { name: 'phone-call' },
  '☎': { name: 'phone-call' },
  '📧': { name: 'mail' },
  '✉️': { name: 'mail' },
  '✉': { name: 'mail' },
  '📭': { name: 'inbox' },
  '📬': { name: 'inbox' },
  '📢': { name: 'megaphone' },
  '📡': { name: 'radio' },
  '🏛️': { name: 'landmark' },
  '🏛': { name: 'landmark' },
  '🏢': { name: 'building2' },
  '🏠': { name: 'home' },
  '🏡': { name: 'home' },
  '👑': { name: 'crown' },
  '🔔': { name: 'bell' },
  '❤️': { name: 'heart', color: '#dc2626' },
  '❤': { name: 'heart', color: '#dc2626' },
  '💚': { name: 'heart', color: '#059669' },
  '💖': { name: 'heart-handshake', color: '#e11d48' },
  '📁': { name: 'folder' },
  '📂': { name: 'folder-open' },
  '🗂️': { name: 'archive' },
  '🗂': { name: 'archive' },
  '🪪': { name: 'id-card' },
  '🔊': { name: 'volume' },
  '🎙️': { name: 'mic' },
  '🎙': { name: 'mic' },
  '📷': { name: 'camera' },
  '📸': { name: 'camera' },
  '🎥': { name: 'video' },
  '📹': { name: 'video' },
  '🖼️': { name: 'image' },
  '🖼': { name: 'image' },
  '🌐': { name: 'globe' },
  '🎓': { name: 'graduation-cap' },
  '💼': { name: 'briefcase' },
  '📦': { name: 'package' },
  '🎁': { name: 'gift' },
  '★': { name: 'star' },
  '⭐': { name: 'star', color: '#f59e0b' },
  '🌟': { name: 'sparkles', color: '#f59e0b' },
  '✨': { name: 'sparkles' },
  '🥇': { name: 'medal', color: '#eab308' },
  '🥈': { name: 'medal', color: '#94a3b8' },
  '🥉': { name: 'medal', color: '#d97706' },
  '🏆': { name: 'trophy', color: '#eab308' },
  '🏅': { name: 'award', color: '#eab308' },
  '➡️': { name: 'arrow-right' },
  '➡': { name: 'arrow-right' },
  '➔': { name: 'arrow-right' },
  '⬅️': { name: 'arrow-left' },
  '🚀': { name: 'rocket' },
  '💻': { name: 'laptop' },
  '🎯': { name: 'target' },
  '☀️': { name: 'sun' },
  '☀': { name: 'sun' },
  '🌙': { name: 'moon' },
  '🌱': { name: 'sprout', color: '#059669' },
  '🎨': { name: 'palette' },
  '🔗': { name: 'link' },
  '🎉': { name: 'sparkles', color: '#059669' },
  '⚙️': { name: 'settings' },
  '⚙': { name: 'settings' },
  '🛠️': { name: 'wrench' },
  '🛠': { name: 'wrench' },
  '📖': { name: 'book-open' },
  '📚': { name: 'book-open' },
  '📎': { name: 'paperclip' },
  '🔢': { name: 'list-checks' },
  '🧹': { name: 'trash' },
  '▶️': { name: 'play' },
  '▶': { name: 'play' },
  '🔥': { name: 'flame', color: '#ea580c' },
  'ℹ️': { name: 'info', color: '#0284c7' },
  'ℹ': { name: 'info', color: '#0284c7' },
  '❓': { name: 'help' },
  '👆': { name: 'scan' },
  '👉': { name: 'arrow-right' }
};

/**
 * Composant d'icône professionnelle unifiée (Lucide SVG).
 * Usage :
 *   <ProIcon name="shield-check" size={18} />
 *   <ProIcon emoji="🔐" />
 */
export default function ProIcon({
  name,
  emoji,
  size = '1.05em',
  strokeWidth = 1.9,
  color,
  fill = 'none',
  className = '',
  style = {}
}) {
  let resolvedName = name;
  let resolvedColor = color;
  let resolvedFill = fill;
  let sizeScale = 1;

  if (!resolvedName && emoji) {
    const clean = String(emoji).trim();
    const mapped = EMOJI_TO_ICON[clean] || EMOJI_TO_ICON[clean.replace(/\uFE0F/g, '')];
    if (mapped) {
      if (mapped.flag) {
        return <SenegalFlag size={typeof size === 'number' ? size : 16} className={className} style={style} />;
      }
      resolvedName = mapped.name;
      if (!resolvedColor && mapped.color) resolvedColor = mapped.color;
      if (mapped.fill) resolvedFill = mapped.fill;
      if (mapped.sizeScale) sizeScale = mapped.sizeScale;
    }
  }

  if (resolvedName === 'senegal-flag') {
    return <SenegalFlag size={typeof size === 'number' ? size : 16} className={className} style={style} />;
  }

  const IconComp = ICON_MAP[resolvedName] || Info;
  const computedSize = typeof size === 'number'
    ? Math.max(10, Math.round(size * sizeScale))
    : sizeScale !== 1
      ? `calc(${size} * ${sizeScale})`
      : size;

  return (
    <IconComp
      size={computedSize}
      strokeWidth={strokeWidth}
      color={resolvedColor || 'currentColor'}
      fill={resolvedFill}
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: '-0.16em',
        flexShrink: 0,
        ...style
      }}
    />
  );
}

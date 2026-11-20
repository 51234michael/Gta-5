import React, { useState } from 'react';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Disc3,
  Landmark,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Radio,
  Send,
  Settings,
  Shield,
  Sliders,
  Star,
  Sun,
  Sunset,
  Sunrise,
  Users,
  Wifi,
  Wrench,
  X,
} from 'lucide-react';
import {
  HudSnapshot,
  MISSIONS,
  OnlineChatMessage,
  RADIO_STATIONS,
  RadioStationId,
  TimeOfDay,
  VEHICLE_SPECS,
  WEAPONS,
  WeaponId,
} from '../game/types';
import { WORLD_PROPERTIES } from '../game/properties';
import { ROAD_COORDS } from '../game/world';

interface SolisPhoneProps {
  hud: HudSnapshot;
  onlineMessages?: OnlineChatMessage[];
  onClose: () => void;
  onStartMission: (id: string) => void;
  onSetWaypoint: (x: number | null, z: number | null) => void;
  onCallMechanic: (specId: string) => void;
  onBuyAmmo: (weaponId: WeaponId) => void;
  onBuyArmor: () => void;
  onSetTimeOfDay: (tod: TimeOfDay) => void;
  onSetRadio: (station: RadioStationId) => void;
  onQuickRepairClear: () => void;
  onSendOnlineChat?: (text: string) => void;
  onOpenFullSettings?: () => void;
  onFastTravel?: (x: number, z: number, label?: string) => void;
}

type PhoneApp =
  | 'home'
  | 'missions'
  | 'messages'
  | 'map'
  | 'bank'
  | 'mechanic'
  | 'ammu'
  | 'music'
  | 'settings';

interface QuickLandmark {
  label: string;
  x: number;
  z: number;
}

const LANDMARKS: QuickLandmark[] = [
  { label: 'Centro', x: 0, z: 0 },
  { label: 'Parco', x: 240, z: -120 },
  { label: 'Aeroporto', x: -420, z: 320 },
  { label: 'Stadio', x: -240, z: 360 },
  { label: 'Spiaggia', x: 120, z: 590 },
];

const STATIC_SMS_THREADS = [
  {
    id: 'lester',
    sender: 'Lester V.',
    role: 'Organizzatore',
    avatarBg: 'from-amber-500 to-orange-600',
    initials: 'LV',
    time: '17:12',
    preview: 'La Adder Oro è davanti al Solis Tower. Muoviti.',
    messages: [
      { from: 'them', text: 'Ehi, ho trovato un bersaglio facile al Solis Tower.' },
      { from: 'them', text: 'Ruba la Adder Oro e portala al garage del Porto. $3.500 puliti.' },
    ],
    missionId: 'm1_supercar',
  },
  {
    id: 'hao',
    sender: 'Hao Motorsport',
    role: 'Corse Clandestine',
    avatarBg: 'from-sky-500 to-indigo-600',
    initials: 'HM',
    time: '16:40',
    preview: 'Stanotte si corre sul lungomare di Vespucci!',
    messages: [
      { from: 'them', text: 'Le strade di Vespucci sono libere. Prepara la tua auto migliore!' },
      { from: 'them', text: '5 checkpoint, $3.800 al primo che taglia il traguardo.' },
    ],
    missionId: 'm2_race',
  },
  {
    id: 'tiziano',
    sender: 'Tiziano R.',
    role: 'Porto Sud',
    avatarBg: 'from-rose-500 to-red-700',
    initials: 'TR',
    time: '15:18',
    preview: 'Servono rinforzi al molo industriale.',
    messages: [
      { from: 'them', text: 'Una banda sta scaricando casse vicino all’Aeroporto.' },
      { from: 'them', text: 'Passa da Ammu-Nation per fare scorta di colpi e vieni subito.' },
    ],
    missionId: 'm3_docks',
  },
  {
    id: 'los_customs',
    sender: 'Los Solis Customs',
    role: 'Officina 24/7',
    avatarBg: 'from-emerald-500 to-teal-700',
    initials: 'LC',
    time: '14:05',
    preview: 'Riverniciatura Express attiva. Zero stelle in 10 secondi.',
    messages: [
      { from: 'them', text: 'Hai la LSPD alle calcagna? Passa in officina o usa Maze Bank Express.' },
    ],
    missionId: null,
  },
];

function getTimeMeta(tod: TimeOfDay) {
  switch (tod) {
    case 'morning':
      return { label: 'Mattina', temp: '22°', icon: Sunrise, skyClass: 'from-sky-500 to-amber-300' };
    case 'day':
      return { label: 'Soleggiato', temp: '29°', icon: Sun, skyClass: 'from-sky-400 to-blue-600' };
    case 'sunset':
      return { label: 'Tramonto', temp: '26°', icon: Sunset, skyClass: 'from-orange-500 to-purple-700' };
    case 'night':
      return { label: 'Notte Serena', temp: '19°', icon: Moon, skyClass: 'from-indigo-900 to-slate-950' };
  }
}

function getVehicleBadgeLabel(type: string) {
  switch (type) {
    case 'supercar':
      return 'SUPERCAR';
    case 'muscle':
      return 'MUSCLE';
    case 'suv':
      return '4X4';
    case 'police':
      return 'LSPD';
    case 'moto':
      return 'MOTO';
    default:
      return 'AUTO';
  }
}

export const SolisPhone: React.FC<SolisPhoneProps> = ({
  hud,
  onlineMessages = [],
  onClose,
  onStartMission,
  onSetWaypoint,
  onCallMechanic,
  onBuyAmmo,
  onBuyArmor,
  onSetTimeOfDay,
  onSetRadio,
  onQuickRepairClear,
  onSendOnlineChat,
  onOpenFullSettings,
  onFastTravel,
}) => {
  const [app, setApp] = useState<PhoneApp>('home');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [smsDraft, setSmsDraft] = useState('');
  const [phoneMapTab, setPhoneMapTab] = useState<'radar' | 'online' | 'story'>('radar');

  const timeMeta = getTimeMeta(hud.timeOfDay);
  const TimeWeatherIcon = timeMeta.icon;
  const availableMissionsCount = Math.max(0, MISSIONS.length - hud.completedMissions.length);
  const currentStation = RADIO_STATIONS.find((r) => r.id === hud.radioStation) || RADIO_STATIONS[0];

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(-630 + nx * 1260);
    const wz = Math.round(-630 + ny * 1490);
    onSetWaypoint(wx, wz);
  };

  const toPctX = (wx: number) => `${((wx + 630) / 1260) * 100}%`;
  const toPctY = (wz: number) => `${((wz + 630) / 1490) * 100}%`;

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = smsDraft.trim();
    if (!clean) return;
    if (selectedThreadId === 'online_room' && onSendOnlineChat) {
      onSendOnlineChat(clean);
    }
    setSmsDraft('');
  };

  const renderAppHeader = (title: string, rightAction?: React.ReactNode) => (
    <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#0c111c] border-b border-white/10">
      <button
        onClick={() => {
          if (app === 'messages' && selectedThreadId) {
            setSelectedThreadId(null);
          } else {
            setApp('home');
          }
        }}
        className="flex items-center gap-0.5 min-h-[38px] pr-2 text-sky-400 text-xs font-semibold active:opacity-70"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>{app === 'messages' && selectedThreadId ? 'Chat' : 'Home'}</span>
      </button>
      <span className="text-[13px] font-bold tracking-tight text-white truncate max-w-[155px]">
        {title}
      </span>
      <div className="min-w-[44px] flex justify-end">{rightAction}</div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 p-2 sm:p-6"
    >
      {/* OUTER REALISTIC TITANIUM SMARTPHONE CHASSIS */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[356px] h-[615px] max-h-[89vh] select-none"
      >
        {/* Side Hardware Buttons (Left: Mute & Volume) */}
        <div className="hidden sm:block absolute -left-[4px] top-[94px] w-[4px] h-6 rounded-l bg-slate-400/75" />
        <div className="hidden sm:block absolute -left-[4px] top-[134px] w-[4px] h-11 rounded-l bg-slate-400/75" />
        <div className="hidden sm:block absolute -left-[4px] top-[188px] w-[4px] h-11 rounded-l bg-slate-400/75" />

        {/* Side Hardware Button (Right: Power Button - closes phone) */}
        <button
          onClick={onClose}
          title="Blocca / Chiudi Telefono"
          aria-label="Pulsante accensione chiudi telefono"
          className="hidden sm:block absolute -right-[5px] top-[146px] w-[5px] h-16 rounded-r bg-slate-400/80 hover:bg-amber-300 transition-colors"
        />

        {/* Metallic Titanium Rim */}
        <div className="w-full h-full rounded-[46px] bg-gradient-to-b from-[#495366] via-[#202634] to-[#3c4557] p-[4px] shadow-[0_30px_80px_rgba(0,0,0,0.9)]">
          {/* Inner Black Bezel */}
          <div className="w-full h-full rounded-[42px] bg-[#04060a] p-[7px] border border-white/10">
            {/* ACTUAL OLED PHONE DISPLAY */}
            <div className="relative w-full h-full rounded-[35px] overflow-hidden bg-[#080c15] flex flex-col">
              {/* REALISTIC STATUS BAR + DYNAMIC ISLAND */}
              <div className="relative z-20 shrink-0 flex items-center justify-between px-5 pt-2.5 pb-2 bg-[#070a11]/95">
                <span className="font-mono-hud text-[12px] font-bold text-white tabular-nums">
                  {hud.gameTimeStr}
                </span>

                {/* Dynamic Island */}
                <div className="flex items-center justify-between px-2.5 w-[104px] h-[24px] rounded-full bg-black border border-white/10 shadow-inner">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0f172a] border border-sky-400/30 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-sky-400/60" />
                    </div>
                  </div>
                  {hud.wantedLevel > 0 ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      <span className="text-[9px] font-extrabold text-rose-400 tabular-nums">
                        {hud.wantedLevel}
                      </span>
                    </div>
                  ) : hud.radioStation !== 'off' ? (
                    <div className="flex items-end gap-[2px] h-2.5">
                      <span className="w-[2px] h-1.5 bg-emerald-400 rounded-full" />
                      <span className="w-[2px] h-2.5 bg-emerald-400 rounded-full" />
                      <span className="w-[2px] h-1 bg-emerald-400 rounded-full" />
                    </div>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  )}
                </div>

                {/* Right Status Icons: Signal + 5G + Battery + Close */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-[1.5px] h-2.5">
                    <span className="w-[2px] h-1 bg-white rounded-xs" />
                    <span className="w-[2px] h-1.5 bg-white rounded-xs" />
                    <span className="w-[2px] h-2 bg-white rounded-xs" />
                    <span className="w-[2px] h-2.5 bg-white/90 rounded-xs" />
                  </div>
                  <Wifi className="w-3 h-3 text-white" />
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-2.5 rounded-[3px] border border-white/70 p-[1px] flex items-center">
                      <div className="h-full w-[82%] bg-emerald-400 rounded-[1px]" />
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Chiudi telefono"
                    className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-slate-200 hover:bg-white/20 active:scale-90"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* MAIN DISPLAY CONTENT AREA */}
              <div className="relative flex-1 overflow-hidden flex flex-col">
                {/* HOME SCREEN */}
                {app === 'home' && (
                  <div className="relative flex-1 flex flex-col justify-between p-3.5 overflow-y-auto">
                    {/* Scenic Los Solis Phone Wallpaper */}
                    <div className="absolute inset-0 pointer-events-none">
                      <img
                        src="/src/assets/images/gtav_los_solis_hero_1795203309306.jpg"
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-50 scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1020]/70 via-[#0d1222]/55 to-[#060911]/90" />
                    </div>

                    <div className="relative z-10 space-y-3.5">
                      {/* 2-Column Native iOS Widgets Row */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Weather & Location Widget */}
                        <button
                          onClick={() => setApp('settings')}
                          className={`text-left rounded-[20px] bg-gradient-to-br ${timeMeta.skyClass} p-3 border border-white/20 shadow-lg active:scale-[0.97] transition-transform min-h-[104px] flex flex-col justify-between`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-white/85 truncate max-w-[92px]">
                                {hud.district}
                              </div>
                              <div className="font-display text-2xl font-extrabold text-white leading-none mt-1 tabular-nums">
                                {timeMeta.temp}
                              </div>
                            </div>
                            <TimeWeatherIcon className="w-5 h-5 text-amber-200 shrink-0" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-white">{timeMeta.label}</div>
                            <div className="text-[9px] text-white/75 truncate">
                              {hud.onlineMode ? `Online · ${hud.onlinePlayersCount} in stanza` : 'Storia Los Solis'}
                            </div>
                          </div>
                        </button>

                        {/* Maze Bank Account Widget */}
                        <button
                          onClick={() => setApp('bank')}
                          className="text-left rounded-[20px] bg-[#111726]/92 p-3 border border-white/15 shadow-lg active:scale-[0.97] transition-transform min-h-[104px] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-md bg-rose-600 flex items-center justify-center">
                                <Landmark className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-rose-300">
                                Maze Bank
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-display text-xl font-extrabold text-emerald-400 tabular-nums leading-tight">
                              ${hud.cash.toLocaleString('it-IT')}
                            </div>
                            <div className="text-[10px] text-slate-300 mt-0.5 tabular-nums">
                              Colpi: {hud.completedMissions.length}/{MISSIONS.length}
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* 4-COLUMN REALISTIC APP ICON GRID */}
                      <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 pt-1">
                        {/* 1. Contatti / Missioni */}
                        <button
                          onClick={() => setApp('missions')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="relative w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-emerald-400 to-green-600 border border-white/25 shadow-lg flex items-center justify-center">
                            <Phone className="w-6 h-6 text-white fill-white/20" />
                            {availableMissionsCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-rose-500 border-2 border-[#0c1220] text-[10px] font-extrabold text-white flex items-center justify-center tabular-nums">
                                {availableMissionsCount}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Contatti</span>
                        </button>

                        {/* 2. Messaggi */}
                        <button
                          onClick={() => {
                            setSelectedThreadId(null);
                            setApp('messages');
                          }}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="relative w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-lime-400 to-emerald-600 border border-white/25 shadow-lg flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white fill-white/25" />
                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-rose-500 border-2 border-[#0c1220] text-[10px] font-extrabold text-white flex items-center justify-center tabular-nums">
                              {hud.onlineMode ? Math.max(2, onlineMessages.length) : 3}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Messaggi</span>
                        </button>

                        {/* 3. Mappe GPS */}
                        <button
                          onClick={() => setApp('map')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="relative w-[56px] h-[56px] rounded-[15px] bg-gradient-to-br from-sky-400 via-emerald-400 to-amber-300 border border-white/30 shadow-lg flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-x-0 top-1/2 h-2 bg-white/35 -rotate-12" />
                            <div className="absolute inset-y-0 left-1/3 w-2 bg-amber-300/60 rotate-12" />
                            <Compass className="relative w-7 h-7 text-slate-950" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Mappe</span>
                        </button>

                        {/* 4. Maze Bank */}
                        <button
                          onClick={() => setApp('bank')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-rose-500 to-red-700 border border-white/25 shadow-lg flex items-center justify-center">
                            <Landmark className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Maze Bank</span>
                        </button>

                        {/* 5. SolisAuto Meccanico */}
                        <button
                          onClick={() => setApp('mechanic')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-sky-400 to-blue-700 border border-white/25 shadow-lg flex items-center justify-center">
                            <Car className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">SolisAuto</span>
                        </button>

                        {/* 6. Ammu-Nation */}
                        <button
                          onClick={() => setApp('ammu')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-zinc-700 to-zinc-950 border border-rose-400/50 shadow-lg flex items-center justify-center">
                            <Crosshair className="w-6 h-6 text-rose-400" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">AmmuNation</span>
                        </button>

                        {/* 7. Musica & Radio */}
                        <button
                          onClick={() => setApp('music')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-pink-500 via-rose-500 to-purple-700 border border-white/25 shadow-lg flex items-center justify-center">
                            <Disc3 className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Musica</span>
                        </button>

                        {/* 8. Impostazioni */}
                        <button
                          onClick={() => setApp('settings')}
                          className="group flex flex-col items-center gap-1 min-h-[44px] active:scale-90 transition-transform"
                        >
                          <div className="w-[56px] h-[56px] rounded-[15px] bg-gradient-to-b from-slate-400 to-slate-700 border border-white/25 shadow-lg flex items-center justify-center">
                            <Settings className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-[10px] font-semibold text-white drop-shadow">Opzioni</span>
                        </button>
                      </div>
                    </div>

                    {/* PERSISTENT SMARTPHONE DOCK */}
                    <div className="relative z-10 mt-3">
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/35" />
                      </div>
                      <div className="rounded-[24px] bg-[#141a29]/88 border border-white/15 px-3 py-2 grid grid-cols-4 gap-2 shadow-xl">
                        <button
                          onClick={() => setApp('missions')}
                          aria-label="Contatti"
                          className="flex items-center justify-center min-h-[48px] active:scale-90 transition-transform"
                        >
                          <div className="w-12 h-12 rounded-[13px] bg-gradient-to-b from-emerald-400 to-green-600 border border-white/20 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-white" />
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedThreadId(null);
                            setApp('messages');
                          }}
                          aria-label="Messaggi"
                          className="flex items-center justify-center min-h-[48px] active:scale-90 transition-transform"
                        >
                          <div className="w-12 h-12 rounded-[13px] bg-gradient-to-b from-lime-400 to-emerald-600 border border-white/20 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                          </div>
                        </button>
                        <button
                          onClick={() => setApp('map')}
                          aria-label="Mappe"
                          className="flex items-center justify-center min-h-[48px] active:scale-90 transition-transform"
                        >
                          <div className="w-12 h-12 rounded-[13px] bg-gradient-to-br from-sky-400 via-emerald-400 to-amber-300 border border-white/25 flex items-center justify-center">
                            <Compass className="w-5 h-5 text-slate-950" />
                          </div>
                        </button>
                        <button
                          onClick={() => setApp('music')}
                          aria-label="Musica"
                          className="flex items-center justify-center min-h-[48px] active:scale-90 transition-transform"
                        >
                          <div className="w-12 h-12 rounded-[13px] bg-gradient-to-b from-pink-500 to-purple-700 border border-white/20 flex items-center justify-center">
                            <Disc3 className="w-5 h-5 text-white" />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* APP: CONTATTI & MISSIONI */}
                {app === 'missions' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader('Contatti · Colpi')}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                      {MISSIONS.map((m) => {
                        const done = hud.completedMissions.includes(m.id);
                        const active = hud.activeMission?.def.id === m.id;
                        return (
                          <div
                            key={m.id}
                            className={`rounded-2xl p-3 border ${
                              active
                                ? 'bg-amber-500/15 border-amber-400/50'
                                : 'bg-[#121826] border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-slate-950 font-extrabold text-xs flex items-center justify-center shrink-0">
                                  {m.giver.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] font-bold text-white truncate">
                                      {m.title}
                                    </span>
                                    {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  </div>
                                  <div className="text-[11px] text-amber-300 font-medium tabular-nums">
                                    {m.giver} · ${m.reward.toLocaleString('it-IT')}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{m.description}</p>
                            <button
                              onClick={() => {
                                onStartMission(m.id);
                                onClose();
                              }}
                              className="mt-2.5 w-full min-h-[40px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{active ? 'Richiama & Riavvia' : 'Chiama per Avviare'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* APP: MESSAGGI (SMS + CHAT STANZA ONLINE) */}
                {app === 'messages' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader(
                      selectedThreadId === 'online_room'
                        ? `Stanza ${hud.onlineRoom}`
                        : selectedThreadId
                        ? STATIC_SMS_THREADS.find((t) => t.id === selectedThreadId)?.sender || 'Messaggio'
                        : 'Messaggi'
                    )}

                    {!selectedThreadId ? (
                      <div className="flex-1 overflow-y-auto divide-y divide-white/10">
                        {hud.onlineMode && (
                          <button
                            onClick={() => setSelectedThreadId('online_room')}
                            className="w-full flex items-center gap-3 px-3.5 py-3 text-left bg-sky-500/10 hover:bg-sky-500/15 active:bg-sky-500/20"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-bold text-white truncate">
                                  Stanza Online · {hud.onlineRoom}
                                </span>
                                <span className="text-[10px] text-sky-400 font-semibold">Live</span>
                              </div>
                              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                                {onlineMessages.length > 0
                                  ? `${onlineMessages[onlineMessages.length - 1].senderName}: ${
                                      onlineMessages[onlineMessages.length - 1].text
                                    }`
                                  : `${hud.onlinePlayersCount} giocatori connessi. Tocca per scrivere.`}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          </button>
                        )}

                        {STATIC_SMS_THREADS.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedThreadId(t.id)}
                            className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-white/5 active:bg-white/10"
                          >
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.avatarBg} text-white font-extrabold text-xs flex items-center justify-center shrink-0`}
                            >
                              {t.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-bold text-white truncate">{t.sender}</span>
                                <span className="text-[10px] text-slate-400 tabular-nums">{t.time}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.preview}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : selectedThreadId === 'online_room' ? (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
                          {onlineMessages.length === 0 ? (
                            <div className="text-center text-xs text-slate-400 mt-8">
                              Nessun messaggio nella stanza {hud.onlineRoom}. Invia un SMS ai giocatori!
                            </div>
                          ) : (
                            onlineMessages.map((msg) => (
                              <div key={msg.id} className="rounded-2xl bg-[#151d2e] border border-white/10 px-3 py-2">
                                <div className="text-[10px] font-bold text-sky-400">{msg.senderName}</div>
                                <div className="text-xs text-white mt-0.5">{msg.text}</div>
                              </div>
                            ))
                          )}
                        </div>
                        <form
                          onSubmit={handleSendSms}
                          className="shrink-0 flex items-center gap-2 p-2.5 bg-[#0d121e] border-t border-white/10"
                        >
                          <input
                            type="text"
                            value={smsDraft}
                            maxLength={100}
                            onChange={(e) => setSmsDraft(e.target.value)}
                            placeholder="iMessage Stanza..."
                            className="flex-1 rounded-full bg-[#161f30] border border-white/15 px-3.5 py-2 text-xs text-white outline-none focus:border-sky-400"
                          />
                          <button
                            type="submit"
                            aria-label="Invia"
                            className="w-9 h-9 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center shrink-0 active:scale-90"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    ) : (
                      (() => {
                        const thread = STATIC_SMS_THREADS.find((t) => t.id === selectedThreadId);
                        if (!thread) return null;
                        return (
                          <div className="flex-1 flex flex-col justify-between p-3.5 overflow-y-auto">
                            <div className="space-y-2.5">
                              <div className="text-center text-[10px] text-slate-500 uppercase tracking-wider">
                                {thread.role} · Oggi {thread.time}
                              </div>
                              {thread.messages.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#1c2436] border border-white/10 px-3.5 py-2 text-xs text-slate-100 leading-relaxed"
                                >
                                  {m.text}
                                </div>
                              ))}
                            </div>

                            {thread.missionId && (
                              <button
                                onClick={() => {
                                  onStartMission(thread.missionId!);
                                  onClose();
                                }}
                                className="mt-4 w-full min-h-[44px] rounded-2xl bg-emerald-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                              >
                                <Phone className="w-4 h-4" />
                                <span>Accetta & Avvia Missione</span>
                              </button>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* APP: MAPPE GPS & LUOGHI */}
                {app === 'map' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader(
                      'Mappe & Luoghi',
                      hud.waypoint ? (
                        <button
                          onClick={() => onSetWaypoint(null, null)}
                          className="rounded-lg bg-rose-500/20 border border-rose-400/40 px-2 py-1 text-[10px] font-bold text-rose-300"
                        >
                          Pulisci
                        </button>
                      ) : null
                    )}

                    <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
                      {/* Phone Map Mode Switcher */}
                      <div className="grid grid-cols-3 gap-1 shrink-0">
                        {(
                          [
                            ['radar', 'Mappa GPS'],
                            ['online', 'GTA Online'],
                            ['story', 'Storia'],
                          ] as const
                        ).map(([tab, label]) => (
                          <button
                            key={tab}
                            onClick={() => setPhoneMapTab(tab)}
                            className={`rounded-lg py-1.5 text-[10px] font-bold border ${
                              phoneMapTab === tab
                                ? 'bg-sky-400 text-slate-950 border-sky-300'
                                : 'bg-[#121826] text-slate-300 border-white/10'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {phoneMapTab === 'radar' ? (
                        <>
                          {/* Quick Destination Pills */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
                            {LANDMARKS.map((lm) => (
                              <button
                                key={lm.label}
                                onClick={() => onSetWaypoint(lm.x, lm.z)}
                                className="shrink-0 rounded-xl bg-[#161e2e] border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-sky-400 active:scale-95"
                              >
                                {lm.label}
                              </button>
                            ))}
                          </div>

                          <div
                            onClick={handleMapClick}
                            className="relative flex-1 rounded-2xl overflow-hidden bg-[#1a2230] border border-white/15 cursor-crosshair min-h-[240px]"
                          >
                            <div className="absolute inset-x-0 top-0 bg-[#273c24]" style={{ height: toPctY(-570) }} />
                            <div
                              className="absolute inset-x-0 bg-[#a89367]"
                              style={{ top: toPctY(568), height: `${((656 - 568) / 1490) * 100}%` }}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-[#0c4a6e]" style={{ top: toPctY(656) }} />

                            <div
                              className="absolute bg-[#2e6f35]"
                              style={{
                                left: toPctX(189),
                                top: toPctY(-171),
                                width: `${(102 / 1260) * 100}%`,
                                height: `${(102 / 1490) * 100}%`,
                              }}
                            />
                            <div
                              className="absolute bg-[#1f2937]"
                              style={{
                                left: toPctX(-435),
                                top: toPctY(180),
                                width: `${(30 / 1260) * 100}%`,
                                height: `${(280 / 1490) * 100}%`,
                              }}
                            />

                            {[...ROAD_COORDS, -560, 560].map((r) => (
                              <React.Fragment key={r}>
                                <div
                                  className="absolute w-1 bg-slate-600/80 -translate-x-1/2"
                                  style={{
                                    left: toPctX(r),
                                    top: toPctY(-570),
                                    height: `${(1140 / 1490) * 100}%`,
                                  }}
                                />
                                <div
                                  className="absolute h-1 bg-slate-600/80 -translate-y-1/2"
                                  style={{
                                    left: toPctX(-570),
                                    top: toPctY(r),
                                    width: `${(1140 / 1260) * 100}%`,
                                  }}
                                />
                              </React.Fragment>
                            ))}

                            {hud.blips
                              .filter((b) => b.kind === 'property')
                              .map((b, i) => (
                                <div
                                  key={`pp_${i}`}
                                  style={{ left: toPctX(b.x), top: toPctY(b.z), backgroundColor: b.color }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-xs border border-slate-950"
                                />
                              ))}

                            {hud.blips
                              .filter((b) => b.kind === 'shop' || b.kind === 'mission' || b.kind === 'online_player')
                              .map((b, i) => (
                                <div
                                  key={i}
                                  style={{ left: toPctX(b.x), top: toPctY(b.z), backgroundColor: b.color }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-slate-950 shadow"
                                >
                                  {b.kind === 'online_player' ? '•' : b.label}
                                </div>
                              ))}

                            {hud.waypoint && (
                              <div
                                style={{ left: toPctX(hud.waypoint.x), top: toPctY(hud.waypoint.z) }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 text-purple-400"
                              >
                                <MapPin className="w-5 h-5 fill-purple-500 text-white" />
                              </div>
                            )}

                            <div
                              style={{
                                left: toPctX(hud.playerX),
                                top: toPctY(hud.playerZ),
                                transform: `translate(-50%, -50%) rotate(${Math.PI - hud.playerHeading}rad)`,
                              }}
                              className="absolute pointer-events-none"
                            >
                              <svg width="16" height="16" viewBox="0 0 20 20">
                                <polygon
                                  points="10,1 18,18 10,13.5 2,18"
                                  fill="#38bdf8"
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                          {WORLD_PROPERTIES.filter((p) => p.mode === phoneMapTab).map((p) => (
                            <div
                              key={p.id}
                              className="rounded-xl bg-[#121826] border border-white/10 p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[8px] font-extrabold text-slate-950 shrink-0"
                                    style={{ backgroundColor: p.color }}
                                  >
                                    {p.shortCode}
                                  </span>
                                  <span className="text-[11px] font-bold text-white truncate">{p.name}</span>
                                </div>
                                <span className="text-[9px] text-slate-400 shrink-0">{p.district}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    onSetWaypoint(p.x, p.z);
                                    setPhoneMapTab('radar');
                                  }}
                                  className="flex-1 rounded-lg bg-purple-500/20 border border-purple-400/35 py-1 text-[10px] font-bold text-purple-200"
                                >
                                  GPS
                                </button>
                                {onFastTravel && (
                                  <button
                                    onClick={() => {
                                      onFastTravel(p.x, p.z, p.name);
                                      onClose();
                                    }}
                                    className="flex-1 rounded-lg bg-amber-400 py-1 text-[10px] font-extrabold text-slate-950"
                                  >
                                    Vai Ora
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* APP: MAZE BANK & SERVIZI EXPRESS */}
                {app === 'bank' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader('Maze Bank')}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                      {/* Maze Bank Virtual Debit Card */}
                      <div className="rounded-2xl bg-gradient-to-br from-rose-600 via-red-700 to-slate-950 p-4 border border-white/20 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-100">
                            Maze Bank Solis
                          </span>
                          <Landmark className="w-5 h-5 text-white/90" />
                        </div>
                        <div className="mt-4">
                          <div className="text-[10px] text-rose-100/80 uppercase">Saldo Disponibile</div>
                          <div className="font-display text-3xl font-extrabold text-white tabular-nums mt-0.5">
                            ${hud.cash.toLocaleString('it-IT')}
                          </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[10px] text-rose-100/85 tabular-nums">
                          <span>•••• 4920 · LOS SOLIS</span>
                          <span>{hud.completedMissions.length}/{MISSIONS.length} COLPI</span>
                        </div>
                      </div>

                      {/* Quick Express Services */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          Servizi Rapidi Città
                        </div>
                        <button
                          onClick={() => {
                            onQuickRepairClear();
                            onClose();
                          }}
                          className="w-full flex items-center justify-between rounded-2xl bg-[#121826] border border-emerald-400/35 p-3 text-left min-h-[56px] active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                              <Wrench className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Officina Express</div>
                              <div className="text-[10px] text-slate-400">Ripara auto e azzera ricercato</div>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-400">GRATIS</span>
                        </button>

                        <button
                          onClick={onBuyArmor}
                          className="w-full flex items-center justify-between rounded-2xl bg-[#121826] border border-sky-400/35 p-3 text-left min-h-[56px] active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                              <Shield className="w-4 h-4 text-sky-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Assicurazione Medica</div>
                              <div className="text-[10px] text-slate-400">Salute & Giubbotto al 100%</div>
                            </div>
                          </div>
                          <span className="font-mono-hud text-xs font-extrabold text-emerald-400">$400</span>
                        </button>
                      </div>

                      {/* Completed Missions Ledger */}
                      <div className="rounded-2xl bg-[#121826] border border-white/10 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Storico Entrate Colpi
                        </div>
                        {hud.completedMissions.length === 0 ? (
                          <div className="text-[11px] text-slate-500">
                            Nessun colpo completato ancora. Apri Contatti per iniziare.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {MISSIONS.filter((m) => hud.completedMissions.includes(m.id)).map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                              >
                                <span className="text-slate-200 font-medium truncate pr-2">{m.title}</span>
                                <span className="font-mono-hud text-emerald-400 font-bold tabular-nums">
                                  +${m.reward.toLocaleString('it-IT')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* APP: SOLISAUTO MECCANICO */}
                {app === 'mechanic' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader('SolisAuto Express')}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                      <p className="text-[11px] text-slate-400 px-1">
                        Consegna immediata vicino alla tua posizione GPS
                      </p>
                      {Object.values(VEHICLE_SPECS).map((spec) => (
                        <button
                          key={spec.id}
                          onClick={() => {
                            onCallMechanic(spec.id);
                            onClose();
                          }}
                          className="w-full flex items-center justify-between rounded-2xl bg-[#121826] border border-white/10 p-3 text-left hover:border-sky-400/50 active:scale-[0.98]"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-white truncate">{spec.name}</span>
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                                {getVehicleBadgeLabel(spec.type)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                              Top speed {Math.round(spec.maxSpeed * 3.6)} km/h
                            </div>
                          </div>
                          <span className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-[11px] font-extrabold text-slate-950">
                            Chiama
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* APP: AMMU-NATION */}
                {app === 'ammu' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader(
                      'Ammu-Nation',
                      <span className="font-mono-hud text-[11px] font-bold text-emerald-400 tabular-nums">
                        ${hud.cash.toLocaleString('it-IT')}
                      </span>
                    )}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                      <button
                        onClick={onBuyArmor}
                        className="w-full flex items-center justify-between rounded-2xl bg-sky-500/15 border border-sky-400/40 p-3 text-left active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield className="w-5 h-5 text-sky-400 shrink-0" />
                          <div>
                            <div className="text-[13px] font-bold text-white">Salute + Giubbotto 100%</div>
                            <div className="text-[11px] text-slate-300">Rifornimento completo immediato</div>
                          </div>
                        </div>
                        <span className="font-mono-hud text-xs font-extrabold text-emerald-400 tabular-nums">
                          $400
                        </span>
                      </button>

                      {(['pistol', 'smg', 'shotgun', 'rifle', 'grenade'] as WeaponId[]).map((wid) => {
                        const w = WEAPONS[wid];
                        return (
                          <button
                            key={wid}
                            onClick={() => onBuyAmmo(wid)}
                            className="w-full flex items-center justify-between rounded-2xl bg-[#121826] border border-white/10 p-3 text-left hover:border-rose-400/40 active:scale-[0.98]"
                          >
                            <div>
                              <div className="text-[13px] font-bold text-white">{w.name}</div>
                              <div className="text-[11px] text-slate-400 tabular-nums">
                                +{w.ammoPack} colpi · In inventario: {hud.ammo[wid]}
                              </div>
                            </div>
                            <span className="font-mono-hud text-xs font-extrabold text-emerald-400 tabular-nums">
                              ${w.ammoPrice}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* APP: MUSICA & RADIO FM */}
                {app === 'music' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader('Solis Music')}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
                      {/* Now Playing Artwork Card */}
                      <div className="rounded-2xl bg-gradient-to-br from-pink-600 via-rose-600 to-indigo-900 p-4 border border-white/20 shadow-xl">
                        <div className="flex items-center gap-3.5">
                          <div className="w-16 h-16 rounded-xl bg-black/35 border border-white/20 flex items-center justify-center shrink-0">
                            <Disc3 className="w-8 h-8 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-pink-100/85">
                              In Riproduzione
                            </div>
                            <div className="text-base font-extrabold text-white truncate mt-0.5">
                              {currentStation.name}
                            </div>
                            <div className="text-xs text-pink-100/80">{currentStation.genre}</div>
                          </div>
                        </div>
                      </div>

                      {/* Station List */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          Stazioni Radio Los Solis
                        </div>
                        {RADIO_STATIONS.map((r) => {
                          const active = hud.radioStation === r.id;
                          return (
                            <button
                              key={r.id}
                              onClick={() => onSetRadio(r.id)}
                              className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-left border min-h-[50px] ${
                                active
                                  ? 'bg-pink-500/20 border-pink-400 text-white'
                                  : 'bg-[#121826] border-white/10 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Radio className={`w-4 h-4 ${active ? 'text-pink-400' : 'text-slate-500'}`} />
                                <div>
                                  <div className="text-xs font-bold">{r.name}</div>
                                  <div className="text-[10px] text-slate-400">{r.genre}</div>
                                </div>
                              </div>
                              {active && (
                                <span className="text-[10px] font-extrabold uppercase text-pink-300">Attiva</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* APP: IMPOSTAZIONI iSOLIS OS */}
                {app === 'settings' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e18]">
                    {renderAppHeader('Impostazioni')}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                      {/* Device Info Card */}
                      <div className="flex items-center gap-3 rounded-2xl bg-[#121826] border border-white/10 p-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm">
                          iS
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white">iSolis Pro · {hud.characterId.toUpperCase()}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            iSolis OS 18 · {hud.onlineMode ? `Online (${hud.onlineRoom})` : 'Modalità Storia'}
                          </div>
                        </div>
                      </div>

                      {/* Time of Day */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Ora del Giorno
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ['morning', 'Mattina'],
                              ['day', 'Giorno'],
                              ['sunset', 'Tramonto'],
                              ['night', 'Notte'],
                            ] as [TimeOfDay, string][]
                          ).map(([tod, label]) => (
                            <button
                              key={tod}
                              onClick={() => onSetTimeOfDay(tod)}
                              className={`rounded-xl py-2.5 text-xs font-bold border min-h-[42px] ${
                                hud.timeOfDay === tod
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-[#121826] text-slate-200 border-white/10'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Radio */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <Radio className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Radio Veicolo
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#121826] border border-white/10 divide-y divide-white/10 overflow-hidden">
                          {RADIO_STATIONS.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => onSetRadio(r.id)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left min-h-[42px] hover:bg-white/5"
                            >
                              <span className="text-xs font-semibold text-white">{r.name}</span>
                              {hud.radioStation === r.id ? (
                                <span className="text-[11px] font-bold text-sky-400">Selezionata</span>
                              ) : (
                                <span className="text-[11px] text-slate-500">{r.genre}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {onOpenFullSettings && (
                        <button
                          onClick={onOpenFullSettings}
                          className="w-full flex items-center justify-between rounded-2xl bg-amber-400/15 border border-amber-400/40 px-3.5 py-3 text-left min-h-[48px] active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2.5">
                            <Sliders className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-extrabold text-white">
                              Apri Opzioni Complete GTA V
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-amber-300" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM REALISTIC HOME INDICATOR BAR */}
              <div className="shrink-0 py-2 bg-[#070a11] flex items-center justify-center">
                <button
                  onClick={() => {
                    if (app === 'home') {
                      onClose();
                    } else if (app === 'messages' && selectedThreadId) {
                      setSelectedThreadId(null);
                    } else {
                      setApp('home');
                    }
                  }}
                  aria-label={app === 'home' ? 'Chiudi telefono' : 'Torna alla home'}
                  className="w-32 h-[5px] rounded-full bg-white/75 hover:bg-white transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

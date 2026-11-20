import React, { useMemo, useState } from 'react';
import { Compass, MapPin, Navigation, Search, ShoppingBag, Trash2, X, Zap } from 'lucide-react';
import { WORLD_PROPERTIES } from '../game/properties';
import { getStoreDoorPos, WALK_IN_STORES, WalkInStore } from '../game/stores';
import { HudSnapshot, PropertyMode, WorldProperty } from '../game/types';
import { ROAD_COORDS } from '../game/world';

interface FullMapModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSetWaypoint: (x: number | null, z: number | null) => void;
  onFastTravel?: (x: number, z: number, label?: string) => void;
}

export const FullMapModal: React.FC<FullMapModalProps> = ({
  hud,
  onClose,
  onSetWaypoint,
  onFastTravel,
}) => {
  const [modeFilter, setModeFilter] = useState<'all' | PropertyMode | 'stores'>('all');
  const [search, setSearch] = useState('');
  const [selectedProp, setSelectedProp] = useState<WorldProperty | null>(null);
  const [selectedStore, setSelectedStore] = useState<WalkInStore | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // Expanded World projection bounds: X -630..630 (1260m), Z -630..860 (1490m)
  const toPctX = (wx: number) => `${((wx + 630) / 1260) * 100}%`;
  const toPctY = (wz: number) => `${((wz + 630) / 1490) * 100}%`;

  const filteredProperties = useMemo(() => {
    if (modeFilter === 'stores') return [];
    const q = search.trim().toLowerCase();
    return WORLD_PROPERTIES.filter((p) => {
      if (modeFilter !== 'all' && p.mode !== modeFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.district.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [modeFilter, search]);

  const filteredStores = useMemo(() => {
    if (modeFilter !== 'all' && modeFilter !== 'stores') return [];
    const q = search.trim().toLowerCase();
    return WALK_IN_STORES.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.district.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [modeFilter, search]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const wx = Math.round(-630 + nx * 1260);
    const wz = Math.round(-630 + ny * 1490);
    setSelectedProp(null);
    setSelectedStore(null);
    onSetWaypoint(wx, wz);
  };

  const selectProperty = (prop: WorldProperty, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedStore(null);
    setSelectedProp(prop);
    onSetWaypoint(prop.x, prop.z);
  };

  const selectStore = (store: WalkInStore, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProp(null);
    setSelectedStore(store);
    const door = getStoreDoorPos(store);
    onSetWaypoint(door.x, door.z);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#06090f]/94 p-2 sm:p-5 safe-pt safe-pb"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-full max-h-[94vh] rounded-2xl bg-[#0d1118] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 bg-[#080b10] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-2xl font-extrabold uppercase tracking-wide text-white leading-none truncate">
                Mappa & Luoghi di Los Solis
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {hud.district} · {WORLD_PROPERTIES.length} luoghi GTA Online & Modalità Storia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setMobileListOpen((v) => !v)}
              className="lg:hidden rounded-lg bg-amber-500/20 border border-amber-400/45 px-2.5 min-h-[40px] text-xs font-bold text-amber-300"
            >
              {mobileListOpen ? 'Mappa' : `Luoghi (${filteredProperties.length + filteredStores.length})`}
            </button>
            {hud.waypoint && (
              <button
                onClick={() => onSetWaypoint(null, null)}
                className="flex items-center gap-1.5 rounded-lg bg-purple-500/20 border border-purple-400/50 px-2.5 min-h-[40px] text-xs font-bold text-purple-200 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Rimuovi GPS</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Chiudi mappa"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Split Layout: Map Left + Directory Right */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Interactive Map Canvas */}
          <div className={`${mobileListOpen ? 'hidden lg:flex' : 'flex'} flex-1 p-2.5 sm:p-3.5 flex-col gap-2 min-h-0`}>
            <div
              onClick={handleMapClick}
              className="relative flex-1 w-full rounded-xl overflow-hidden bg-[#18202c] border border-white/15 cursor-crosshair select-none touch-manipulation"
            >
              {/* Soliswood Hills North (z < -570) */}
              <div className="absolute inset-x-0 top-0 bg-[#273c24]" style={{ height: toPctY(-570) }} />
              <div
                style={{ left: toPctX(0), top: toPctY(-600) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-[#0a0d12]/80 border border-emerald-400/40 text-[9px] font-extrabold tracking-[0.2em] text-emerald-200 pointer-events-none"
              >
                SOLISWOOD · ROUTE 68 · SANDY SHORES
              </div>

              {/* Vespucci Beach & Pacific Ocean */}
              <div
                className="absolute inset-x-0 bg-[#a89367]"
                style={{ top: toPctY(568), height: `${((656 - 568) / 1490) * 100}%` }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-[#0c4a6e]" style={{ top: toPctY(656) }} />

              {/* Vespucci Pier & Offshore Docks (Super Yacht, Kosatka, Puerto Del Sol, Sonar) */}
              <div
                className="absolute bg-[#7c5338]"
                style={{
                  left: toPctX(113),
                  top: toPctY(615),
                  width: `${(14 / 1260) * 100}%`,
                  height: `${(120 / 1490) * 100}%`,
                }}
              />
              <div
                className="absolute bg-[#7c5338]"
                style={{
                  left: toPctX(262),
                  top: toPctY(644),
                  width: `${(7 / 1260) * 100}%`,
                  height: `${(132 / 1490) * 100}%`,
                }}
              />
              <div
                className="absolute bg-[#7c5338]"
                style={{
                  left: toPctX(-148),
                  top: toPctY(645),
                  width: `${(6 / 1260) * 100}%`,
                  height: `${(126 / 1490) * 100}%`,
                }}
              />
              <div
                className="absolute bg-[#f8fafc] border border-sky-400 -translate-x-1/2"
                style={{
                  left: toPctX(265),
                  top: toPctY(780),
                  width: `${(18 / 1260) * 100}%`,
                  height: `${(48 / 1490) * 100}%`,
                }}
              />
              <div
                className="absolute bg-[#334155] border border-rose-400/70 -translate-x-1/2"
                style={{
                  left: toPctX(-145),
                  top: toPctY(776),
                  width: `${(12 / 1260) * 100}%`,
                  height: `${(38 / 1490) * 100}%`,
                }}
              />

              {/* Los Santos Golf Club */}
              <div
                className="absolute bg-[#3f8f3d] border border-emerald-300/30"
                style={{
                  left: toPctX(-348),
                  top: toPctY(-348),
                  width: `${(96 / 1260) * 100}%`,
                  height: `${(96 / 1490) * 100}%`,
                }}
              />

              {/* Diamond Casino & Master Penthouse */}
              <div
                className="absolute bg-[#4c1d95] border border-amber-400/60"
                style={{
                  left: toPctX(396),
                  top: toPctY(-322),
                  width: `${(48 / 1260) * 100}%`,
                  height: `${(34 / 1490) * 100}%`,
                }}
              />

              {/* Parco Centrale Solis */}
              <div
                className="absolute bg-[#2e6f35] border border-emerald-400/30"
                style={{
                  left: toPctX(189),
                  top: toPctY(-171),
                  width: `${(102 / 1260) * 100}%`,
                  height: `${(102 / 1490) * 100}%`,
                }}
              />
              <div
                className="absolute rounded-full bg-[#0ea5e9] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: toPctX(240),
                  top: toPctY(-120),
                  width: `${(40 / 1260) * 100}%`,
                  height: `${(40 / 1490) * 100}%`,
                }}
              />

              {/* Stadio Solis */}
              <div
                className="absolute rounded-full bg-slate-600/80 border border-sky-400/60 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: toPctX(360),
                  top: toPctY(-240),
                  width: `${(88 / 1260) * 100}%`,
                  height: `${(88 / 1490) * 100}%`,
                }}
              />

              {/* Aeroporto di Los Solis Runway */}
              <div
                className="absolute bg-[#1f2937] border border-slate-400/40 flex flex-col items-center justify-around py-1"
                style={{
                  left: toPctX(-435),
                  top: toPctY(180),
                  width: `${(30 / 1260) * 100}%`,
                  height: `${(280 / 1490) * 100}%`,
                }}
              >
                <span className="w-0.5 h-2.5 bg-slate-200/80" />
                <span className="w-0.5 h-2.5 bg-slate-200/80" />
                <span className="w-0.5 h-2.5 bg-slate-200/80" />
              </div>

              {/* 9x9 Road Grid */}
              {[...ROAD_COORDS, -560, 560].map((r) => (
                <React.Fragment key={r}>
                  <div
                    className="absolute bg-[#374151] -translate-x-1/2"
                    style={{
                      left: toPctX(r),
                      top: toPctY(-570),
                      width: `${(18 / 1260) * 100}%`,
                      height: `${(1140 / 1490) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute bg-[#374151] -translate-y-1/2"
                    style={{
                      left: toPctX(-570),
                      top: toPctY(r),
                      width: `${(1140 / 1260) * 100}%`,
                      height: `${(18 / 1490) * 100}%`,
                    }}
                  />
                </React.Fragment>
              ))}

              {/* District Watermarks */}
              <div
                style={{ left: toPctX(-300), top: toPctY(-300) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[8px] sm:text-[9px] font-bold tracking-wider text-emerald-100/90 pointer-events-none"
              >
                GOLF CLUB
              </div>
              <div
                style={{ left: toPctX(420), top: toPctY(-305) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold tracking-wider text-amber-200 pointer-events-none"
              >
                CASINÒ
              </div>
              <div
                style={{ left: toPctX(0), top: toPctY(0) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] sm:text-[11px] font-extrabold tracking-widest text-white/60 pointer-events-none"
              >
                CENTRO FINANZIARIO
              </div>
              <div
                style={{ left: toPctX(-420), top: toPctY(320) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold tracking-wider text-sky-200/80 pointer-events-none"
              >
                AEROPORTO
              </div>
              <div
                style={{ left: toPctX(0), top: toPctY(610) }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] sm:text-[11px] font-extrabold tracking-widest text-amber-950/80 pointer-events-none"
              >
                VESPUCCI BEACH
              </div>

              {/* GPS Route Dashed Line */}
              {(hud.waypoint || hud.activeMission) && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1={toPctX(hud.playerX)}
                    y1={toPctY(hud.playerZ)}
                    x2={toPctX(hud.waypoint ? hud.waypoint.x : hud.activeMission!.targetX)}
                    y2={toPctY(hud.waypoint ? hud.waypoint.z : hud.activeMission!.targetZ)}
                    stroke={hud.waypoint ? '#c084fc' : '#facc15'}
                    strokeWidth="2.5"
                    strokeDasharray="6 5"
                  />
                </svg>
              )}

              {/* Filtered GTA Online & Story Mode Property Pins */}
              {filteredProperties.map((p) => {
                const isSelected = selectedProp?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name}
                    onClick={(e) => selectProperty(p, e)}
                    style={{
                      left: toPctX(p.x),
                      top: toPctY(p.z),
                      backgroundColor: p.color,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm flex items-center justify-center font-extrabold text-slate-950 border shadow transition-transform ${
                      isSelected
                        ? 'z-20 w-7 h-5 text-[9px] border-white scale-125 ring-2 ring-amber-300'
                        : 'z-10 px-1 h-4 text-[7px] sm:text-[8px] border-slate-950/90 hover:scale-125 hover:z-20'
                    }`}
                  >
                    {p.shortCode}
                  </button>
                );
              })}

              {/* Police, Online Players, Shop & Mission Blips */}
              {hud.blips
                .filter((b) => b.kind === 'shop' || b.kind === 'mission' || b.kind === 'police' || b.kind === 'online_player')
                .map((b, i) =>
                  b.kind === 'police' ? (
                    <div
                      key={`p_${i}`}
                      style={{ left: toPctX(b.x), top: toPctY(b.z), backgroundColor: b.color }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-white/80 pointer-events-none"
                    />
                  ) : b.kind === 'online_player' ? (
                    <div
                      key={`op_${i}`}
                      style={{ left: toPctX(b.x), top: toPctY(b.z) }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-20"
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-md" />
                      {b.label && (
                        <span className="mt-0.5 px-1 rounded bg-[#090c10]/90 text-[8px] font-bold text-cyan-200 whitespace-nowrap">
                          {b.label}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      key={`m_${i}`}
                      style={{ left: toPctX(b.x), top: toPctY(b.z), backgroundColor: b.color }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-slate-950 border border-slate-950 shadow-md pointer-events-none z-10"
                    >
                      {b.label}
                    </div>
                  )
                )}

              {/* Purple Waypoint Pin */}
              {hud.waypoint && (
                <div
                  style={{ left: toPctX(hud.waypoint.x), top: toPctY(hud.waypoint.z) }}
                  className="absolute -translate-x-1/2 -translate-y-full text-purple-400 pointer-events-none drop-shadow-lg z-20"
                >
                  <MapPin className="w-6 h-6 fill-purple-500 text-white" />
                </div>
              )}

              {/* Player Arrow */}
              <div
                style={{
                  left: toPctX(hud.playerX),
                  top: toPctY(hud.playerZ),
                  transform: `translate(-50%, -50%) rotate(${Math.PI - hud.playerHeading}rad)`,
                }}
                className="absolute pointer-events-none z-30"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-md">
                  <polygon points="10,1 18,18 10,13.5 2,18" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.8" />
                </svg>
              </div>
            </div>

            {/* Selected Location Detail Strip */}
            {(selectedProp || selectedStore) && (
              <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-[#121826] border border-amber-400/40 px-3.5 py-2.5">
                {selectedProp ? (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-slate-950"
                          style={{ backgroundColor: selectedProp.color }}
                        >
                          {selectedProp.shortCode}
                        </span>
                        <span className="text-sm font-extrabold text-white truncate">{selectedProp.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            selectedProp.mode === 'online'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {selectedProp.mode === 'online' ? 'GTA Online' : 'Modalità Storia'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 truncate">{selectedProp.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSetWaypoint(selectedProp.x, selectedProp.z)}
                        className="flex items-center gap-1.5 rounded-lg bg-purple-500/25 border border-purple-400/50 px-3 min-h-[38px] text-xs font-bold text-purple-200 active:scale-95"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>GPS</span>
                      </button>
                      {onFastTravel && (
                        <button
                          onClick={() => {
                            onFastTravel(selectedProp.x, selectedProp.z, selectedProp.name);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 min-h-[38px] text-xs font-extrabold text-slate-950 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Vai Ora</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  selectedStore && (
                    <>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-slate-950"
                            style={{ backgroundColor: selectedStore.brandColor }}
                          >
                            NEGOZIO
                          </span>
                          <span className="text-sm font-extrabold text-white truncate">{selectedStore.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 truncate">{selectedStore.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const door = getStoreDoorPos(selectedStore);
                            onSetWaypoint(door.x, door.z);
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-500/25 border border-purple-400/50 px-3 min-h-[38px] text-xs font-bold text-purple-200 active:scale-95"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>GPS</span>
                        </button>
                        {onFastTravel && (
                          <button
                            onClick={() => {
                              const door = getStoreDoorPos(selectedStore);
                              onFastTravel(door.x, door.z, selectedStore.name);
                              onClose();
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 min-h-[38px] text-xs font-extrabold text-slate-950 active:scale-95"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Entra Ora</span>
                          </button>
                        )}
                      </div>
                    </>
                  )
                )}
              </div>
            )}
          </div>

          {/* Right Directory Panel (Negozi + GTA Online + Modalità Storia) */}
          <div
            className={`${
              mobileListOpen ? 'flex flex-1' : 'hidden lg:flex'
            } lg:w-80 xl:w-96 flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0a0e16] min-h-0`}
          >
            <div className="p-2.5 space-y-2 border-b border-white/10 shrink-0">
              {/* Filter Tabs */}
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['all', 'Tutti'],
                    ['stores', `Negozi (${WALK_IN_STORES.length})`],
                    ['online', 'Online'],
                    ['story', 'Storia'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setModeFilter(key)}
                    className={`rounded-lg py-2 text-[10px] font-bold border transition-colors ${
                      modeFilter === key
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-[#131a26] text-slate-300 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca villa, bunker, cinema, hangar..."
                  className="w-full rounded-lg bg-[#131a26] border border-white/15 pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Scrollable List of Walk-In Stores & Locations */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {filteredStores.map((s) => {
                const isSelected = selectedStore?.id === s.id;
                const door = getStoreDoorPos(s);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      selectStore(s);
                      setMobileListOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl p-2.5 border transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-400/60'
                        : 'bg-[#121824] border-emerald-400/20 hover:border-emerald-400/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-950 shrink-0"
                          style={{ backgroundColor: s.brandColor }}
                        >
                          <ShoppingBag className="w-3 h-3" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {s.district} · Negozio aperto 3D
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 shrink-0">Entra</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectStore(s);
                          setMobileListOpen(false);
                        }}
                        className="flex-1 rounded-md bg-purple-500/20 border border-purple-400/35 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-500/30"
                      >
                        Imposta GPS
                      </button>
                      {onFastTravel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFastTravel(door.x, door.z, s.name);
                            onClose();
                          }}
                          className="flex-1 rounded-md bg-emerald-400 py-1 text-[10px] font-extrabold text-slate-950 hover:bg-emerald-300"
                        >
                          Vai all&apos;Ingresso
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredProperties.map((p) => {
                const owned = hud.ownedProperties.includes(p.id) || p.price === 0;
                const isSelected = selectedProp?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      selectProperty(p);
                      setMobileListOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl p-2.5 border transition-colors ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400/60'
                        : 'bg-[#121824] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-extrabold text-slate-950 shrink-0"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.shortCode}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {p.district} · {p.mode === 'online' ? 'Online' : 'Storia'}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          owned ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {owned ? (p.price === 0 ? 'Aperto' : 'Tuo') : `$${p.price.toLocaleString('it-IT')}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectProperty(p);
                          setMobileListOpen(false);
                        }}
                        className="flex-1 rounded-md bg-purple-500/20 border border-purple-400/35 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-500/30"
                      >
                        Imposta GPS
                      </button>
                      {onFastTravel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFastTravel(p.x, p.z, p.name);
                            onClose();
                          }}
                          className="flex-1 rounded-md bg-amber-400 py-1 text-[10px] font-extrabold text-slate-950 hover:bg-amber-300"
                        >
                          Vai Ora
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

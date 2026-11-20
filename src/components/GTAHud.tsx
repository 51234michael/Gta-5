import React, { useEffect, useRef } from 'react';
import { Maximize2, MessageSquare, Radio, Settings, Star, Users, Volume2, VolumeX, X } from 'lucide-react';
import { CHARACTERS, HudSnapshot, RADIO_STATIONS, WEAPONS } from '../game/types';
import { WORLD_PROPERTIES } from '../game/properties';
import { WALK_IN_STORES } from '../game/stores';
import { ROAD_COORDS } from '../game/world';

interface GTAHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onCycleRadio: () => void;
  onInteractZone: () => void;
  onCancelMission: () => void;
  onOpenFullMap: () => void;
  onOpenPause: () => void;
  onOpenChat: () => void;
}

export const GTAHud: React.FC<GTAHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onCycleRadio,
  onInteractZone,
  onCancelMission,
  onOpenFullMap,
  onOpenPause,
  onOpenChat,
}) => {
  const radarRef = useRef<HTMLCanvasElement | null>(null);

  // Draw GTA V Rectangular Minimap Radar
  useEffect(() => {
    const canvas = radarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = 0.36; // zoomed appropriately for massive 9x9 metropolis

    ctx.clearRect(0, 0, w, h);

    // Map background (urban slate)
    ctx.fillStyle = '#18202c';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    // Align camera look direction straight UP on the radar
    ctx.rotate(hud.cameraHeading);

    const toMapX = (wx: number) => (wx - hud.playerX) * scale;
    const toMapY = (wz: number) => (wz - hud.playerZ) * scale;

    // Ocean & Beach south
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(toMapX(-900), toMapY(656), 1800 * scale, 500 * scale);
    ctx.fillStyle = '#a89367';
    ctx.fillRect(toMapX(-900), toMapY(568), 1800 * scale, 88 * scale);

    // Vespucci Pier & Offshore Yacht / Kosatka Jetties
    ctx.fillStyle = '#7c5338';
    ctx.fillRect(toMapX(113), toMapY(615), 14 * scale, 120 * scale);
    ctx.fillRect(toMapX(262), toMapY(644), 6.5 * scale, 132 * scale);
    ctx.fillRect(toMapX(-148), toMapY(645), 5.5 * scale, 126 * scale);
    ctx.fillRect(toMapX(-270), toMapY(639), 11 * scale, 58 * scale);
    ctx.fillRect(toMapX(-510), toMapY(639), 11 * scale, 58 * scale);

    // Super Yacht Galaxy & Kosatka silhouettes
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(toMapX(257), toMapY(780), 16 * scale, 48 * scale);
    ctx.fillStyle = '#334155';
    ctx.fillRect(toMapX(-150), toMapY(776), 10 * scale, 38 * scale);

    // Hills north
    ctx.fillStyle = '#273c24';
    ctx.fillRect(toMapX(-900), toMapY(-860), 1800 * scale, 290 * scale);

    // Los Santos Golf Club (x: -348..-252, z: -348..-252)
    ctx.fillStyle = '#3f8f3d';
    ctx.fillRect(toMapX(-348), toMapY(-348), 96 * scale, 96 * scale);

    // Diamond Casino & Master Penthouse (x: 420, z: -305)
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(toMapX(396), toMapY(-322), 48 * scale, 34 * scale);

    // Parco Centrale Solis (x: 189..291, z: -171..-69)
    ctx.fillStyle = '#2e6f35';
    ctx.fillRect(toMapX(189), toMapY(-171), 102 * scale, 102 * scale);
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(toMapX(240), toMapY(-120), 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Stadio Solis (x: 360, z: -240, r: 44)
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(toMapX(360), toMapY(-240), 44 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Aeroporto di Los Solis Runway (x: -435..-405, z: 180..460)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(toMapX(-435), toMapY(180), 30 * scale, 280 * scale);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toMapX(-420), toMapY(186));
    ctx.lineTo(toMapX(-420), toMapY(454));
    ctx.stroke();
    ctx.setLineDash([]);

    // 9x9 Road Grid + Outer Boulevards
    ctx.fillStyle = '#374151';
    const rw = 18 * scale;
    const allRoads = [...ROAD_COORDS, -560, 560];
    for (const r of allRoads) {
      ctx.fillRect(toMapX(r) - rw / 2, toMapY(-570), rw, 1140 * scale);
      ctx.fillRect(toMapX(-570), toMapY(r) - rw / 2, 1140 * scale, rw);
    }

    // GPS Route line
    const gpsTarget = hud.waypoint
      ? hud.waypoint
      : hud.activeMission
      ? { x: hud.activeMission.targetX, z: hud.activeMission.targetZ }
      : null;

    if (gpsTarget) {
      ctx.strokeStyle = hud.waypoint ? '#c084fc' : '#facc15';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(toMapX(gpsTarget.x), toMapY(gpsTarget.z));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Blips
    for (const b of hud.blips) {
      const bx = toMapX(b.x);
      const by = toMapY(b.z);
      ctx.fillStyle = b.color;
      if (b.kind === 'shop' || b.kind === 'mission') {
        ctx.beginPath();
        ctx.arc(bx, by, 5.2, 0, Math.PI * 2);
        ctx.fill();
        if (b.label) {
          ctx.fillStyle = '#090c10';
          ctx.font = 'bold 7px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.label, bx, by + 0.5);
        }
      } else if (b.kind === 'property') {
        const dSq = (b.x - hud.playerX) ** 2 + (b.z - hud.playerZ) ** 2;
        if (dSq > 320 * 320) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(bx - 3, by - 3, 6, 6);
        ctx.strokeStyle = '#090c10';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx - 3, by - 3, 6, 6);
      } else if (b.kind === 'online_player') {
        ctx.beginPath();
        ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (b.kind === 'police') {
        ctx.fillRect(bx - 3, by - 3, 6, 6);
      } else if (b.kind === 'waypoint') {
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(bx, by, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Player arrow at center (aligned to match camera & heading accurately)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const relHeading = hud.cameraHeading - hud.playerHeading + Math.PI;
    ctx.rotate(relHeading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090c10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hud]);

  const weaponDef = WEAPONS[hud.weaponId];
  const charProf = CHARACTERS[hud.characterId];
  const radioInfo = RADIO_STATIONS.find((r) => r.id === hud.radioStation);

  const lowHealthTint = hud.health < 35 && !hud.isDead ? (35 - hud.health) / 78 : 0;
  const redOverlayAlpha = hud.isDead
    ? 0.78
    : Math.min(0.82, Math.max(hud.damageFlash * 0.78, lowHealthTint));

  return (
    <>
      {/* RED DAMAGE & DEATH SCREEN OVERLAY */}
      {redOverlayAlpha > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 z-[25] transition-opacity duration-100"
          style={{
            opacity: redOverlayAlpha,
            background: hud.isDead
              ? 'radial-gradient(circle at center, rgba(153, 27, 27, 0.42) 20%, rgba(127, 29, 29, 0.92) 100%)'
              : 'radial-gradient(circle at center, rgba(220, 38, 38, 0.14) 35%, rgba(185, 28, 28, 0.85) 100%)',
          }}
        />
      )}

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-4 safe-pt safe-pb">
        {/* TOP BAR */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left: District + Audio + Options + Online Badge */}
          <div className="flex flex-col gap-1.5 max-w-[58vw] sm:max-w-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-[#0a0d12]/88 px-2.5 py-1 border border-white/10 min-h-[34px]">
                <span className="font-mono-hud text-[11px] font-bold text-amber-400">{hud.gameTimeStr}</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-xs font-semibold text-slate-100 truncate max-w-[125px] sm:max-w-none">
                  {hud.district}
                </span>
              </div>

              <button
                onClick={onOpenPause}
                aria-label="Opzioni e Menu"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-md bg-[#0a0d12]/88 border border-white/15 text-slate-100 active:scale-95"
              >
                <Settings className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={onToggleMute}
                aria-label={muted ? 'Attiva audio' : 'Disattiva audio'}
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-md bg-[#0a0d12]/88 border border-white/10 text-slate-200 active:scale-95"
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              {hud.onlineMode && (
                <button
                  onClick={onOpenChat}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-sky-950/90 border border-sky-400/40 px-2.5 h-9 text-[11px] font-bold text-sky-100 active:scale-95"
                >
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>{hud.onlineRoom}</span>
                  <span className="text-emerald-400">({hud.onlinePlayersCount})</span>
                  <MessageSquare className="w-3.5 h-3.5 text-amber-300 ml-0.5" />
                </button>
              )}
            </div>

            {hud.inVehicle && (
              <button
                onClick={onCycleRadio}
                className="pointer-events-auto flex items-center gap-2 self-start rounded-md bg-[#0a0d12]/85 px-2.5 py-1 border border-white/15 text-left active:scale-95"
              >
                <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="leading-tight">
                  <div className="text-[11px] font-bold text-white whitespace-nowrap">{radioInfo?.name}</div>
                  <div className="text-[9px] text-slate-400 whitespace-nowrap">{hud.vehicleName}</div>
                </div>
              </button>
            )}

            {hud.activeMission && (
              <div className="pointer-events-auto rounded-md bg-[#0a0d12]/90 p-2 border border-amber-400/45 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold tracking-wide text-amber-400 uppercase">
                    {hud.activeMission.def.title}
                  </span>
                  <button
                    onClick={onCancelMission}
                    aria-label="Annulla missione"
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-100 leading-snug mt-0.5">{hud.activeMission.objectiveText}</p>
                {hud.activeMission.timeLeftSec !== null && (
                  <div className="font-mono-hud text-xs font-bold text-rose-400 mt-1">
                    Tempo: {Math.max(0, Math.ceil(hud.activeMission.timeLeftSec))}s
                  </div>
                )}
              </div>
            )}

            {hud.nearZone && !hud.isDead && (
              <button
                onClick={onInteractZone}
                className="pointer-events-auto self-start rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg active:scale-95 max-w-[72vw] sm:max-w-md text-left"
              >
                {(() => {
                  if (hud.nearZone.type === 'store') return `${hud.nearZone.name} · Apri Bancone [E]`;
                  if (hud.nearZone.type === 'ammu') return 'Armeria: Ricarica Salute/Giubbotto ($400)';
                  if (hud.nearZone.type === 'paynspray') return "Pay'n'Spray: Ripara e Azzera Stelle";
                  if (hud.nearZone.type === 'hospital') return 'Centro Medico: Cura Salute';
                  if (hud.nearZone.type === 'property' && hud.nearZone.propertyId) {
                    const prop = WORLD_PROPERTIES.find((p) => p.id === hud.nearZone?.propertyId);
                    if (prop) {
                      const owned = hud.ownedProperties.includes(prop.id) || prop.price === 0;
                      return owned
                        ? `${prop.name} · ${prop.actionLabel} [E]`
                        : `Acquista ${prop.name} ($${prop.price.toLocaleString('it-IT')}) [E]`;
                    }
                  }
                  return `Avvia: ${hud.nearZone.name}`;
                })()}
              </button>
            )}

            {hud.insideStoreId && !hud.nearZone && !hud.isDead && (
              <div className="self-start rounded-md bg-emerald-950/90 border border-emerald-400/45 px-2.5 py-1 text-[11px] font-bold text-emerald-200 shadow">
                Dentro: {WALK_IN_STORES.find((s) => s.id === hud.insideStoreId)?.name ?? 'Negozio'} · Avvicinati al bancone
              </div>
            )}
          </div>

          {/* Top-Right: Wanted Stars + Cash + Weapon/Ammo */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-col items-end gap-1 bg-[#0a0d12]/80 px-2 py-1 rounded-md border border-white/10">
              <div className={`flex items-center gap-1 ${hud.wantedLevel > 0 && !hud.policeSpotted ? 'animate-pulse' : ''}`}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= hud.wantedLevel;
                  return (
                    <Star
                      key={star}
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        active
                          ? hud.policeSpotted
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-sky-300 fill-sky-300/70'
                          : 'text-slate-600/70'
                      }`}
                    />
                  );
                })}
              </div>
              {hud.wantedLevel > 0 && (
                <div className="w-full flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      hud.policeSpotted ? 'text-rose-400' : 'text-sky-300'
                    }`}
                  >
                    {hud.policeSpotted ? 'AVVISTATO' : 'FUORI VISTA'}
                  </span>
                  {!hud.policeSpotted && (
                    <div className="flex-1 h-1 bg-slate-700/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-400 transition-all duration-150"
                        style={{ width: `${Math.max(0, Math.min(100, hud.wantedCooldown * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 bg-[#0a0d12]/80 px-2.5 py-0.5 rounded-md border border-white/10">
              {hud.cashDelta !== 0 && (
                <span
                  className={`font-display text-sm font-bold ${
                    hud.cashDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {hud.cashDelta > 0 ? `+$${hud.cashDelta}` : `-$${Math.abs(hud.cashDelta)}`}
                </span>
              )}
              <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-400 tabular-nums">
                ${hud.cash.toLocaleString('it-IT')}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-[#0a0d12]/80 px-2.5 py-1 rounded-md border border-white/10">
              <span className="text-[11px] font-bold tracking-wide text-slate-200">{weaponDef.shortName}</span>
              {hud.weaponId !== 'fists' && (
                <span className="font-mono-hud text-xs font-bold text-amber-300">
                  {hud.ammo[hud.weaponId]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CENTER TOAST / DRAMATIC BANNERS */}
        {hud.statusBanner && (
          <div className="pointer-events-none fixed inset-x-0 top-1/3 -translate-y-1/2 flex flex-col items-center justify-center z-30 px-4">
            <div
              className={`px-8 py-4 rounded-lg border text-center shadow-2xl ${
                hud.statusBanner.type === 'wasted'
                  ? 'bg-[#090c10]/94 border-rose-500/70'
                  : hud.statusBanner.type === 'mission_passed'
                  ? 'bg-[#090c10]/94 border-amber-400/70'
                  : 'bg-[#090c10]/94 border-sky-400/60'
              }`}
            >
              <div
                className={`font-display text-4xl sm:text-5xl font-extrabold italic tracking-wider ${
                  hud.statusBanner.type === 'wasted'
                    ? 'text-rose-500'
                    : hud.statusBanner.type === 'mission_passed'
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                {hud.statusBanner.title}
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-200 mt-1">{hud.statusBanner.subtitle}</div>
            </div>
          </div>
        )}

        {hud.toastText && !hud.statusBanner && (
          <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 px-4">
            <div className="rounded-md bg-[#0a0d12]/90 border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg whitespace-nowrap">
              {hud.toastText}
            </div>
          </div>
        )}

        {/* BOTTOM-LEFT: Clickable GTA V Rectangular Minimap */}
        <div className="pointer-events-none flex items-end justify-between">
          <button
            type="button"
            onClick={onOpenFullMap}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Apri mappa completa di Los Solis"
            className="pointer-events-auto cursor-pointer text-left flex flex-col gap-1 bg-[#0a0d12]/90 p-1.5 rounded-md border border-white/20 hover:border-amber-400/70 shadow-xl w-[138px] sm:w-[176px] active:scale-[0.98] transition-transform"
          >
            <div className="relative w-full h-[82px] sm:h-[106px] overflow-hidden rounded-sm border border-white/10">
              <canvas ref={radarRef} width={176} height={106} className="w-full h-full block" />
              {hud.inVehicle && (
                <div className="absolute bottom-1 right-1 bg-[#090c10]/85 px-1.5 py-0.5 rounded text-[10px] font-mono-hud font-bold text-white">
                  {hud.speedKmh} km/h
                </div>
              )}
              <div
                className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-slate-950"
                style={{ backgroundColor: charProf.accentColor }}
              >
                {charProf.name}
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-[#090c10]/85 px-1 py-0.5 text-[8px] font-bold text-slate-200 border border-white/15">
                <Maximize2 className="w-2.5 h-2.5 text-amber-400" />
                <span className="hidden sm:inline">MAPPA</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1 h-2 w-full">
              <div className="col-span-6 bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.health < 35 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.health))}%` }}
                />
              </div>
              <div className="col-span-3 bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, hud.armor))}%` }}
                />
              </div>
              <div className="col-span-3 bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, hud.special))}%` }}
                />
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};

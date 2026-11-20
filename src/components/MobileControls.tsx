import React, { useRef, useState } from 'react';
import {
  Camera,
  Car,
  Crosshair,
  Footprints,
  Gauge,
  LogOut,
  RotateCcw,
  Shield,
  Smartphone,
  Siren,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { InputState } from '../game/engine';
import { HudSnapshot, TouchControlsMode, WEAPONS } from '../game/types';

interface MobileControlsProps {
  hud: HudSnapshot;
  touchMode: TouchControlsMode;
  inputRef: React.MutableRefObject<InputState>;
  onOrbitCamera: (dx: number, dy: number) => void;
  onEnterExitCar: () => void;
  onJumpOrHorn: () => void;
  onDodge: () => void;
  onSpecial: () => void;
  onOpenWeapons: () => void;
  onOpenCharacters: () => void;
  onOpenPhone: () => void;
  onCycleCamera: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  hud,
  touchMode,
  inputRef,
  onOrbitCamera,
  onEnterExitCar,
  onJumpOrHorn,
  onDodge,
  onSpecial,
  onOpenWeapons,
  onOpenCharacters,
  onOpenPhone,
  onCycleCamera,
}) => {
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [sprintLocked, setSprintLocked] = useState(false);

  const camPointerId = useRef<number | null>(null);
  const camLastPos = useRef({ x: 0, y: 0 });

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnobPos({ x: dx, y: dy });
    inputRef.current.joyX = dx / maxR;
    inputRef.current.joyY = -(dy / maxR);
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setKnobPos({ x: 0, y: 0 });
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
  };

  const toggleSprint = () => {
    const next = !sprintLocked;
    setSprintLocked(next);
    inputRef.current.sprint = next;
  };

  const hideTouchPads = touchMode === 'hidden';

  return (
    <>
      {/* Full-viewport touch surface for 3D camera orbit */}
      <div
        className="fixed inset-0 z-[5] touch-none"
        onPointerDown={(e) => {
          if (camPointerId.current === null) {
            camPointerId.current = e.pointerId;
            camLastPos.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onPointerMove={(e) => {
          if (e.pointerId === camPointerId.current) {
            const dx = e.clientX - camLastPos.current.x;
            const dy = e.clientY - camLastPos.current.y;
            camLastPos.current = { x: e.clientX, y: e.clientY };
            onOrbitCamera(dx, dy);
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerId === camPointerId.current) camPointerId.current = null;
        }}
        onPointerCancel={(e) => {
          if (e.pointerId === camPointerId.current) camPointerId.current = null;
        }}
      />

      {/* Quick Utility Buttons (positioned cleanly below Wanted/Cash/Ammo HUD) */}
      <div className="pointer-events-auto fixed top-[130px] sm:top-[144px] right-2.5 sm:right-4 z-20 flex flex-col gap-2">
        <button
          onClick={onOpenPhone}
          aria-label="Apri SolisPhone"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a0d12]/88 border border-white/15 text-sky-400 shadow-lg active:scale-95"
        >
          <Smartphone className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenWeapons}
          aria-label="Ruota delle armi"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a0d12]/88 border border-white/15 text-amber-400 shadow-lg active:scale-95"
        >
          <Shield className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenCharacters}
          aria-label="Cambia personaggio"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a0d12]/88 border border-white/15 text-emerald-400 shadow-lg active:scale-95"
        >
          <Users className="w-5 h-5" />
        </button>
        <button
          onClick={onCycleCamera}
          aria-label="Cambia visuale camera"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a0d12]/88 border border-white/15 text-slate-200 shadow-lg active:scale-95"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      {!hideTouchPads && (
        <>
          {/* LEFT THUMB ZONE: Virtual Analog Joystick */}
          <div className="pointer-events-auto fixed bottom-[126px] sm:bottom-[146px] left-3 sm:left-5 z-20">
            <div
              ref={joyBaseRef}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                joyPointerId.current = e.pointerId;
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.pointerId === joyPointerId.current) {
                  updateJoystick(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (e.pointerId === joyPointerId.current) resetJoystick();
              }}
              onPointerCancel={(e) => {
                if (e.pointerId === joyPointerId.current) resetJoystick();
              }}
              className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-[#0a0d12]/65 border-2 border-white/20 flex items-center justify-center touch-none shadow-xl"
            >
              <div className="absolute inset-x-4 h-px bg-white/10 pointer-events-none" />
              <div className="absolute inset-y-4 w-px bg-white/10 pointer-events-none" />
              <div
                className="h-12 w-12 rounded-full bg-white/85 border-2 border-slate-900 shadow-md pointer-events-none"
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              />
            </div>
          </div>

          {/* RIGHT THUMB ZONE: Context-Sensitive GTA V Mobile Controls */}
          <div className="pointer-events-auto fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-20 flex flex-col items-end gap-2.5 safe-pb">
            {(hud.nearVehicleName || hud.inVehicle) && (
              <button
                onClick={onEnterExitCar}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-3.5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-slate-950 shadow-xl active:scale-95 min-h-[44px]"
              >
                {hud.inVehicle ? (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Esci</span>
                  </>
                ) : (
                  <>
                    <Car className="w-4 h-4" />
                    <span>Guida {hud.nearVehicleName}</span>
                  </>
                )}
              </button>
            )}

            {hud.inVehicle ? (
              /* VEHICLE CONTROLS */
              <div className="flex items-end gap-2.5">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={onSpecial}
                    aria-label="Turbo o Abilità Speciale"
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 ${
                      hud.specialActive
                        ? 'bg-amber-400 border-white text-slate-950'
                        : 'bg-[#0a0d12]/85 border-amber-400/60 text-amber-400'
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onJumpOrHorn}
                    aria-label="Clacson o Sirena"
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 ${
                      hud.sirenOn
                        ? 'bg-rose-600 border-sky-300 text-white'
                        : 'bg-[#0a0d12]/85 border-white/25 text-white'
                    }`}
                  >
                    <Siren className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    inputRef.current.brake = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.brake = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.brake = false;
                  }}
                  onPointerCancel={() => {
                    inputRef.current.brake = false;
                  }}
                  className="flex h-16 w-14 flex-col items-center justify-center rounded-xl bg-rose-600/85 border-2 border-rose-300/60 text-white shadow-xl active:scale-95 touch-none"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-[10px] font-bold mt-0.5">FRENO</span>
                </button>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      inputRef.current.handbrake = true;
                    }}
                    onPointerUp={() => {
                      inputRef.current.handbrake = false;
                    }}
                    onPointerLeave={() => {
                      inputRef.current.handbrake = false;
                    }}
                    onPointerCancel={() => {
                      inputRef.current.handbrake = false;
                    }}
                    className="flex h-11 w-16 items-center justify-center rounded-xl bg-[#0a0d12]/85 border border-white/25 text-[10px] font-bold text-amber-300 shadow-lg active:scale-95 touch-none"
                  >
                    DRIFT
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      inputRef.current.gas = true;
                    }}
                    onPointerUp={() => {
                      inputRef.current.gas = false;
                    }}
                    onPointerLeave={() => {
                      inputRef.current.gas = false;
                    }}
                    onPointerCancel={() => {
                      inputRef.current.gas = false;
                    }}
                    className="flex h-20 w-16 flex-col items-center justify-center rounded-xl bg-emerald-500/90 border-2 border-emerald-200/70 text-slate-950 shadow-xl active:scale-95 touch-none"
                  >
                    <Gauge className="w-6 h-6" />
                    <span className="text-[10px] font-extrabold mt-0.5">GAS</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ON-FOOT CONTROLS (with SCHIVA dodge button) */
              <div className="flex items-end gap-2.5">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={onSpecial}
                    aria-label="Abilità speciale"
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 ${
                      hud.specialActive
                        ? 'bg-amber-400 border-white text-slate-950'
                        : 'bg-[#0a0d12]/85 border-amber-400/60 text-amber-400'
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                  <button
                    onClick={toggleSprint}
                    aria-label="Scatto"
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 ${
                      sprintLocked
                        ? 'bg-emerald-500 border-white text-slate-950'
                        : 'bg-[#0a0d12]/85 border-white/25 text-white'
                    }`}
                  >
                    <Footprints className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={onDodge}
                    disabled={hud.dodgeCooldown > 0.05}
                    aria-label="Schiva proiettili"
                    className={`flex h-12 w-16 flex-col items-center justify-center rounded-xl border-2 text-[10px] font-extrabold shadow-lg active:scale-95 transition-opacity ${
                      hud.isDodging
                        ? 'bg-sky-400 border-white text-slate-950'
                        : hud.dodgeCooldown > 0.05
                        ? 'bg-[#0a0d12]/65 border-white/15 text-slate-400 opacity-65'
                        : 'bg-sky-600/90 border-sky-200/70 text-white'
                    }`}
                  >
                    <Wind className="w-4 h-4" />
                    <span>SCHIVA</span>
                  </button>

                  <button
                    onClick={onJumpOrHorn}
                    className="flex h-11 w-16 items-center justify-center rounded-xl bg-[#0a0d12]/85 border border-white/25 text-[11px] font-bold text-white shadow-lg active:scale-95"
                  >
                    SALTA
                  </button>
                </div>

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    inputRef.current.firing = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.firing = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.firing = false;
                  }}
                  onPointerCancel={() => {
                    inputRef.current.firing = false;
                  }}
                  className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-rose-600/90 border-2 border-rose-200/80 text-white shadow-2xl active:scale-95 touch-none"
                >
                  <Crosshair className="w-7 h-7" />
                  <span className="text-[10px] font-extrabold tracking-wide mt-0.5">
                    {hud.weaponId === 'fists' ? 'COLPISCI' : WEAPONS[hud.weaponId].shortName}
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

import React from 'react';
import { Check, X, Zap } from 'lucide-react';
import { CHARACTERS, CharacterId } from '../game/types';

interface CharacterWheelProps {
  currentId: CharacterId;
  onSelect: (id: CharacterId) => void;
  onClose: () => void;
}

const CHAR_ORDER: CharacterId[] = ['marco', 'luca', 'tiziano'];

export const CharacterWheel: React.FC<CharacterWheelProps> = ({
  currentId,
  onSelect,
  onClose,
}) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#0a0d12]/95 border border-white/15 p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-wide text-white uppercase">
              Cambio Protagonista
            </h2>
            <p className="text-xs text-slate-400">
              Scegli un personaggio di Los Solis con la sua abilità speciale
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi cambio personaggio"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 mt-3">
          {CHAR_ORDER.map((id) => {
            const prof = CHARACTERS[id];
            const active = id === currentId;
            return (
              <button
                key={id}
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                className={`flex items-center justify-between gap-3 rounded-xl p-3 text-left border transition-colors active:scale-[0.99] min-h-[68px] ${
                  active
                    ? 'bg-slate-800/95 border-white/40'
                    : 'bg-[#121721] border-white/10 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-extrabold text-slate-950"
                    style={{ backgroundColor: prof.accentColor }}
                  >
                    {prof.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold text-white">
                        {prof.name} {prof.surname}
                      </span>
                      <span className="text-xs text-slate-400">· {prof.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 mt-0.5">
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {prof.specialName}: {prof.specialDesc}
                      </span>
                    </div>
                  </div>
                </div>
                {active && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

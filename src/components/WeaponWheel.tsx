import React from 'react';
import { X } from 'lucide-react';
import { WEAPONS, WeaponId } from '../game/types';

interface WeaponWheelProps {
  currentWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  onSelect: (id: WeaponId) => void;
  onClose: () => void;
}

const WHEEL_ORDER: WeaponId[] = ['rifle', 'smg', 'pistol', 'fists', 'grenade', 'shotgun'];

export const WeaponWheel: React.FC<WeaponWheelProps> = ({
  currentWeapon,
  ammo,
  onSelect,
  onClose,
}) => {
  const activeDef = WEAPONS[currentWeapon];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[310px] h-[310px] sm:w-[360px] sm:h-[360px] rounded-full bg-[#0a0d12]/94 border-2 border-white/20 shadow-2xl flex items-center justify-center"
      >
        {/* Center Info Hub */}
        <div className="z-10 flex flex-col items-center text-center px-4 w-36">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Ruota Armi
          </span>
          <h3 className="font-display text-xl font-extrabold text-white mt-0.5 leading-tight">
            {activeDef.name}
          </h3>
          <div className="text-xs text-slate-300 mt-1 font-mono-hud">
            {currentWeapon === 'fists' ? 'Corpo a corpo' : `Colpi: ${ammo[currentWeapon]}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Danno: {activeDef.damage}
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi ruota armi"
            className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6 Radial Weapon Slots */}
        {WHEEL_ORDER.map((id, idx) => {
          const def = WEAPONS[id];
          const angle = (idx / WHEEL_ORDER.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 112;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isSelected = id === currentWeapon;
          const isEmpty = id !== 'fists' && ammo[id] <= 0;

          return (
            <button
              key={id}
              onClick={() => {
                onSelect(id);
                onClose();
              }}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                borderColor: isSelected ? def.color : 'rgba(255,255,255,0.16)',
              }}
              className={`absolute flex flex-col items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-2 transition-transform active:scale-95 ${
                isSelected
                  ? 'bg-slate-800 shadow-lg scale-105'
                  : isEmpty
                  ? 'bg-[#121721]/60 opacity-55'
                  : 'bg-[#121721]/95 hover:bg-slate-800'
              }`}
            >
              <span
                className="text-[11px] font-extrabold tracking-wide"
                style={{ color: def.color }}
              >
                {def.shortName}
              </span>
              <span
                className={`font-mono-hud text-[11px] mt-0.5 ${
                  isEmpty ? 'text-rose-400 font-bold' : 'text-slate-200'
                }`}
              >
                {id === 'fists' ? 'Mani' : isEmpty ? '0' : ammo[id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

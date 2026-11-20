import React from 'react';
import {
  AlertTriangle,
  Car,
  Heart,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  BARBER_ITEMS,
  CLOTHING_ITEMS,
  DISPENSARY_ITEMS,
  LSC_PAINTS,
  SUPERMARKET_ITEMS,
  WalkInStore,
} from '../game/stores';
import { HudSnapshot, WEAPONS, WeaponId } from '../game/types';

interface StoreModalProps {
  store: WalkInStore;
  hud: HudSnapshot;
  onClose: () => void;
  onBuySnack: (healthGain: number, specialGain: number, price: number, label: string) => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onBuyArmor: () => void;
  onCustomizeStyle: (
    opts: {
      jacketColor?: number;
      pantsColor?: number;
      toggleAccessory?: 'sunglasses' | 'cap' | 'chain';
      hairColor?: number;
    },
    price: number,
    label: string
  ) => void;
  onCustomizeLsc: (
    opts: { repair?: boolean; colorHex?: number; turbo?: boolean; clearWanted?: boolean },
    price: number,
    label: string
  ) => void;
  onRobStore: (storeId: string, storeName: string) => void;
}

const toCssHex = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

export const StoreModal: React.FC<StoreModalProps> = ({
  store,
  hud,
  onClose,
  onBuySnack,
  onBuyWeapon,
  onBuyArmor,
  onCustomizeStyle,
  onCustomizeLsc,
  onRobStore,
}) => {
  const StoreIcon =
    store.type === 'ammu_store'
      ? Shield
      : store.type === 'clothing'
      ? Shirt
      : store.type === 'lsc'
      ? Wrench
      : store.type === 'barber'
      ? Scissors
      : store.type === 'dispensary'
      ? Sparkles
      : ShoppingBag;

  const ammuWeapons: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'grenade'];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 safe-pt safe-pb"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] rounded-2xl bg-[#0c1018] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Store Counter Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#080b11] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-950 shadow-md"
              style={{ backgroundColor: store.brandColor }}
            >
              <StoreIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-wide text-white leading-none truncate">
                {store.name}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                {store.district} · Commesso: <span className="text-slate-200 font-semibold">{store.clerkName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-1 text-right">
              <div className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold">Contanti</div>
              <div className="font-display text-sm sm:text-base font-extrabold text-emerald-400 tabular-nums leading-none">
                ${hud.cash.toLocaleString('it-IT')}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Esci dal bancone"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/20 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Description & Status Strip */}
        <div className="px-4 py-2.5 bg-[#101622] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-300">{store.description}</span>
          <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-400">
              <Heart className="w-3.5 h-3.5" /> {hud.health}%
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <Shield className="w-3.5 h-3.5" /> {hud.armor}%
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <Zap className="w-3.5 h-3.5" /> {hud.special}%
            </span>
          </div>
        </div>

        {/* Store Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(store.type === 'supermarket' || store.type === 'dispensary') && (
            <>
              <div className="space-y-2">
                {(store.type === 'supermarket' ? SUPERMARKET_ITEMS : DISPENSARY_ITEMS).map((item) => {
                  const canAfford = hud.cash >= item.price;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#131a26] border border-white/10 p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-bold">
                          {item.healthGain > 0 && <span className="text-emerald-400">+{item.healthGain} Salute</span>}
                          {item.specialGain > 0 && <span className="text-amber-400">+{item.specialGain} Speciale</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuySnack(item.healthGain, item.specialGain, item.price, item.name)}
                        className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold transition active:scale-95 ${
                          canAfford
                            ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        ${item.price}
                      </button>
                    </div>
                  );
                })}
              </div>

              {store.robbable && (
                <div className="mt-4 rounded-xl bg-rose-950/50 border border-rose-500/45 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Rapina il Registratore di Cassa</span>
                    </div>
                    <p className="text-[11px] text-rose-200/80 mt-0.5">
                      Bottino rapido $280–$650 · Attiva 2 Stelle Polizia
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onRobStore(store.id, store.name);
                      onClose();
                    }}
                    className="shrink-0 rounded-lg bg-rose-500 hover:bg-rose-400 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg active:scale-95"
                  >
                    RAPINA
                  </button>
                </div>
              )}
            </>
          )}

          {store.type === 'ammu_store' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-950/40 border border-sky-400/35 p-3">
                <div>
                  <div className="text-sm font-extrabold text-white">Giubbotto Antiproiettile & Cure</div>
                  <div className="text-[11px] text-sky-200/80">Porta Salute e Protezione al 100%</div>
                </div>
                <button
                  type="button"
                  disabled={hud.cash < 400}
                  onClick={onBuyArmor}
                  className={`shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold active:scale-95 ${
                    hud.cash >= 400
                      ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  $400
                </button>
              </div>

              <div className="space-y-2">
                {ammuWeapons.map((wid) => {
                  const w = WEAPONS[wid];
                  const curAmmo = hud.ammo[wid];
                  const full = curAmmo >= w.maxAmmo;
                  const canAfford = hud.cash >= w.ammoPrice;
                  return (
                    <div
                      key={wid}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#131a26] border border-white/10 p-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{w.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Munizioni: <span className="text-amber-300 font-bold">{curAmmo}</span> / {w.maxAmmo} · +{w.ammoPack} colpi
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford || full}
                        onClick={() => onBuyWeapon(wid)}
                        className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold active:scale-95 ${
                          full
                            ? 'bg-slate-800 text-emerald-400'
                            : canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {full ? 'PIENO' : `$${w.ammoPrice}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {store.type === 'clothing' && (
            <div className="space-y-2">
              {CLOTHING_ITEMS.map((item) => {
                const canAfford = hud.cash >= item.price;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#131a26] border border-white/10 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1 shrink-0">
                        {item.jacketColor !== undefined ? (
                          <>
                            <span
                              className="w-5 h-5 rounded-md border border-white/30"
                              style={{ backgroundColor: toCssHex(item.jacketColor) }}
                            />
                            {item.pantsColor !== undefined && (
                              <span
                                className="w-5 h-5 rounded-md border border-white/30"
                                style={{ backgroundColor: toCssHex(item.pantsColor) }}
                              />
                            )}
                          </>
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pink-500/20 border border-pink-400/40 text-pink-300 text-xs font-bold">
                            3D
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() =>
                        onCustomizeStyle(
                          {
                            jacketColor: item.jacketColor,
                            pantsColor: item.pantsColor,
                            toggleAccessory: item.toggleAccessory,
                          },
                          item.price,
                          item.name
                        )
                      }
                      className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold active:scale-95 ${
                        canAfford
                          ? 'bg-pink-400 text-slate-950 hover:bg-pink-300'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ${item.price}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {store.type === 'barber' && (
            <div className="space-y-2">
              {BARBER_ITEMS.map((item) => {
                const canAfford = hud.cash >= item.price;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#131a26] border border-white/10 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-7 h-7 rounded-full border-2 border-white/35 shrink-0"
                        style={{ backgroundColor: toCssHex(item.hairColor) }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.desc} · +Salute 100%</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onCustomizeStyle({ hairColor: item.hairColor }, item.price, item.name)}
                      className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold active:scale-95 ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ${item.price}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {store.type === 'lsc' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-950/40 border border-sky-400/35 p-3">
                <div className="flex items-center gap-2.5">
                  <Car className="w-5 h-5 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      {hud.inVehicle ? hud.vehicleName : 'Veicolo vicino in Officina'}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Ripara carrozzeria e azzera subito le Stelle Polizia
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCustomizeLsc({ repair: true, clearWanted: true }, 0, 'Riparazione & Stelle Azzerate')
                  }
                  className="shrink-0 rounded-lg bg-sky-400 hover:bg-sky-300 px-3.5 py-2 text-xs font-extrabold text-slate-950 active:scale-95"
                >
                  GRATIS
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#131a26] border border-amber-400/35 p-3">
                <div>
                  <div className="text-sm font-extrabold text-amber-300">Turbo Tuning Stage 2</div>
                  <div className="text-[11px] text-slate-400">+22% Velocità massima e accelerazione sul veicolo</div>
                </div>
                <button
                  type="button"
                  disabled={hud.cash < 850}
                  onClick={() => onCustomizeLsc({ turbo: true, repair: true }, 850, 'Turbo Stage 2 Installato')}
                  className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold active:scale-95 ${
                    hud.cash >= 850
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  $850
                </button>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Verniciatura Personalizzata
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LSC_PAINTS.map((paint) => {
                    const canAfford = hud.cash >= paint.price;
                    return (
                      <button
                        key={paint.id}
                        type="button"
                        disabled={!canAfford}
                        onClick={() =>
                          onCustomizeLsc({ colorHex: paint.hex, repair: true }, paint.price, `Vernice ${paint.name}`)
                        }
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition active:scale-95 ${
                          canAfford
                            ? 'bg-[#131a26] border-white/15 hover:border-sky-400'
                            : 'bg-slate-900/60 border-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-white/40 shrink-0"
                            style={{ backgroundColor: paint.css }}
                          />
                          <span className="text-xs font-bold text-white truncate">{paint.name}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-400 shrink-0">${paint.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

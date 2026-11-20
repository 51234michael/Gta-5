import React from 'react';
import { Globe, Home, Settings, Volume2, X } from 'lucide-react';
import {
  GameSettings,
  GraphicsQuality,
  PoliceDifficulty,
  RADIO_STATIONS,
  RadioStationId,
  TimeOfDay,
  TouchControlsMode,
  TrafficDensity,
} from '../game/types';

interface PauseSettingsModalProps {
  settings: GameSettings;
  onlineEnabled: boolean;
  roomName: string;
  onChangeSettings: (next: GameSettings) => void;
  onToggleOnline: () => void;
  onReturnToTitle: () => void;
  onClose: () => void;
}

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({
  settings,
  onlineEnabled,
  roomName,
  onChangeSettings,
  onToggleOnline,
  onReturnToTitle,
  onClose,
}) => {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#06090f]/90 p-3 sm:p-6 safe-pt safe-pb"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#0d1118] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#080b10] border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
              Opzioni GTA V · Los Solis
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi opzioni"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Graphics */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Qualità Grafica</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['low', 'Bassa'],
                  ['medium', 'Media'],
                  ['high', 'Alta'],
                ] as [GraphicsQuality, string][]
              ).map(([q, label]) => (
                <button
                  key={q}
                  onClick={() => update('graphicsQuality', q)}
                  className={`rounded-xl min-h-[42px] text-xs font-bold border ${
                    settings.graphicsQuality === q
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#141a24] text-slate-200 border-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day & Traffic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ora del Giorno</div>
              <div className="grid grid-cols-2 gap-1.5">
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
                    onClick={() => update('timeOfDay', tod)}
                    className={`rounded-xl min-h-[38px] text-xs font-bold border ${
                      settings.timeOfDay === tod
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-[#141a24] text-slate-200 border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Traffico & Polizia</div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {(
                  [
                    ['low', 'Basso'],
                    ['normal', 'Normale'],
                    ['high', 'Intenso'],
                  ] as [TrafficDensity, string][]
                ).map(([td, label]) => (
                  <button
                    key={td}
                    onClick={() => update('trafficDensity', td)}
                    className={`rounded-xl min-h-[38px] text-[11px] font-bold border ${
                      settings.trafficDensity === td
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-[#141a24] text-slate-200 border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['relaxed', 'Facile'],
                    ['normal', 'Normale'],
                    ['hardcore', 'Estrema'],
                  ] as [PoliceDifficulty, string][]
                ).map(([pd, label]) => (
                  <button
                    key={pd}
                    onClick={() => update('policeDifficulty', pd)}
                    className={`rounded-xl min-h-[38px] text-[11px] font-bold border ${
                      settings.policeDifficulty === pd
                        ? 'bg-rose-500 text-white border-rose-300'
                        : 'bg-[#141a24] text-slate-200 border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sliders & Toggles */}
          <div className="space-y-3 rounded-xl bg-[#121822] border border-white/10 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Volume2 className="w-4 h-4" />
              <span>Audio e Sensibilità</span>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Sensibilità Camera</span>
                <span className="font-bold text-amber-300">{settings.cameraSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.cameraSensitivity}
                onChange={(e) => update('cameraSensitivity', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>SFX</span>
                  <span>{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => update('sfxVolume', parseFloat(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Radio</span>
                  <span>{Math.round(settings.radioVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.radioVolume}
                  onChange={(e) => update('radioVolume', parseFloat(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => update('autoAim', !settings.autoAim)}
                className={`rounded-xl min-h-[40px] text-xs font-bold border ${
                  settings.autoAim
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-[#171f2e] border-white/10 text-slate-400'
                }`}
              >
                Auto-Aim: {settings.autoAim ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => update('muted', !settings.muted)}
                className={`rounded-xl min-h-[40px] text-xs font-bold border ${
                  settings.muted
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-[#171f2e] border-white/10 text-slate-200'
                }`}
              >
                Muto: {settings.muted ? 'SÌ' : 'NO'}
              </button>
            </div>
          </div>

          {/* Radio & Touch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Radio Auto</div>
              <div className="grid grid-cols-2 gap-1.5">
                {RADIO_STATIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => update('defaultRadio', r.id as RadioStationId)}
                    className={`rounded-xl min-h-[38px] px-2 text-xs font-bold border truncate ${
                      settings.defaultRadio === r.id
                        ? 'bg-sky-500/25 border-sky-400 text-white'
                        : 'bg-[#141a24] border-white/10 text-slate-300'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Controlli Touch</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['auto', 'Auto'],
                    ['always', 'Sempre'],
                    ['hidden', 'Nascosti'],
                  ] as [TouchControlsMode, string][]
                ).map(([tm, label]) => (
                  <button
                    key={tm}
                    onClick={() => update('touchControls', tm)}
                    className={`rounded-xl min-h-[38px] text-xs font-bold border ${
                      settings.touchControls === tm
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-[#141a24] text-slate-200 border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#080b10] border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleOnline}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 min-h-[42px] text-xs font-bold border ${
                onlineEnabled
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-[#141a24] border-white/15 text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>{onlineEnabled ? `Esci da Online (${roomName})` : 'Attiva Online'}</span>
            </button>

            <button
              onClick={onReturnToTitle}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-400/40 px-3.5 min-h-[42px] text-xs font-bold text-rose-200"
            >
              <Home className="w-4 h-4" />
              <span>Schermata GTA V</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-emerald-400 px-5 min-h-[42px] text-xs font-black uppercase text-slate-950 active:scale-95"
          >
            Riprendi
          </button>
        </div>
      </div>
    </div>
  );
};

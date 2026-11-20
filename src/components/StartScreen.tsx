import React, { useEffect, useState } from 'react';
import {
  Car,
  Gamepad2,
  Globe,
  Play,
  Shield,
  Sliders,
  User,
  Volume2,
} from 'lucide-react';
import {
  CHARACTERS,
  CharacterId,
  GameSettings,
  GraphicsQuality,
  PoliceDifficulty,
  RADIO_STATIONS,
  RadioStationId,
  TimeOfDay,
  TouchControlsMode,
  TrafficDensity,
} from '../game/types';

interface StartScreenProps {
  settings: GameSettings;
  selectedChar: CharacterId;
  onlineEnabled: boolean;
  playerName: string;
  roomName: string;
  onChangeSettings: (next: GameSettings) => void;
  onSelectChar: (id: CharacterId) => void;
  onChangeOnline: (enabled: boolean, name: string, room: string) => void;
  onStartGame: () => void;
}

type MenuTab = 'play' | 'options' | 'controls';

export const StartScreen: React.FC<StartScreenProps> = ({
  settings,
  selectedChar,
  onlineEnabled,
  playerName,
  roomName,
  onChangeSettings,
  onSelectChar,
  onChangeOnline,
  onStartGame,
}) => {
  const [tab, setTab] = useState<MenuTab>('play');
  const [heroLoaded, setHeroLoaded] = useState(true);
  const [onlineStats, setOnlineStats] = useState<{ totalPlayers: number; activeRooms: { name: string; players: number }[] }>({
    totalPlayers: 0,
    activeRooms: [],
  });

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const res = await fetch('/api/online-stats');
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.totalPlayers === 'number') {
          setOnlineStats(data);
        }
      } catch {
        // Offline or dev server restarting
      }
    };
    loadStats();
    const timer = window.setInterval(loadStats, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#080c14] via-[#13192b] to-[#26140f] text-white overflow-y-auto safe-pt safe-pb">
      {/* User-selected Golden Hour Los Solis Key Art */}
      {heroLoaded && (
        <img
          src="/assets/aistudio/Immagine_WebP_6cc91631.webp"
          alt="GTA V Los Solis"
          referrerPolicy="no-referrer"
          onError={() => setHeroLoaded(false)}
          className="fixed inset-0 h-full w-full object-cover opacity-80 pointer-events-none select-none"
        />
      )}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,9,15,0.72) 0%, rgba(8,12,20,0.42) 45%, rgba(6,9,15,0.88) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-between p-4 sm:p-8 gap-5">
        {/* TOP BRANDING BAR: Authentic GTA V + LOS SOLIS Title */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/15 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center rounded-xl bg-[#090d14] border-2 border-emerald-400 px-3.5 py-2 shadow-2xl">
              <span className="font-display text-3xl sm:text-4xl font-black italic tracking-tight text-white">
                GTA
              </span>
              <span className="ml-1.5 rounded bg-emerald-500 px-2 py-0.5 font-display text-2xl sm:text-3xl font-black text-slate-950">
                V
              </span>
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-wider text-white leading-none">
                LOS SOLIS
              </h1>
              <p className="text-xs sm:text-sm font-medium text-amber-300 mt-1">
                Metropoli 3D Open World · Storia & Online Multigiocatore
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2 self-start sm:self-end">
            <button
              onClick={() => setTab('play')}
              className={`flex items-center gap-1.5 rounded-xl px-4 min-h-[44px] text-xs font-extrabold uppercase tracking-wide border transition-colors ${
                tab === 'play'
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'bg-[#0c111a]/90 border-white/15 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>Gioca</span>
            </button>
            <button
              onClick={() => setTab('options')}
              className={`flex items-center gap-1.5 rounded-xl px-4 min-h-[44px] text-xs font-extrabold uppercase tracking-wide border transition-colors ${
                tab === 'options'
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'bg-[#0c111a]/90 border-white/15 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Opzioni</span>
            </button>
            <button
              onClick={() => setTab('controls')}
              className={`flex items-center gap-1.5 rounded-xl px-4 min-h-[44px] text-xs font-extrabold uppercase tracking-wide border transition-colors ${
                tab === 'controls'
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'bg-[#0c111a]/90 border-white/15 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Comandi</span>
            </button>
          </nav>
        </header>

        {/* CENTER CONTENT PANEL */}
        <main className="flex-1 flex flex-col justify-center">
          {tab === 'play' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Mode Selector: Story vs GTA Online */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <button
                  onClick={() => onChangeOnline(false, playerName, roomName)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    !onlineEnabled
                      ? 'bg-[#0d1420]/95 border-amber-400 shadow-2xl'
                      : 'bg-[#0a0e16]/85 border-white/15 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <User className="w-5 h-5 text-amber-400" />
                      <span className="font-display text-xl font-extrabold uppercase tracking-wide">
                        Modalità Storia
                      </span>
                    </div>
                    {!onlineEnabled && (
                      <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                        ATTIVA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    Esplora Los Solis in singolo, completa missioni, scala i 5 livelli ricercato e cambia tra 3 protagonisti.
                  </p>
                </button>

                <button
                  onClick={() => onChangeOnline(true, playerName, roomName)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    onlineEnabled
                      ? 'bg-[#0d1624]/95 border-sky-400 shadow-2xl'
                      : 'bg-[#0a0e16]/85 border-white/15 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-5 h-5 text-sky-400" />
                      <span className="font-display text-xl font-extrabold uppercase tracking-wide text-sky-300">
                        GTA Online
                      </span>
                    </div>
                    <span className="rounded bg-sky-500/20 border border-sky-400/50 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                      {onlineStats.totalPlayers} online
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    Gioca in tempo reale con altri giocatori nella stessa stanza: auto condivise, sparatorie e chat dal vivo!
                  </p>
                </button>

                {onlineEnabled && (
                  <div className="rounded-2xl bg-[#0b111c]/95 border border-sky-400/35 p-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Il tuo Nickname
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        maxLength={18}
                        onChange={(e) => onChangeOnline(true, e.target.value, roomName)}
                        placeholder="Es. Marco_IT"
                        className="w-full rounded-xl bg-[#141c2b] border border-white/15 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Codice Stanza (condividilo con gli amici)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={roomName}
                          maxLength={16}
                          onChange={(e) => onChangeOnline(true, playerName, e.target.value.toUpperCase())}
                          placeholder="PUBBLICA"
                          className="flex-1 rounded-xl bg-[#141c2b] border border-white/15 px-3 py-2.5 text-sm font-mono-hud font-bold uppercase text-sky-300 outline-none focus:border-sky-400"
                        />
                        {['PUBBLICA', 'ITALIA', 'DRIFT'].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => onChangeOnline(true, playerName, preset)}
                            className={`rounded-xl px-2.5 text-[10px] font-bold border ${
                              roomName === preset
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : 'bg-[#141c2b] text-slate-300 border-white/10'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Character Picker + Launch CTA */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-[#0b1019]/94 border border-white/15 p-4 sm:p-5 gap-4">
                <div>
                  <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
                    Scegli Protagonista Iniziale
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ogni personaggio ha abilità speciale e punto di partenza dedicati a Los Solis.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                    {(Object.keys(CHARACTERS) as CharacterId[]).map((cid) => {
                      const c = CHARACTERS[cid];
                      const active = selectedChar === cid;
                      return (
                        <button
                          key={cid}
                          onClick={() => onSelectChar(cid)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            active
                              ? 'bg-[#151e2e] border-white shadow-lg'
                              : 'bg-[#0f1520] border-white/10 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-display text-lg font-extrabold text-white">{c.name}</span>
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: c.accentColor }}
                            />
                          </div>
                          <div className="text-[11px] font-semibold text-slate-300">{c.role}</div>
                          <div className="mt-2 rounded bg-black/35 px-2 py-1 text-[10px] text-amber-300 font-semibold">
                            {c.specialName}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Summary & Launch Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <div>
                      Grafica: <strong className="text-white uppercase">{settings.graphicsQuality}</strong> · Ora:{' '}
                      <strong className="text-amber-300 uppercase">{settings.timeOfDay}</strong>
                    </div>
                    <div>
                      Mappa: <strong className="text-emerald-400">9×9 Metropoli</strong> · Polizia:{' '}
                      <strong className="text-white uppercase">{settings.policeDifficulty}</strong>
                    </div>
                  </div>

                  <button
                    onClick={onStartGame}
                    className={`flex items-center justify-center gap-2.5 rounded-xl px-7 min-h-[54px] font-display text-xl font-black uppercase tracking-wider shadow-2xl active:scale-95 transition-transform ${
                      onlineEnabled
                        ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                        : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                    }`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{onlineEnabled ? 'ENTRA ONLINE' : 'AVVIA GIOCO'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'options' && (
            <div className="rounded-2xl bg-[#0b1019]/95 border border-white/15 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Graphics & World */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-display text-lg font-extrabold uppercase">
                  <Car className="w-4 h-4" />
                  <span>Grafica e Mondo</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Qualità Grafica 3D</label>
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
                            : 'bg-[#131a26] text-slate-200 border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Ora del Giorno</label>
                  <div className="grid grid-cols-4 gap-1.5">
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
                        className={`rounded-xl min-h-[42px] text-xs font-bold border ${
                          settings.timeOfDay === tod
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-[#131a26] text-slate-200 border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Densità Traffico</label>
                  <div className="grid grid-cols-3 gap-2">
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
                        className={`rounded-xl min-h-[42px] text-xs font-bold border ${
                          settings.trafficDensity === td
                            ? 'bg-sky-400 text-slate-950 border-sky-300'
                            : 'bg-[#131a26] text-slate-200 border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Difficoltà Polizia</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['relaxed', 'Rilassata'],
                        ['normal', 'Normale'],
                        ['hardcore', 'Estrema'],
                      ] as [PoliceDifficulty, string][]
                    ).map(([pd, label]) => (
                      <button
                        key={pd}
                        onClick={() => update('policeDifficulty', pd)}
                        className={`rounded-xl min-h-[42px] text-xs font-bold border ${
                          settings.policeDifficulty === pd
                            ? 'bg-rose-500 text-white border-rose-300'
                            : 'bg-[#131a26] text-slate-200 border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audio, Camera & Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-display text-lg font-extrabold uppercase">
                  <Volume2 className="w-4 h-4" />
                  <span>Audio, Visuale e Comandi</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                    <span>Sensibilità Camera</span>
                    <span className="text-amber-300">{settings.cameraSensitivity.toFixed(1)}x</span>
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
                    <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Effetti SFX</span>
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
                    <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Volume Radio</span>
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

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => update('autoAim', !settings.autoAim)}
                    className={`rounded-xl px-3 min-h-[44px] text-xs font-bold border ${
                      settings.autoAim
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-[#131a26] border-white/10 text-slate-400'
                    }`}
                  >
                    Mira Assistita: {settings.autoAim ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => update('muted', !settings.muted)}
                    className={`rounded-xl px-3 min-h-[44px] text-xs font-bold border ${
                      settings.muted
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-[#131a26] border-white/10 text-slate-200'
                    }`}
                  >
                    Audio Muto: {settings.muted ? 'SÌ' : 'NO'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Radio Predefinita</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RADIO_STATIONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => update('defaultRadio', r.id as RadioStationId)}
                        className={`rounded-xl min-h-[38px] px-2 text-xs font-bold border truncate ${
                          settings.defaultRadio === r.id
                            ? 'bg-sky-500/25 border-sky-400 text-white'
                            : 'bg-[#131a26] border-white/10 text-slate-300'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Pulsanti Touch su Schermo</label>
                  <div className="grid grid-cols-3 gap-2">
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
                        className={`rounded-xl min-h-[40px] text-xs font-bold border ${
                          settings.touchControls === tm
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-[#131a26] text-slate-200 border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end pt-2 border-t border-white/10">
                <button
                  onClick={onStartGame}
                  className="flex items-center gap-2 rounded-xl bg-emerald-400 px-6 min-h-[48px] font-display text-lg font-black uppercase text-slate-950 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Salva e Avvia Partita</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'controls' && (
            <div className="rounded-2xl bg-[#0b1019]/95 border border-white/15 p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sky-400 font-display text-xl font-extrabold uppercase">
                <Shield className="w-5 h-5" />
                <span>Guida Comandi (Mobile & PC)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {[
                  ['Movimento / Guida', 'Joystick Sinistro o WASD / Frecce'],
                  ['Spara / Colpisci', 'Pulsante Rosso o Tasto G'],
                  ['Schiva Proiettili', 'Pulsante SCHIVA o Tasto Q (capriola evasiva)'],
                  ['Entra / Esci Auto', 'Pulsante Giallo o Tasto F'],
                  ['Mappa GPS Completa', 'Tocca la Minimappa o Tasto M'],
                  ['Ruota Armi / Eroi', 'Icone a destra o Tasti TAB / C'],
                  ['Abilità Speciale', 'Fulmine Giallo o Tasto Z'],
                  ['SolisPhone / Radio', 'Icona Telefono o Tasti P / R'],
                  ['Menu Opzioni Pausa', 'Icona Ingranaggio o Tasto ESC'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-xl bg-[#121926] border border-white/10 p-3">
                    <div className="font-bold text-amber-300">{title}</div>
                    <div className="text-slate-300 mt-1">{desc}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onStartGame}
                  className="flex items-center gap-2 rounded-xl bg-emerald-400 px-6 min-h-[48px] font-display text-lg font-black uppercase text-slate-950 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Inizia Ora</span>
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center text-[11px] text-slate-400">
          Los Solis V · Edizione 3D Realistica · Supporto Mobile Touch & WebSockets Online
        </footer>
      </div>
    </div>
  );
};

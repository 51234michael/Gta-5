import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { soundManager } from './game/audio';
import { InputState, LosSolisEngine } from './game/engine';
import {
  CharacterId,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  HudSnapshot,
  OnlineChatMessage,
  RADIO_STATIONS,
  RadioStationId,
} from './game/types';
import { WalkInStore } from './game/stores';
import { GTAHud } from './components/GTAHud';
import { MobileControls } from './components/MobileControls';
import { WeaponWheel } from './components/WeaponWheel';
import { CharacterWheel } from './components/CharacterWheel';
import { SolisPhone } from './components/SolisPhone';
import { FullMapModal } from './components/FullMapModal';
import { StartScreen } from './components/StartScreen';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { StoreModal } from './components/StoreModal';

const INITIAL_HUD: HudSnapshot = {
  characterId: 'marco',
  health: 100,
  maxHealth: 100,
  armor: 50,
  maxArmor: 100,
  special: 100,
  specialActive: false,
  damageFlash: 0,
  isDead: false,
  isDodging: false,
  dodgeCooldown: 0,
  cash: 5400,
  cashDelta: 0,
  wantedLevel: 0,
  wantedCooldown: 0,
  policeSpotted: false,
  weaponId: 'pistol',
  ammo: { fists: 0, pistol: 24, smg: 30, shotgun: 6, rifle: 20, grenade: 2 },
  inVehicle: false,
  vehicleName: '',
  vehicleType: null,
  vehicleHealth: 100,
  speedKmh: 0,
  sirenOn: false,
  radioStation: 'los_solis',
  district: 'Centro Finanziario',
  gameTimeStr: '17:25',
  timeOfDay: 'sunset',
  playerX: -12,
  playerZ: 24,
  playerHeading: 0,
  cameraHeading: Math.PI,
  nearVehicleName: null,
  nearZone: null,
  insideStoreId: null,
  activeMission: null,
  completedMissions: [],
  ownedProperties: [],
  waypoint: null,
  blips: [],
  onlineMode: false,
  onlineConnected: false,
  onlineRoom: 'PUBBLICA',
  onlinePlayersCount: 0,
  statusBanner: null,
  toastText: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<LosSolisEngine | null>(null);
  const inputProxyRef = useRef<InputState>({
    joyX: 0,
    joyY: 0,
    sprint: false,
    firing: false,
    aiming: false,
    gas: false,
    brake: false,
    handbrake: false,
  });

  const [gameStarted, setGameStarted] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [selectedStartChar, setSelectedStartChar] = useState<CharacterId>('marco');
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [playerName, setPlayerName] = useState('Giocatore');
  const [roomName, setRoomName] = useState('PUBBLICA');

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [weaponWheelOpen, setWeaponWheelOpen] = useState(false);
  const [charWheelOpen, setCharWheelOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [activeStore, setActiveStore] = useState<WalkInStore | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<OnlineChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [contextLost, setContextLost] = useState(false);
  const [showDesktopHelp, setShowDesktopHelp] = useState(true);
  const [hudHidden, setHudHidden] = useState(false);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new LosSolisEngine(
      container,
      (snap) => {
        setHud(snap);
      },
      (chatMsg) => {
        setChatMessages((prev) => [...prev.slice(-24), chatMsg]);
      },
      (store) => {
        soundManager.unlock();
        setWeaponWheelOpen(false);
        setCharWheelOpen(false);
        setPhoneOpen(false);
        setFullMapOpen(false);
        setPauseOpen(false);
        setActiveStore(store);
      }
    );
    engine.input = inputProxyRef.current;
    engineRef.current = engine;

    const canvas = container.querySelector('canvas');
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    canvas?.addEventListener('webglcontextlost', onLost);
    canvas?.addEventListener('webglcontextrestored', onRestored);

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Tab') {
        e.preventDefault();
        setWeaponWheelOpen((v) => !v);
        setCharWheelOpen(false);
        setPhoneOpen(false);
        setFullMapOpen(false);
        setPauseOpen(false);
      } else if (e.code === 'KeyC') {
        setCharWheelOpen((v) => !v);
        setWeaponWheelOpen(false);
        setPhoneOpen(false);
        setFullMapOpen(false);
        setPauseOpen(false);
      } else if (e.code === 'KeyP') {
        setPhoneOpen((v) => !v);
        setWeaponWheelOpen(false);
        setCharWheelOpen(false);
        setFullMapOpen(false);
        setPauseOpen(false);
      } else if (e.code === 'KeyM') {
        setFullMapOpen((v) => !v);
        setWeaponWheelOpen(false);
        setCharWheelOpen(false);
        setPhoneOpen(false);
        setPauseOpen(false);
      } else if (e.code === 'Escape') {
        setWeaponWheelOpen(false);
        setCharWheelOpen(false);
        setPhoneOpen(false);
        setFullMapOpen(false);
        setChatOpen(false);
        setActiveStore((curr) => {
          if (curr) return null;
          setPauseOpen((v) => !v);
          return null;
        });
      } else if (e.code === 'KeyR' && engineRef.current) {
        cycleRadio();
      } else if (e.code === 'KeyG' && engineRef.current) {
        engineRef.current.triggerFireOnce();
      } else if (e.code === 'KeyH') {
        setHudHidden((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      canvas?.removeEventListener('webglcontextlost', onLost);
      canvas?.removeEventListener('webglcontextrestored', onRestored);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync gameStarted menu mode & settings cleanly with engine
  useEffect(() => {
    engineRef.current?.setMenuMode(!gameStarted);
  }, [gameStarted]);

  useEffect(() => {
    engineRef.current?.applySettings(settings);
  }, [settings]);

  // GTA V signature slow-motion when opening Weapon/Character wheel or Full Map / Pause / Store
  useEffect(() => {
    if (!engineRef.current) return;
    if (fullMapOpen || pauseOpen || activeStore) {
      engineRef.current.setTimeScale(0.04);
    } else if (weaponWheelOpen || charWheelOpen) {
      engineRef.current.setTimeScale(0.22);
    } else {
      engineRef.current.setTimeScale(1.0);
    }
  }, [weaponWheelOpen, charWheelOpen, fullMapOpen, pauseOpen, activeStore]);

  const handleStartGame = () => {
    soundManager.unlock();
    if (engineRef.current) {
      if (hud.characterId !== selectedStartChar) {
        engineRef.current.switchCharacter(selectedStartChar);
      }
      engineRef.current.applySettings(settings);
      engineRef.current.setOnlineMode(onlineEnabled, playerName, roomName);
      engineRef.current.setMenuMode(false);
    }
    setPauseOpen(false);
    setGameStarted(true);
  };

  const handleToggleOnlineInPause = () => {
    const next = !onlineEnabled;
    setOnlineEnabled(next);
    engineRef.current?.setOnlineMode(next, playerName, roomName);
  };

  const handleReturnToTitle = () => {
    setPauseOpen(false);
    setChatOpen(false);
    engineRef.current?.setOnlineMode(false, playerName, roomName);
    setGameStarted(false);
  };

  const cycleRadio = () => {
    if (!engineRef.current) return;
    const ids: RadioStationId[] = RADIO_STATIONS.map((r) => r.id);
    const idx = ids.indexOf(hud.radioStation);
    const next = ids[(idx + 1) % ids.length];
    engineRef.current.setRadioStation(next);
  };

  const toggleMute = () => {
    soundManager.unlock();
    const next = !settings.muted;
    setSettings((prev) => ({ ...prev, muted: next }));
  };

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatDraft.trim();
    if (!clean) return;
    engineRef.current?.sendOnlineChat(clean);
    setChatDraft('');
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090c10]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090c10] text-center p-6">
          <h2 className="font-display text-3xl font-bold text-amber-400">Ripristino Grafica 3D</h2>
          <p className="text-sm text-slate-300 mt-2">Il contesto WebGL è stato sospeso e si sta ricaricando...</p>
        </div>
      )}

      {/* PRE-GAME GTA V TITLE & OPTIONS SCREEN */}
      {!gameStarted && (
        <StartScreen
          settings={settings}
          selectedChar={selectedStartChar}
          onlineEnabled={onlineEnabled}
          playerName={playerName}
          roomName={roomName}
          onChangeSettings={setSettings}
          onSelectChar={setSelectedStartChar}
          onChangeOnline={(en, nm, rm) => {
            setOnlineEnabled(en);
            setPlayerName(nm);
            setRoomName(rm);
          }}
          onStartGame={handleStartGame}
        />
      )}

      {gameStarted && (
        <>
          {!hudHidden && (
            <>
              <MobileControls
                hud={hud}
                touchMode={settings.touchControls}
                inputRef={inputProxyRef}
                onOrbitCamera={(dx, dy) => engineRef.current?.orbitCamera(dx, dy)}
                onEnterExitCar={() => engineRef.current?.toggleEnterExitVehicle()}
                onJumpOrHorn={() => engineRef.current?.triggerJumpOrHorn()}
                onDodge={() => engineRef.current?.triggerDodge()}
                onSpecial={() => engineRef.current?.toggleSpecialAbility()}
                onOpenWeapons={() => {
                  soundManager.unlock();
                  setWeaponWheelOpen(true);
                }}
                onOpenCharacters={() => {
                  soundManager.unlock();
                  setCharWheelOpen(true);
                }}
                onOpenPhone={() => {
                  soundManager.unlock();
                  setPhoneOpen(true);
                }}
                onCycleCamera={() => engineRef.current?.cycleCameraDistance()}
              />

              <GTAHud
                hud={hud}
                muted={settings.muted}
                onToggleMute={toggleMute}
                onCycleRadio={cycleRadio}
                onInteractZone={() => engineRef.current?.interactWithNearbyZone()}
                onCancelMission={() => engineRef.current?.cancelMission()}
                onOpenFullMap={() => {
                  soundManager.unlock();
                  setFullMapOpen(true);
                }}
                onOpenPause={() => {
                  soundManager.unlock();
                  setPauseOpen(true);
                }}
                onOpenChat={() => setChatOpen((v) => !v)}
              />
            </>
          )}

          {/* Online Quick Chat Panel */}
          {chatOpen && hud.onlineMode && (
            <div className="pointer-events-auto fixed top-20 left-2.5 sm:left-4 z-30 w-72 sm:w-80 rounded-xl bg-[#0a0e16]/94 border border-sky-400/40 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#070a10] border-b border-white/10">
                <span className="text-xs font-extrabold uppercase tracking-wide text-sky-300">
                  Chat Stanza · {hud.onlineRoom}
                </span>
                <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto p-2.5 space-y-1.5 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-500 text-[11px]">Nessun messaggio ancora. Scrivi agli altri giocatori!</div>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="leading-snug">
                      <span className="font-bold text-amber-300">{m.senderName}: </span>
                      <span className="text-slate-100">{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={submitChat} className="flex items-center gap-1.5 p-2 border-t border-white/10 bg-[#080b10]">
                <input
                  type="text"
                  value={chatDraft}
                  maxLength={100}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 rounded-lg bg-[#141a26] border border-white/15 px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  aria-label="Invia messaggio"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400 text-slate-950 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {showDesktopHelp && !hudHidden && (
            <div className="pointer-events-auto hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-20 items-center gap-2.5 rounded-lg bg-[#0a0d12]/85 border border-white/10 px-3.5 py-1.5 text-[11px] text-slate-300">
              <span>WASD Muovi/Guida</span>
              <span className="text-white/25">·</span>
              <span>Q Schiva</span>
              <span className="text-white/25">·</span>
              <span>F Auto</span>
              <span className="text-white/25">·</span>
              <span>G Spara</span>
              <span className="text-white/25">·</span>
              <span>H Nascondi HUD</span>
              <span className="text-white/25">·</span>
              <span>Tab Armi</span>
              <span className="text-white/25">·</span>
              <span>M Mappa</span>
              <span className="text-white/25">·</span>
              <span>Esc Opzioni</span>
              <button
                onClick={() => setShowDesktopHelp(false)}
                className="ml-1 text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {weaponWheelOpen && (
            <WeaponWheel
              currentWeapon={hud.weaponId}
              ammo={hud.ammo}
              onSelect={(id) => engineRef.current?.selectWeapon(id)}
              onClose={() => setWeaponWheelOpen(false)}
            />
          )}

          {charWheelOpen && (
            <CharacterWheel
              currentId={hud.characterId}
              onSelect={(id) => engineRef.current?.switchCharacter(id)}
              onClose={() => setCharWheelOpen(false)}
            />
          )}

          {fullMapOpen && (
            <FullMapModal
              hud={hud}
              onClose={() => setFullMapOpen(false)}
              onSetWaypoint={(x, z) => engineRef.current?.setWaypoint(x, z)}
              onFastTravel={(x, z, label) => engineRef.current?.fastTravelTo(x, z, label)}
            />
          )}

          {phoneOpen && (
            <SolisPhone
              hud={hud}
              onlineMessages={chatMessages}
              onClose={() => setPhoneOpen(false)}
              onStartMission={(id) => engineRef.current?.startMission(id)}
              onSetWaypoint={(x, z) => engineRef.current?.setWaypoint(x, z)}
              onCallMechanic={(specId) => engineRef.current?.callMechanic(specId)}
              onBuyAmmo={(wid) => engineRef.current?.buyWeaponOrAmmo(wid)}
              onBuyArmor={() => engineRef.current?.buyArmorAndHeal()}
              onSetTimeOfDay={(tod) => setSettings((prev) => ({ ...prev, timeOfDay: tod }))}
              onSetRadio={(st) => engineRef.current?.setRadioStation(st)}
              onQuickRepairClear={() => engineRef.current?.repairAndClearWanted()}
              onSendOnlineChat={(text) => engineRef.current?.sendOnlineChat(text)}
              onFastTravel={(x, z, label) => engineRef.current?.fastTravelTo(x, z, label)}
              onOpenFullSettings={() => {
                setPhoneOpen(false);
                setPauseOpen(true);
              }}
            />
          )}

          {pauseOpen && (
            <PauseSettingsModal
              settings={settings}
              onlineEnabled={onlineEnabled}
              roomName={roomName}
              onChangeSettings={setSettings}
              onToggleOnline={handleToggleOnlineInPause}
              onReturnToTitle={handleReturnToTitle}
              onClose={() => setPauseOpen(false)}
            />
          )}

          {activeStore && (
            <StoreModal
              store={activeStore}
              hud={hud}
              onClose={() => setActiveStore(null)}
              onBuySnack={(h, sp, pr, lbl) => engineRef.current?.buyStoreSnack(h, sp, pr, lbl)}
              onBuyWeapon={(wid) => engineRef.current?.buyWeaponOrAmmo(wid)}
              onBuyArmor={() => engineRef.current?.buyArmorAndHeal()}
              onCustomizeStyle={(opts, pr, lbl) => engineRef.current?.customizeCharacterStyle(opts, pr, lbl)}
              onCustomizeLsc={(opts, pr, lbl) => engineRef.current?.customizeVehicleAtLsc(opts, pr, lbl)}
              onRobStore={(id, name) => engineRef.current?.robStore(id, name)}
            />
          )}
        </>
      )}
    </div>
  );
}

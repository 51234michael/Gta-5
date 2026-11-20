import { CharacterId, OnlineChatMessage, OnlinePlayerState, WeaponId } from './types';

export interface MultiplayerShotEvent {
  senderId: string;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  targetPlayerId: string | null;
  damage: number;
}

export interface MultiplayerCallbacks {
  onConnectionChange: (connected: boolean, selfId: string | null, room: string) => void;
  onPlayersSnapshot: (players: OnlinePlayerState[]) => void;
  onPlayerLeft: (id: string) => void;
  onChatMessage: (msg: OnlineChatMessage) => void;
  onCombatShot: (ev: MultiplayerShotEvent) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private selfId: string | null = null;
  private room = 'PUBBLICA';
  private playerName = 'Giocatore';
  private characterId: CharacterId = 'marco';
  private shouldStayConnected = false;
  private reconnectTimer: number | null = null;
  private lastSendAt = 0;
  private callbacks: MultiplayerCallbacks;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public getSelfId(): string | null {
    return this.selfId;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(
    playerName: string,
    characterId: CharacterId,
    room: string,
    initialPos: { x: number; y: number; z: number; heading: number }
  ) {
    this.playerName = playerName.trim() || 'Giocatore';
    this.characterId = characterId;
    this.room = room.trim().toUpperCase() || 'PUBBLICA';
    this.shouldStayConnected = true;

    this.clearReconnect();
    this.closeSocketOnly();

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const sock = new WebSocket(url);
    this.ws = sock;

    sock.onopen = () => {
      sock.send(
        JSON.stringify({
          type: 'join',
          name: this.playerName,
          characterId: this.characterId,
          room: this.room,
          x: initialPos.x,
          y: initialPos.y,
          z: initialPos.z,
          heading: initialPos.heading,
        })
      );
    };

    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'welcome') {
          this.selfId = typeof msg.selfId === 'string' ? msg.selfId : null;
          this.room = typeof msg.room === 'string' ? msg.room : this.room;
          this.callbacks.onConnectionChange(true, this.selfId, this.room);
          if (Array.isArray(msg.players)) {
            this.callbacks.onPlayersSnapshot(msg.players);
          }
        } else if (msg.type === 'players:snapshot' && Array.isArray(msg.players)) {
          this.callbacks.onPlayersSnapshot(msg.players);
        } else if (msg.type === 'player:left' && typeof msg.id === 'string') {
          this.callbacks.onPlayerLeft(msg.id);
        } else if (msg.type === 'chat:message' && msg.message) {
          this.callbacks.onChatMessage(msg.message);
        } else if (msg.type === 'combat:shot') {
          this.callbacks.onCombatShot(msg as MultiplayerShotEvent);
        }
      } catch {
        // Ignore malformed packets
      }
    };

    sock.onclose = () => {
      this.callbacks.onConnectionChange(false, this.selfId, this.room);
      if (this.shouldStayConnected) {
        this.clearReconnect();
        this.reconnectTimer = window.setTimeout(() => {
          if (this.shouldStayConnected) {
            this.connect(this.playerName, this.characterId, this.room, initialPos);
          }
        }, 2500);
      }
    };

    sock.onerror = () => {
      // onclose handles reconnection cleanly
    };
  }

  public sendState(state: {
    characterId: CharacterId;
    x: number;
    y: number;
    z: number;
    heading: number;
    inVehicle: boolean;
    vehicleSpecId: string | null;
    sirenOn: boolean;
    weaponId: WeaponId;
    health: number;
    wantedLevel: number;
    isDodging: boolean;
  }) {
    if (!this.isConnected()) return;
    const now = performance.now();
    if (now - this.lastSendAt < 48) return; // ~20Hz
    this.lastSendAt = now;
    this.ws!.send(
      JSON.stringify({
        type: 'state',
        ...state,
      })
    );
  }

  public sendChat(text: string) {
    if (!this.isConnected()) return;
    const clean = text.trim();
    if (!clean) return;
    this.ws!.send(JSON.stringify({ type: 'chat', text: clean }));
  }

  public sendShot(shot: Omit<MultiplayerShotEvent, 'senderId'>) {
    if (!this.isConnected()) return;
    this.ws!.send(
      JSON.stringify({
        type: 'shot',
        ...shot,
      })
    );
  }

  public disconnect() {
    this.shouldStayConnected = false;
    this.clearReconnect();
    this.closeSocketOnly();
    this.selfId = null;
    this.callbacks.onConnectionChange(false, null, this.room);
  }

  private clearReconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocketOnly() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPlayerState {
  id: string;
  name: string;
  characterId: 'marco' | 'luca' | 'tiziano';
  x: number;
  y: number;
  z: number;
  heading: number;
  inVehicle: boolean;
  vehicleSpecId: string | null;
  sirenOn: boolean;
  weaponId: string;
  health: number;
  wantedLevel: number;
  isDodging: boolean;
  room: string;
  lastUpdated: number;
}

interface RoomSession {
  players: Map<string, ServerPlayerState>;
  sockets: Map<string, WebSocket>;
}

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json());

const rooms = new Map<string, RoomSession>();
let nextPlayerNum = 1;

function getOrCreateRoom(roomName: string): RoomSession {
  const clean = (roomName || 'PUBBLICA').trim().toUpperCase().slice(0, 24) || 'PUBBLICA';
  let room = rooms.get(clean);
  if (!room) {
    room = { players: new Map(), sockets: new Map() };
    rooms.set(clean, room);
  }
  return room;
}

function broadcastRoom(room: RoomSession, payload: unknown, excludeId?: string) {
  const msg = JSON.stringify(payload);
  for (const [pid, sock] of room.sockets.entries()) {
    if (excludeId && pid === excludeId) continue;
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(msg);
    }
  }
}

app.get('/api/online-stats', (_req, res) => {
  let totalPlayers = 0;
  const activeRooms: { name: string; players: number }[] = [];
  for (const [name, room] of rooms.entries()) {
    if (room.players.size > 0) {
      totalPlayers += room.players.size;
      activeRooms.push({ name, players: room.players.size });
    }
  }
  res.json({ totalPlayers, activeRooms });
});

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const playerId = `p_${Date.now().toString(36)}_${nextPlayerNum++}`;
    let currentRoomKey = 'PUBBLICA';

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'join') {
          const prevRoom = rooms.get(currentRoomKey);
          if (prevRoom && prevRoom.players.has(playerId)) {
            prevRoom.players.delete(playerId);
            prevRoom.sockets.delete(playerId);
            broadcastRoom(prevRoom, { type: 'player:left', id: playerId });
            if (prevRoom.players.size === 0) rooms.delete(currentRoomKey);
          }

          currentRoomKey = String(msg.room || 'PUBBLICA').trim().toUpperCase().slice(0, 24) || 'PUBBLICA';
          const room = getOrCreateRoom(currentRoomKey);
          const safeChar =
            msg.characterId === 'luca' || msg.characterId === 'tiziano' ? msg.characterId : 'marco';

          const state: ServerPlayerState = {
            id: playerId,
            name: String(msg.name || `Giocatore ${nextPlayerNum}`).trim().slice(0, 20) || 'Giocatore',
            characterId: safeChar,
            x: Number.isFinite(msg.x) ? Number(msg.x) : -12,
            y: Number.isFinite(msg.y) ? Number(msg.y) : 0,
            z: Number.isFinite(msg.z) ? Number(msg.z) : 24,
            heading: Number.isFinite(msg.heading) ? Number(msg.heading) : 0,
            inVehicle: Boolean(msg.inVehicle),
            vehicleSpecId: typeof msg.vehicleSpecId === 'string' ? msg.vehicleSpecId : null,
            sirenOn: Boolean(msg.sirenOn),
            weaponId: typeof msg.weaponId === 'string' ? msg.weaponId : 'pistol',
            health: 100,
            wantedLevel: 0,
            isDodging: false,
            room: currentRoomKey,
            lastUpdated: Date.now(),
          };

          room.players.set(playerId, state);
          room.sockets.set(playerId, ws);

          ws.send(
            JSON.stringify({
              type: 'welcome',
              selfId: playerId,
              room: currentRoomKey,
              players: Array.from(room.players.values()),
            })
          );

          broadcastRoom(room, { type: 'player:joined', player: state }, playerId);
        } else if (msg.type === 'state') {
          const room = rooms.get(currentRoomKey);
          const p = room?.players.get(playerId);
          if (!room || !p) return;

          p.characterId =
            msg.characterId === 'luca' || msg.characterId === 'tiziano' ? msg.characterId : p.characterId;
          if (Number.isFinite(msg.x)) p.x = Math.max(-700, Math.min(700, Number(msg.x)));
          if (Number.isFinite(msg.y)) p.y = Math.max(-10, Math.min(180, Number(msg.y)));
          if (Number.isFinite(msg.z)) p.z = Math.max(-700, Math.min(750, Number(msg.z)));
          if (Number.isFinite(msg.heading)) p.heading = Number(msg.heading);
          p.inVehicle = Boolean(msg.inVehicle);
          p.vehicleSpecId = typeof msg.vehicleSpecId === 'string' ? msg.vehicleSpecId : null;
          p.sirenOn = Boolean(msg.sirenOn);
          if (typeof msg.weaponId === 'string') p.weaponId = msg.weaponId;
          if (Number.isFinite(msg.health)) p.health = Math.max(0, Math.min(100, Number(msg.health)));
          if (Number.isFinite(msg.wantedLevel)) p.wantedLevel = Math.max(0, Math.min(5, Number(msg.wantedLevel)));
          p.isDodging = Boolean(msg.isDodging);
          p.lastUpdated = Date.now();
        } else if (msg.type === 'chat') {
          const room = rooms.get(currentRoomKey);
          const p = room?.players.get(playerId);
          if (!room || !p) return;
          const text = String(msg.text || '').trim().slice(0, 120);
          if (!text) return;
          broadcastRoom(room, {
            type: 'chat:message',
            message: {
              id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
              senderId: playerId,
              senderName: p.name,
              text,
              timestamp: Date.now(),
            },
          });
        } else if (msg.type === 'shot') {
          const room = rooms.get(currentRoomKey);
          if (!room) return;
          broadcastRoom(
            room,
            {
              type: 'combat:shot',
              senderId: playerId,
              fromX: Number(msg.fromX) || 0,
              fromY: Number(msg.fromY) || 1.3,
              fromZ: Number(msg.fromZ) || 0,
              toX: Number(msg.toX) || 0,
              toY: Number(msg.toY) || 1.3,
              toZ: Number(msg.toZ) || 0,
              targetPlayerId: typeof msg.targetPlayerId === 'string' ? msg.targetPlayerId : null,
              damage: Number(msg.damage) || 0,
            },
            playerId
          );
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    ws.on('close', () => {
      const room = rooms.get(currentRoomKey);
      if (room && room.players.has(playerId)) {
        room.players.delete(playerId);
        room.sockets.delete(playerId);
        broadcastRoom(room, { type: 'player:left', id: playerId });
        if (room.players.size === 0) {
          rooms.delete(currentRoomKey);
        }
      }
    });
  });

  // Authoritative 20Hz room state broadcast
  setInterval(() => {
    const now = Date.now();
    for (const [key, room] of rooms.entries()) {
      for (const [pid, p] of room.players.entries()) {
        if (now - p.lastUpdated > 45000) {
          room.players.delete(pid);
          room.sockets.delete(pid);
          broadcastRoom(room, { type: 'player:left', id: pid });
        }
      }
      if (room.players.size === 0) {
        rooms.delete(key);
        continue;
      }
      broadcastRoom(room, {
        type: 'players:snapshot',
        players: Array.from(room.players.values()),
      });
    }
  }, 50);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Los Solis V server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

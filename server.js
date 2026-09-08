import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Active rooms map: roomCode -> { code, hostId, players: Map<socketId, Player>, isStarted: false }
  const rooms = new Map();

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'RC';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  io.on('connection', (socket) => {
    let currentRoomCode = null;

    // 1. Create Room
    socket.on('create_room', ({ playerName, playerColor }, callback) => {
      let roomCode = generateRoomCode();
      while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
      }

      const player = {
        socketId: socket.id,
        name: playerName || 'Anfitrión',
        color: playerColor || '#00f3ff',
        lane: 0,
        progress: 0,
        wpm: 0,
        isHost: true,
        finished: false
      };

      const room = {
        code: roomCode,
        hostId: socket.id,
        players: new Map([[socket.id, player]]),
        isStarted: false
      };

      rooms.set(roomCode, room);
      currentRoomCode = roomCode;
      socket.join(roomCode);

      if (typeof callback === 'function') {
        callback({
          success: true,
          roomCode,
          player,
          players: Array.from(room.players.values())
        });
      }
    });

    // 2. Join Room with strict validations (duplicate clicks, capacity max 4, already in room)
    socket.on('join_room', ({ roomCode, playerName, playerColor }, callback) => {
      if (typeof callback !== 'function') callback = () => {};

      if (!roomCode) {
        return callback({
          success: false,
          error: 'CÓDIGO INVÁLIDO',
          message: 'Por favor ingresa un código de sala.'
        });
      }

      const code = roomCode.toUpperCase().trim();
      const room = rooms.get(code);

      // Validation A: Room exists
      if (!room) {
        return callback({
          success: false,
          error: 'LA SALA NO EXISTE',
          message: `La sala "${code}" no existe o ya fue cerrada.`
        });
      }

      // Validation B: Client socket is already joined in room
      if (room.players.has(socket.id)) {
        return callback({
          success: false,
          error: 'YA ESTÁS EN LA SALA',
          message: 'Ya estás dentro de esta sala.'
        });
      }

      // Validation C: Room capacity limit (MAX 4 PLAYERS)
      if (room.players.size >= 4) {
        return callback({
          success: false,
          error: 'SALA LLENA',
          message: `¡SALA LLENA! La sala "${code}" ha alcanzado el límite máximo de 4 pilotos.`
        });
      }

      // Validation D: Race already in progress
      if (room.isStarted) {
        return callback({
          success: false,
          error: 'CARRERA EN CURSO',
          message: 'La carrera en esta sala ya ha comenzado.'
        });
      }

      // Assign unused lane (0 to 3)
      const takenLanes = new Set(Array.from(room.players.values()).map(p => p.lane));
      let assignedLane = 0;
      for (let l = 0; l < 4; l++) {
        if (!takenLanes.has(l)) {
          assignedLane = l;
          break;
        }
      }

      const player = {
        socketId: socket.id,
        name: playerName || 'Piloto',
        color: playerColor || '#ff0055',
        lane: assignedLane,
        progress: 0,
        wpm: 0,
        isHost: false,
        finished: false
      };

      room.players.set(socket.id, player);
      currentRoomCode = code;
      socket.join(code);

      callback({
        success: true,
        roomCode: code,
        player,
        players: Array.from(room.players.values())
      });

      // Broadcast room_state update to ALL sockets in the room
      io.to(code).emit('room_state', {
        players: Array.from(room.players.values())
      });
    });

    // 3. Start Race
    socket.on('start_race', ({ snippetSet }) => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room || room.hostId !== socket.id) return;

      room.isStarted = true;
      io.to(currentRoomCode).emit('race_started', { snippetSet });
    });

    // 4. Player Progress
    socket.on('player_progress', (data) => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const player = room.players.get(socket.id);
      if (player) {
        player.progress = data.progress;
        player.wpm = data.wpm;
      }

      socket.to(currentRoomCode).emit('player_progress', {
        socketId: socket.id,
        progress: data.progress,
        wpm: data.wpm,
        currentBlock: data.currentBlock
      });
    });

    // 5. Player Finished
    socket.on('player_finished', (data) => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const player = room.players.get(socket.id);
      if (player) {
        player.finished = true;
        player.timeMs = data.timeMs;
        player.wpm = data.wpm;
      }

      socket.to(currentRoomCode).emit('player_finished', {
        socketId: socket.id,
        timeMs: data.timeMs,
        wpm: data.wpm
      });
    });

    // 6. Leave / Disconnect
    const handleLeave = () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      room.players.delete(socket.id);
      socket.leave(currentRoomCode);

      if (room.players.size === 0) {
        rooms.delete(currentRoomCode);
      } else {
        if (room.hostId === socket.id) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            room.hostId = nextHost.socketId;
          }
        }
        io.to(currentRoomCode).emit('room_state', {
          players: Array.from(room.players.values())
        });
      }
      currentRoomCode = null;
    };

    socket.on('leave_room', handleLeave);
    socket.on('disconnect', handleLeave);
  });

  // Attach Vite middleware in development mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏎️  Servidor WebSocket CodeRace corriendo en http://0.0.0.0:${PORT}\n`);
  });
}

startServer();

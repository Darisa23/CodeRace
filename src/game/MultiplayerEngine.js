// MultiplayerEngine.js - Handles WebSocket (Socket.IO) client connection & real-time room sync

import { io } from 'socket.io-client';

export class MultiplayerEngine {
  constructor(options = {}) {
    this.onPlayersUpdated = options.onPlayersUpdated || (() => {});
    this.onRaceStarted = options.onRaceStarted || (() => {});
    this.onProgressReceived = options.onProgressReceived || (() => {});
    this.onPlayerFinished = options.onPlayerFinished || (() => {});
    this.onHostLeft = options.onHostLeft || (() => {});

    this.socket = null;
    this.mySocketId = null;
    this.roomCode = null;
    this.isHost = false;

    // Player profiles list in room: socketId -> Player
    this.players = new Map();
    this.localPlayer = null;

    this.initSocket();
  }

  initSocket() {
    // Connect to same origin host
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      this.mySocketId = this.socket.id;
    });

    // Listen for room updates from server
    this.socket.on('room_state', (data) => {
      this.players.clear();
      data.players.forEach(p => {
        // Map socketId to peerId key for compatibility with RaceEngine
        const mappedPlayer = { ...p, peerId: p.socketId };
        this.players.set(p.socketId, mappedPlayer);

        if (p.socketId === this.socket.id) {
          this.localPlayer = mappedPlayer;
          this.isHost = p.isHost;
        }
      });
      this.onPlayersUpdated(Array.from(this.players.values()));
    });

    // Listen for race start broadcast
    this.socket.on('race_started', (data) => {
      this.onRaceStarted(data.snippetSet);
    });

    // Listen for player progress broadcast
    this.socket.on('player_progress', (data) => {
      const pData = this.players.get(data.socketId);
      if (pData) {
        pData.progress = data.progress;
        pData.wpm = data.wpm;
      }
      this.onProgressReceived({
        peerId: data.socketId,
        progress: data.progress,
        wpm: data.wpm,
        currentBlock: data.currentBlock
      });
    });

    // Listen for player finished broadcast
    this.socket.on('player_finished', (data) => {
      const fPlayer = this.players.get(data.socketId);
      if (fPlayer) {
        fPlayer.finished = true;
        fPlayer.timeMs = data.timeMs;
        fPlayer.wpm = data.wpm;
      }
      this.onPlayerFinished({
        peerId: data.socketId,
        timeMs: data.timeMs,
        wpm: data.wpm
      });
    });
  }

  // Create room
  createRoom(playerName, playerColor) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        this.socket.connect();
      }

      this.socket.emit('create_room', { playerName, playerColor }, (response) => {
        if (response && response.success) {
          this.roomCode = response.roomCode;
          this.isHost = true;
          this.mySocketId = this.socket.id;

          this.players.clear();
          response.players.forEach(p => {
            const mappedPlayer = { ...p, peerId: p.socketId };
            this.players.set(p.socketId, mappedPlayer);
            if (p.socketId === this.socket.id) this.localPlayer = mappedPlayer;
          });

          this.onPlayersUpdated(Array.from(this.players.values()));
          resolve({ roomCode: response.roomCode, peerId: this.socket.id });
        } else {
          reject(new Error(response?.message || 'Error al crear la sala.'));
        }
      });
    });
  }

  // Join room with server-side validations
  joinRoom(roomCode, playerName, playerColor) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        this.socket.connect();
      }

      this.socket.emit('join_room', { roomCode, playerName, playerColor }, (response) => {
        if (response && response.success) {
          this.roomCode = response.roomCode;
          this.isHost = false;
          this.mySocketId = this.socket.id;

          this.players.clear();
          response.players.forEach(p => {
            const mappedPlayer = { ...p, peerId: p.socketId };
            this.players.set(p.socketId, mappedPlayer);
            if (p.socketId === this.socket.id) this.localPlayer = mappedPlayer;
          });

          this.onPlayersUpdated(Array.from(this.players.values()));
          resolve({ roomCode: response.roomCode, peerId: this.socket.id });
        } else {
          // Reject with server error message (e.g. SALA LLENA, LA SALA NO EXISTE)
          reject(new Error(response?.message || 'No se pudo ingresar a la sala.'));
        }
      });
    });
  }

  // Host triggers race start
  startRace(snippetSet) {
    if (!this.isHost || !this.socket) return;
    this.socket.emit('start_race', { snippetSet });
  }

  // Send real-time typing progress
  sendProgress(progressPercent, wpm, currentBlock) {
    if (!this.socket) return;
    if (this.localPlayer) {
      this.localPlayer.progress = progressPercent;
      this.localPlayer.wpm = wpm;
    }
    this.socket.emit('player_progress', {
      progress: progressPercent,
      wpm,
      currentBlock
    });
  }

  // Send race completion
  sendFinished(timeMs, finalWpm) {
    if (!this.socket) return;
    if (this.localPlayer) {
      this.localPlayer.finished = true;
      this.localPlayer.timeMs = timeMs;
      this.localPlayer.wpm = finalWpm;
    }
    this.socket.emit('player_finished', {
      timeMs,
      wpm: finalWpm
    });
  }

  leaveRoom() {
    if (this.socket) {
      this.socket.emit('leave_room');
    }
    this.players.clear();
    this.roomCode = null;
    this.isHost = false;
  }
}

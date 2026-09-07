// MultiplayerEngine.js
// PeerJS P2P WebRTC
// Creación / unión de salas y sincronización de carrera

import Peer from 'peerjs';

export class MultiplayerEngine {

  constructor(options = {}) {

    // ============================================================
    // CALLBACKS
    // ============================================================

    this.onPlayersUpdated =
      options.onPlayersUpdated || (() => {});

    this.onRaceStarted =
      options.onRaceStarted || (() => {});

    this.onProgressReceived =
      options.onProgressReceived || (() => {});

    this.onPlayerFinished =
      options.onPlayerFinished || (() => {});

    this.onHostLeft =
      options.onHostLeft || (() => {});


    // ============================================================
    // PEERJS
    // ============================================================

    this.peer = null;
    this.myPeerId = null;

    // Indica si los listeners del Peer actual ya fueron registrados
    this.peerEventsAttached = false;

    // Promise pendiente esperando peer.open
    this.pendingPeerOpen = null;


    // ============================================================
    // ROOM
    // ============================================================

    this.roomCode = null;
    this.isHost = false;


    // ============================================================
    // CONNECTIONS
    // ============================================================

    // peerId -> DataConnection
    this.connections = new Map();


    // ============================================================
    // PLAYERS
    // ============================================================

    // peerId -> player
    this.players = new Map();

    this.localPlayer = null;


    // ============================================================
    // STATE
    // ============================================================

    this.isDestroyed = false;
  }


  // ============================================================
  // ROOM CODE
  // ============================================================

  generateRoomCode() {

    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let result = 'RC';

    for (let i = 0; i < 4; i++) {

      result += chars.charAt(
        Math.floor(
          Math.random() * chars.length
        )
      );

    }

    return result;
  }


  // ============================================================
  // PEER EVENTS
  //
  // IMPORTANTE:
  // Aquí se registran TODOS los listeners del Peer.
  //
  // createRoom() y joinRoom() NO vuelven a hacer:
  // peer.on('open')
  // peer.on('error')
  //
  // Así evitamos listeners duplicados.
  // ============================================================

  setupPeerEvents() {

    if (!this.peer) {
      return;
    }

    if (this.peerEventsAttached) {
      console.warn(
        '[PEERJS] Los listeners ya fueron registrados'
      );

      return;
    }

    this.peerEventsAttached = true;


    // ============================================================
    // PEER OPEN
    // ============================================================

    this.peer.on('open', (id) => {

      console.log(
        '======================================'
      );

      console.log(
        '[PEERJS] Conexión con servidor establecida'
      );

      console.log(
        '[PEERJS] Mi Peer ID:',
        id
      );

      console.log(
        '======================================'
      );


      this.myPeerId = id;


      // Resolver Promise pendiente
      if (this.pendingPeerOpen) {

        const pending =
          this.pendingPeerOpen;

        this.pendingPeerOpen = null;

        pending.resolve(id);
      }

    });


    // ============================================================
    // INCOMING CONNECTION
    // ============================================================

    this.peer.on('connection', (conn) => {

      console.log(
        '======================================'
      );

      console.log(
        '[PEERJS] Conexión entrante:',
        conn.peer
      );

      console.log(
        '[PEERJS] Soy host:',
        this.isHost
      );

      console.log(
        '======================================'
      );


      if (!this.isHost) {

        console.warn(
          '[PEERJS] Guest recibió una conexión entrante inesperada'
        );

        try {
          conn.close();
        } catch (_) {}

        return;
      }


      this.handleIncomingConnection(conn);

    });


    // ============================================================
    // PEER ERROR
    // ============================================================

    this.peer.on('error', (err) => {

      console.error(
        '======================================'
      );

      console.error(
        '[PEERJS] ERROR'
      );

      console.error(
        'Type:',
        err?.type
      );

      console.error(
        'Message:',
        err?.message
      );

      console.error(
        err
      );

      console.error(
        '======================================'
      );


      // Resolver/rechazar Promise de peer.open
      if (this.pendingPeerOpen) {

        const pending =
          this.pendingPeerOpen;

        this.pendingPeerOpen = null;

        pending.reject(err);
      }


      // Guest perdió acceso al host
      if (
        !this.isHost &&
        err?.type === 'peer-unavailable'
      ) {

        console.warn(
          '[GUEST] Host no disponible'
        );

        this.onHostLeft(err);
      }

    });


    // ============================================================
    // DISCONNECTED FROM PEERJS SERVER
    // ============================================================

    this.peer.on('disconnected', () => {

      console.warn(
        '[PEERJS] Desconectado del servidor de señalización'
      );

    });


    // ============================================================
    // PEER CLOSED
    // ============================================================

    this.peer.on('close', () => {

      console.warn(
        '[PEERJS] Peer cerrado'
      );

    });

  }


  // ============================================================
  // WAIT FOR PEER OPEN
  // ============================================================

  waitForPeerOpen() {

    if (!this.peer) {

      return Promise.reject(
        new Error(
          'PeerJS no está inicializado'
        )
      );

    }


    // Si ya está abierto
    if (this.peer.open && this.myPeerId) {

      return Promise.resolve(
        this.myPeerId
      );

    }


    // Si ya existe una espera
    if (this.pendingPeerOpen) {

      return new Promise(
        (resolve, reject) => {

          // No sobrescribimos la espera anterior.
          // En condiciones normales no debería ocurrir.
          console.warn(
            '[PEERJS] Ya existe una espera por peer.open'
          );

          resolve(
            this.myPeerId
          );

        }
      );

    }


    return new Promise(
      (resolve, reject) => {

        this.pendingPeerOpen = {
          resolve,
          reject
        };

      }
    );

  }


  // ============================================================
  // CREATE PEER
  // ============================================================

  createPeer(peerId = null) {

    // Limpiar referencia anterior
    this.peer = null;

    this.peerEventsAttached = false;

    this.myPeerId = null;


    console.log(
      '[PEERJS] Creando Peer...',
      peerId || '(ID automático)'
    );


    if (peerId) {

      this.peer =
        new Peer(
          peerId,
          {
            debug: 3
          }
        );

    } else {

      this.peer =
        new Peer(
          {
            debug: 3
          }
        );

    }


    // IMPORTANTE:
    // Registrar listeners UNA SOLA VEZ
    this.setupPeerEvents();


    return this.peer;

  }


  // ============================================================
  // HOST - CREATE ROOM
  // ============================================================

  async createRoom(
    playerName,
    playerColor
  ) {

    this.isHost = true;
    this.isDestroyed = false;


    // ============================================================
    // GENERAR ROOM
    // ============================================================

    this.roomCode =
      this.generateRoomCode();


    const peerId =
      `coderace-${this.roomCode.toLowerCase()}`;


    console.log(
      '======================================'
    );

    console.log(
      '[MULTIPLAYER] CREANDO SALA'
    );

    console.log(
      '[MULTIPLAYER] Room Code:',
      this.roomCode
    );

    console.log(
      '[MULTIPLAYER] Peer ID:',
      peerId
    );

    console.log(
      '======================================'
    );


    // ============================================================
    // CREAR PEER
    // ============================================================

    this.createPeer(peerId);


    // ============================================================
    // ESPERAR REGISTRO
    // ============================================================

    try {

      const id =
        await this.waitForPeerOpen();


      console.log(
        '[HOST] Peer registrado correctamente:',
        id
      );


      // ==========================================================
      // LOCAL PLAYER
      // ==========================================================

      this.localPlayer = {

        peerId: id,

        name:
          playerName ||
          'Anfitrión',

        color:
          playerColor ||
          '#00f3ff',

        lane: 0,

        progress: 0,

        wpm: 0,

        isHost: true,

        finished: false,

        timeMs: null

      };


      this.players.set(
        id,
        this.localPlayer
      );


      this.onPlayersUpdated(
        Array.from(
          this.players.values()
        )
      );


      console.log(
        '[HOST] Sala lista para recibir jugadores'
      );


      return {

        roomCode:
          this.roomCode,

        peerId:
          id

      };

    } catch (err) {

      console.error(
        '[HOST] Error creando sala:',
        err
      );


      // Si el ID ya existe, intentar nuevamente
      if (
        err?.type === 'unavailable-id'
      ) {

        console.warn(
          '[HOST] Room ID ocupado.'
        );

        console.warn(
          '[HOST] Generando otro código...'
        );


        try {

          if (this.peer) {
            this.peer.destroy();
          }

        } catch (_) {}


        this.peer = null;
        this.peerEventsAttached = false;
        this.myPeerId = null;
        this.pendingPeerOpen = null;


        return this.createRoom(
          playerName,
          playerColor
        );

      }


      throw err;

    }

  }


  // ============================================================
  // GUEST - JOIN ROOM
  // ============================================================

  async joinRoom(
    roomCode,
    playerName,
    playerColor
  ) {

    this.isHost = false;
    this.isDestroyed = false;


    // ============================================================
    // NORMALIZAR ROOM CODE
    // ============================================================

    this.roomCode =
      String(roomCode)
        .toUpperCase()
        .trim();


    const hostPeerId =
      `coderace-${this.roomCode.toLowerCase()}`;


    console.log(
      '======================================'
    );

    console.log(
      '[GUEST] UNIÉNDOSE A SALA'
    );

    console.log(
      '[GUEST] Room Code:',
      this.roomCode
    );

    console.log(
      '[GUEST] Host Peer ID:',
      hostPeerId
    );

    console.log(
      '======================================'
    );


    // ============================================================
    // CREAR PEER DEL GUEST
    // ============================================================

    this.createPeer();


    // ============================================================
    // ESPERAR PEER OPEN
    // ============================================================

    let id;

    try {

      id =
        await this.waitForPeerOpen();

    } catch (err) {

      console.error(
        '[GUEST] Error abriendo PeerJS:',
        err
      );

      throw err;

    }


    console.log(
      '[GUEST] Mi Peer ID:',
      id
    );


    // ============================================================
    // LOCAL PLAYER
    // ============================================================

    this.localPlayer = {

      peerId: id,

      name:
        playerName ||
        'Piloto Guest',

      color:
        playerColor ||
        '#ff0055',

      lane: 1,

      progress: 0,

      wpm: 0,

      isHost: false,

      finished: false,

      timeMs: null

    };


    // ============================================================
    // CONNECT TO HOST
    // ============================================================

    console.log(
      '[GUEST] Intentando conectar con:',
      hostPeerId
    );


    const conn =
      this.peer.connect(
        hostPeerId,
        {
          reliable: true
        }
      );


    if (!conn) {

      const error =
        new Error(
          `No se pudo crear conexión con ${hostPeerId}`
        );


      console.error(
        '[GUEST] ERROR:',
        error
      );


      throw error;

    }


    console.log(
      '[GUEST] DataConnection creada'
    );

    console.log(
      '[GUEST] Estado inicial:',
      conn.open
    );


    // ============================================================
    // CONFIGURAR DIAGNÓSTICO WEBRTC
    // ============================================================

    this.setupWebRTCDiagnostics(
      conn,
      'GUEST'
    );


    // ============================================================
    // ESPERAR CONNECTION OPEN
    // ============================================================

    return new Promise(
      (resolve, reject) => {

        let resolved = false;


        // ========================================================
        // OPEN
        // ========================================================

        conn.once('open', () => {

          resolved = true;


          console.log(
            '======================================'
          );

          console.log(
            '[GUEST] ¡CONEXIÓN CON HOST ABIERTA!'
          );

          console.log(
            '[GUEST] Host:',
            hostPeerId
          );

          console.log(
            '======================================'
          );


          this.connections.set(
            hostPeerId,
            conn
          );


          // ======================================================
          // DATA
          // ======================================================

          conn.on('data', (data) => {

            console.log(
              '[GUEST] DATA RECIBIDA:',
              data
            );


            this.handleMessage(
              data,
              conn
            );

          });


          // ======================================================
          // JOIN REQUEST
          // ======================================================

          const joinMessage = {

            type:
              'JOIN_REQUEST',

            player:
              this.localPlayer

          };


          console.log(
            '[GUEST] Enviando JOIN_REQUEST:',
            joinMessage
          );


          try {

            conn.send(
              joinMessage
            );

          } catch (err) {

            console.error(
              '[GUEST] Error enviando JOIN_REQUEST:',
              err
            );

            reject(err);

            return;

          }


          console.log(
            '[GUEST] JOIN_REQUEST enviado'
          );


          resolve({

            roomCode:
              this.roomCode,

            peerId:
              id

          });

        });


        // ========================================================
        // CONNECTION ERROR
        // ========================================================

        conn.on('error', (err) => {

          console.error(
            '======================================'
          );

          console.error(
            '[GUEST] ERROR DE CONNECTION'
          );

          console.error(
            'Peer:',
            conn.peer
          );

          console.error(
            'Type:',
            err?.type
          );

          console.error(
            'Message:',
            err?.message
          );

          console.error(
            err
          );

          console.error(
            '======================================'
          );


          if (!resolved) {
            reject(err);
          }

        });


        // ========================================================
        // CONNECTION CLOSE
        // ========================================================

        conn.on('close', () => {

          console.warn(
            '[GUEST] Conexión con host cerrada'
          );


          this.connections.delete(
            hostPeerId
          );


          if (resolved) {

            this.onHostLeft();

          }

        });

      }
    );

  }


  // ============================================================
  // HOST - INCOMING CONNECTION
  // ============================================================

  handleIncomingConnection(conn) {

    console.log(
      '[HOST] Conexión entrante detectada:',
      conn.peer
    );


    // ============================================================
    // WEBRTC DIAGNOSTICS
    // ============================================================

    this.setupWebRTCDiagnostics(
      conn,
      'HOST'
    );


    // ============================================================
    // OPEN
    // ============================================================

    conn.once('open', () => {

      console.log(
        '======================================'
      );

      console.log(
        '[HOST] ¡CONEXIÓN ABIERTA CON:',
        conn.peer
      );

      console.log(
        '======================================'
      );


      this.connections.set(
        conn.peer,
        conn
      );


      // ==========================================================
      // DATA
      // ==========================================================

      conn.on('data', (data) => {

        console.log(
          '[HOST] DATA RECIBIDA DE',
          conn.peer,
          ':',
          data
        );


        this.handleMessage(
          data,
          conn
        );

      });

    });


    // ============================================================
    // ERROR
    // ============================================================

    conn.on('error', (err) => {

      console.error(
        '======================================'
      );

      console.error(
        '[HOST] CONNECTION ERROR'
      );

      console.error(
        'Peer:',
        conn.peer
      );

      console.error(
        'Type:',
        err?.type
      );

      console.error(
        'Message:',
        err?.message
      );

      console.error(
        err
      );

      console.error(
        '======================================'
      );

    });


    // ============================================================
    // CLOSE
    // ============================================================

    conn.on('close', () => {

      console.warn(
        '[HOST] Jugador desconectado:',
        conn.peer
      );


      this.connections.delete(
        conn.peer
      );


      this.players.delete(
        conn.peer
      );


      this.broadcastRoomState();


      this.onPlayersUpdated(
        Array.from(
          this.players.values()
        )
      );

    });

  }


  // ============================================================
  // WEBRTC / ICE DIAGNOSTICS
  // ============================================================

  setupWebRTCDiagnostics(
    conn,
    role
  ) {

    // PeerJS expone el RTCPeerConnection internamente.
    const pc =
      conn?.peerConnection;


    if (!pc) {

      console.warn(
        `[${role}] peerConnection todavía no disponible`
      );


      // Intentar nuevamente después
      setTimeout(() => {

        const retryPC =
          conn?.peerConnection;

        if (retryPC) {

          this.attachIceDiagnostics(
            retryPC,
            conn.peer,
            role
          );

        } else {

          console.warn(
            `[${role}] No se pudo obtener RTCPeerConnection`
          );

        }

      }, 500);


      return;

    }


    this.attachIceDiagnostics(
      pc,
      conn.peer,
      role
    );

  }


  // ============================================================
  // ATTACH ICE DIAGNOSTICS
  // ============================================================

  attachIceDiagnostics(
    pc,
    peerId,
    role
  ) {

    if (
      pc.__coderaceDiagnosticsAttached
    ) {

      return;

    }


    pc.__coderaceDiagnosticsAttached = true;


    console.log(
      `[${role}] WebRTC diagnostics activados para ${peerId}`
    );


    // ============================================================
    // ICE CONNECTION STATE
    // ============================================================

    pc.addEventListener(
      'iceconnectionstatechange',
      () => {

        console.log(
          `[${role}] ICE STATE (${peerId}):`,
          pc.iceConnectionState
        );


        switch (
          pc.iceConnectionState
        ) {

          case 'checking':

            console.log(
              `[${role}] ICE está buscando una ruta P2P...`
            );

            break;


          case 'connected':

            console.log(
              `[${role}] ✅ ICE CONECTADO`
            );

            break;


          case 'completed':

            console.log(
              `[${role}] ✅ ICE COMPLETADO`
            );

            break;


          case 'disconnected':

            console.warn(
              `[${role}] ⚠️ ICE DESCONECTADO`
            );

            break;


          case 'failed':

            console.error(
              `[${role}] ❌ ICE FALLÓ`
            );

            console.error(
              `[${role}] La conexión P2P no pudo establecerse`
            );

            break;


          case 'closed':

            console.warn(
              `[${role}] ICE CERRADO`
            );

            break;

        }

      }
    );


    // ============================================================
    // CONNECTION STATE
    // ============================================================

    pc.addEventListener(
      'connectionstatechange',
      () => {

        console.log(
          `[${role}] CONNECTION STATE (${peerId}):`,
          pc.connectionState
        );


        if (
          pc.connectionState === 'connected'
        ) {

          console.log(
            `[${role}] ✅ WEBRTC CONNECTION ESTABLECIDA`
          );

        }


        if (
          pc.connectionState === 'failed'
        ) {

          console.error(
            `[${role}] ❌ WEBRTC CONNECTION FAILED`
          );

        }

      }
    );


    // ============================================================
    // ICE GATHERING
    // ============================================================

    pc.addEventListener(
      'icegatheringstatechange',
      () => {

        console.log(
          `[${role}] ICE GATHERING (${peerId}):`,
          pc.iceGatheringState
        );

      }
    );


    // ============================================================
    // ICE CANDIDATES
    // ============================================================

    pc.addEventListener(
      'icecandidate',
      (event) => {

        if (event.candidate) {

          console.log(
            `[${role}] ICE candidate:`,
            event.candidate.candidate
          );

        } else {

          console.log(
            `[${role}] ICE candidate gathering terminado`
          );

        }

      }
    );


    // ============================================================
    // DATA CHANNEL
    // ============================================================

    pc.addEventListener(
      'datachannel',
      (event) => {

        console.log(
          `[${role}] DataChannel recibido:`,
          event.channel?.label
        );

      }
    );

  }


  // ============================================================
  // MESSAGE HANDLER
  // ============================================================

  handleMessage(
    data,
    conn
  ) {

    if (
      !data ||
      !data.type
    ) {

      console.warn(
        '[MULTIPLAYER] Mensaje inválido:',
        data
      );

      return;

    }


    console.log(
      '[MULTIPLAYER] Procesando mensaje:',
      data.type
    );


    switch (data.type) {


      // ========================================================
      // JOIN REQUEST
      // ========================================================

      case 'JOIN_REQUEST': {

        if (!this.isHost) {

          console.warn(
            '[MULTIPLAYER] JOIN_REQUEST recibido por guest'
          );

          break;

        }


        console.log(
          '[HOST] JOIN_REQUEST recibido de:',
          conn.peer
        );


        // ======================================================
        // ASSIGN LANE
        // ======================================================

        const assignedLane =
          this.players.size % 4;


        const newPlayer = {

          ...data.player,

          peerId:
            conn.peer,

          lane:
            assignedLane,

          isHost:
            false

        };


        console.log(
          '[HOST] Nuevo jugador:',
          newPlayer
        );


        this.players.set(
          conn.peer,
          newPlayer
        );


        // ======================================================
        // SEND ROOM STATE
        // ======================================================

        this.broadcastRoomState();


        // ======================================================
        // UPDATE HOST UI
        // ======================================================

        this.onPlayersUpdated(
          Array.from(
            this.players.values()
          )
        );


        break;

      }


      // ========================================================
      // ROOM STATE
      // ========================================================

      case 'ROOM_STATE': {

        console.log(
          '[GUEST] ROOM_STATE recibido:',
          data.players
        );


        if (
          !Array.isArray(
            data.players
          )
        ) {

          console.error(
            '[MULTIPLAYER] ROOM_STATE inválido'
          );

          break;

        }


        this.players.clear();


        data.players.forEach(
          (p) => {

            this.players.set(
              p.peerId,
              p
            );

          }
        );


        this.onPlayersUpdated(
          Array.from(
            this.players.values()
          )
        );


        break;

      }


      // ========================================================
      // START RACE
      // ========================================================

      case 'START_RACE': {

        console.log(
          '[MULTIPLAYER] START_RACE recibido'
        );


        this.onRaceStarted(
          data.snippetSet
        );


        break;

      }


      // ========================================================
      // PLAYER PROGRESS
      // ========================================================

      case 'PLAYER_PROGRESS': {

        const pData =
          this.players.get(
            data.peerId
          );


        if (pData) {

          pData.progress =
            data.progress;

          pData.wpm =
            data.wpm;

        }


        this.onProgressReceived(
          data
        );


        break;

      }


      // ========================================================
      // PLAYER FINISHED
      // ========================================================

      case 'PLAYER_FINISHED': {

        const fPlayer =
          this.players.get(
            data.peerId
          );


        if (fPlayer) {

          fPlayer.finished =
            true;

          fPlayer.timeMs =
            data.timeMs;

          fPlayer.wpm =
            data.wpm;

        }


        this.onPlayerFinished(
          data
        );


        break;

      }


      // ========================================================
      // UNKNOWN
      // ========================================================

      default:

        console.warn(
          '[MULTIPLAYER] Tipo de mensaje desconocido:',
          data.type
        );

        break;

    }

  }


  // ============================================================
  // BROADCAST ROOM STATE
  // ============================================================

  broadcastRoomState() {

    if (!this.isHost) {

      return;

    }


    const playerList =
      Array.from(
        this.players.values()
      );


    console.log(
      '[HOST] Enviando ROOM_STATE:',
      playerList
    );


    this.broadcast({

      type:
        'ROOM_STATE',

      players:
        playerList

    });

  }


  // ============================================================
  // BROADCAST
  // ============================================================

  broadcast(message) {

    console.log(
      '[MULTIPLAYER] Broadcast:',
      message
    );


    this.connections.forEach(
      (conn, peerId) => {

        if (
          conn.open
        ) {

          console.log(
            '[MULTIPLAYER] Enviando a:',
            peerId
          );


          try {

            conn.send(
              message
            );

          } catch (err) {

            console.error(
              '[MULTIPLAYER] Error enviando mensaje:',
              err
            );

          }

        } else {

          console.warn(
            '[MULTIPLAYER] Conexión cerrada:',
            peerId
          );

        }

      }
    );

  }


  // ============================================================
  // HOST START RACE
  // ============================================================

  startRace(
    snippetSet
  ) {

    if (!this.isHost) {

      console.warn(
        '[MULTIPLAYER] Solo el host puede iniciar'
      );

      return;

    }


    console.log(
      '[HOST] Iniciando carrera:',
      snippetSet
    );


    this.broadcast({

      type:
        'START_RACE',

      snippetSet

    });


    // Start local
    this.onRaceStarted(
      snippetSet
    );

  }


  // ============================================================
  // SEND PROGRESS
  // ============================================================

  sendProgress(
    progressPercent,
    wpm,
    currentBlock
  ) {

    if (
      this.localPlayer
    ) {

      this.localPlayer.progress =
        progressPercent;

      this.localPlayer.wpm =
        wpm;

    }


    this.broadcast({

      type:
        'PLAYER_PROGRESS',

      peerId:
        this.myPeerId,

      progress:
        progressPercent,

      wpm,

      currentBlock

    });

  }


  // ============================================================
  // SEND FINISHED
  // ============================================================

  sendFinished(
    timeMs,
    finalWpm
  ) {

    if (
      this.localPlayer
    ) {

      this.localPlayer.finished =
        true;

      this.localPlayer.timeMs =
        timeMs;

      this.localPlayer.wpm =
        finalWpm;

    }


    console.log(
      '[MULTIPLAYER] Jugador terminó:',
      this.myPeerId,
      timeMs,
      finalWpm
    );


    this.broadcast({

      type:
        'PLAYER_FINISHED',

      peerId:
        this.myPeerId,

      timeMs,

      wpm:
        finalWpm

    });

  }


  // ============================================================
  // LEAVE ROOM
  // ============================================================

  leaveRoom() {

    console.log(
      '[MULTIPLAYER] Saliendo de la sala'
    );


    // ============================================================
    // CLOSE CONNECTIONS
    // ============================================================

    this.connections.forEach(
      (conn) => {

        try {

          conn.close();

        } catch (_) {}

      }
    );


    this.connections.clear();


    // ============================================================
    // CLEAR PLAYERS
    // ============================================================

    this.players.clear();

    this.localPlayer = null;


    // ============================================================
    // DESTROY PEER
    // ============================================================

    if (this.peer) {

      try {

        this.peer.destroy();

      } catch (_) {}

    }


    // ============================================================
    // RESET
    // ============================================================

    this.peer = null;

    this.myPeerId = null;

    this.roomCode = null;

    this.isHost = false;

    this.peerEventsAttached = false;

    this.pendingPeerOpen = null;

    this.isDestroyed = true;

  }

}

// main.js - Core Application Entry Point

import confetti from 'canvas-confetti';
import { RaceEngine } from './game/RaceEngine.js';
import { TypingEngine } from './game/TypingEngine.js';
import { SoundEngine } from './game/SoundEngine.js';
import { MultiplayerEngine } from './game/MultiplayerEngine.js';
import { getRandomSnippetSet } from './game/CodeSnippets.js';

class CodeRaceApp {
  constructor() {
    // UI Elements
    this.screens = {
      lobby: document.getElementById('lobby-screen'),
      race: document.getElementById('race-screen'),
      results: document.getElementById('results-screen')
    };

    this.inputName = document.getElementById('player-name');
    this.colorPicker = document.getElementById('color-picker');
    this.selectedColor = '#00f3ff';

    // Buttons
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.btnShowJoin = document.getElementById('btn-show-join');
    this.btnJoinRoom = document.getElementById('btn-join-room');
    this.btnCancelJoin = document.getElementById('btn-cancel-join');
    this.btnStartRace = document.getElementById('btn-start-race');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.btnPlayAgain = document.getElementById('btn-play-again');
    this.btnToggleAudio = document.getElementById('btn-toggle-audio');

    // Forms & Views
    this.joinForm = document.getElementById('join-form');
    this.roomWaiting = document.getElementById('room-waiting');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.displayRoomCode = document.getElementById('display-room-code');
    this.playersListEl = document.getElementById('players-list');
    this.playerCountEl = document.getElementById('player-count');
    this.guestWaitingMsg = document.getElementById('guest-waiting-msg');

    // Countdown Overlay
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownNumber = document.getElementById('countdown-number');

    // HUD Elements
    this.codeDisplayEl = document.getElementById('code-display');
    this.codeSnippetTitleEl = document.getElementById('code-snippet-title');
    this.currentBlockNumEl = document.getElementById('current-block-num');
    this.hudSpeedEl = document.getElementById('hud-speed');
    this.hudWpmEl = document.getElementById('hud-wpm');
    this.hudAccuracyEl = document.getElementById('hud-accuracy');
    this.hudTimerEl = document.getElementById('hud-timer');
    this.radarTrackEl = document.getElementById('radar-track');
    this.radarDots = new Map();

    // Results Elements
    this.leaderboardListEl = document.getElementById('leaderboard-list');
    this.winnerAnnouncementEl = document.getElementById('winner-announcement');
    this.resWpmEl = document.getElementById('res-wpm');
    this.resPeakWpmEl = document.getElementById('res-peak-wpm');
    this.resAccuracyEl = document.getElementById('res-accuracy');
    this.resTimeEl = document.getElementById('res-time');

    // Engines
    this.soundEngine = new SoundEngine();
    this.raceEngine = new RaceEngine(document.getElementById('race-canvas'));
    this.typingEngine = null;
    this.multiplayerEngine = null;

    // Race State
    this.currentSnippetSet = null;
    this.timerInterval = null;
    this.raceStartTime = null;

    this.init();
  }

  init() {
    // 1. Initialize 3D Canvas
    this.raceEngine.init();

    // 2. Setup Color Customizer
    this.colorPicker.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.soundEngine.playColorPick();
        this.colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedColor = btn.dataset.color;
      });
    });

    // 3. Setup TypingEngine instance
    this.typingEngine = new TypingEngine({
      containerEl: this.codeDisplayEl,
      onCharacterTyped: (stats) => this.handleCharacterTyped(stats),
      onBlockCompleted: (blockIndex, nextBlock) => this.handleBlockCompleted(blockIndex, nextBlock),
      onRaceCompleted: (finalStats) => this.handleRaceCompleted(finalStats),
      onError: () => {
        this.soundEngine.playErrorSound();
      },
      onBackspace: () => {
        this.soundEngine.playKeyClick('backspace');
      }
    });

    // 4. Setup MultiplayerEngine instance
    this.multiplayerEngine = new MultiplayerEngine({
      onPlayersUpdated: (players) => this.updateLobbyPlayersUI(players),
      onRaceStarted: (snippetSet) => this.onRemoteRaceStart(snippetSet),
      onProgressReceived: (data) => this.onRemotePlayerProgress(data),
      onPlayerFinished: (data) => this.onRemotePlayerFinished(data)
    });

    // 5. Attach Event Handlers
    this.btnCreateRoom.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.handleCreateRoom();
    });
    this.btnShowJoin.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.joinForm.classList.remove('hidden');
    });
    this.btnCancelJoin.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.joinForm.classList.add('hidden');
    });
    this.btnJoinRoom.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.handleJoinRoom();
    });
    this.btnStartRace.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.handleStartRaceClick();
    });
    this.btnLeaveRoom.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.handleLeaveRoom();
    });
    this.btnPlayAgain.addEventListener('click', () => {
      this.soundEngine.playUIClick();
      this.soundEngine.stopEngine();
      this.soundEngine.setMusicMode('lobby');
      this.showScreen('lobby');
    });

    // Lobby inputs typing sounds (Mechanical keyboard SFX when typing player name and room code)
    const handleLobbyInputKey = (e) => {
      // Ensure audio context and background soundtrack are active
      this.soundEngine.init();
      if (!this.soundEngine.isMusicPlaying) {
        this.soundEngine.startMusic('lobby');
      }

      if (e.key === ' ' || e.code === 'Space') {
        this.soundEngine.playKeyClick('space');
      } else if (e.key === 'Backspace') {
        this.soundEngine.playKeyClick('backspace');
      } else if (e.key === 'Enter') {
        this.soundEngine.playKeyClick('enter');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.soundEngine.playKeyClick('default');
      }
    };

    if (this.inputName) {
      this.inputName.addEventListener('keydown', handleLobbyInputKey);
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.addEventListener('keydown', handleLobbyInputKey);
    }

    // UI hover micro-sounds for all interactive buttons
    document.querySelectorAll('.btn, .color-btn, .btn-icon').forEach(btn => {
      btn.addEventListener('mouseenter', () => this.soundEngine.playUIHover());
    });

    this.btnToggleAudio.addEventListener('click', () => {
      const muted = this.soundEngine.toggleMute();
      document.getElementById('icon-sound-on').classList.toggle('hidden', muted);
      document.getElementById('icon-sound-off').classList.toggle('hidden', !muted);
    });

    // Ensure audio starts on first click or keydown anywhere
    const startAudioOnFirstInteraction = () => {
      this.soundEngine.init();
      if (!this.soundEngine.isMusicPlaying) {
        this.soundEngine.startMusic('lobby');
      }
    };
    document.addEventListener('click', startAudioOnFirstInteraction, { once: true });
    document.addEventListener('keydown', startAudioOnFirstInteraction, { once: true });
  }

  showScreen(screenName) {
    Object.keys(this.screens).forEach(key => {
      if (key === screenName) {
        this.screens[key].classList.add('active');
      } else {
        this.screens[key].classList.remove('active');
      }
    });
  }

  getPlayerName() {
    return this.inputName.value.trim() || `Piloto_${Math.floor(100 + Math.random() * 900)}`;
  }

  async handleCreateRoom() {
    if (this.btnCreateRoom.disabled) return;
    this.btnCreateRoom.disabled = true;
    this.btnCreateRoom.textContent = 'Creando sala...';

    const name = this.getPlayerName();
    try {
      const room = await this.multiplayerEngine.createRoom(name, this.selectedColor);
      this.displayRoomCode.textContent = room.roomCode;
      this.roomWaiting.classList.remove('hidden');
      this.btnStartRace.classList.remove('hidden');
      this.guestWaitingMsg.classList.add('hidden');
    } catch (err) {
      alert('⚠️ Error creando la sala: ' + err.message);
    } finally {
      this.btnCreateRoom.disabled = false;
      this.btnCreateRoom.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Crear Sala Multijugador
      `;
    }
  }

  async handleJoinRoom() {
    if (this.btnJoinRoom.disabled) return;
    const code = this.roomCodeInput.value.trim();
    if (!code) {
      alert('Por favor ingresa un código de sala válido.');
      return;
    }

    this.btnJoinRoom.disabled = true;
    this.btnJoinRoom.textContent = 'Conectando...';

    const name = this.getPlayerName();
    try {
      const room = await this.multiplayerEngine.joinRoom(code, name, this.selectedColor);
      this.displayRoomCode.textContent = room.roomCode;
      this.roomWaiting.classList.remove('hidden');
      this.btnStartRace.classList.add('hidden');
      this.guestWaitingMsg.classList.remove('hidden');
      this.joinForm.classList.add('hidden');
    } catch (err) {
      alert('🚫 ' + (err.message || 'No se pudo ingresar a la sala.'));
    } finally {
      this.btnJoinRoom.disabled = false;
      this.btnJoinRoom.textContent = 'Conectar';
    }
  }

  copyRoomCode() {
    this.soundEngine.playCodeCopied();
    const code = this.displayRoomCode.textContent;
    navigator.clipboard.writeText(code);
    const originalText = this.btnCopyCode.innerHTML;
    this.btnCopyCode.innerHTML = '✓';
    setTimeout(() => { this.btnCopyCode.innerHTML = originalText; }, 1500);
  }

  updateLobbyPlayersUI(players) {
    if (this.prevPlayerCount !== undefined && players.length > this.prevPlayerCount) {
      this.soundEngine.playPlayerJoined();
    }
    this.prevPlayerCount = players.length;

    this.playersListEl.innerHTML = '';
    this.playerCountEl.textContent = players.length;

    players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-row';
      li.style.setProperty('--p-color', p.color);

      li.innerHTML = `
        <div class="player-info-meta">
          <span class="player-car-indicator"></span>
          <span class="player-name-text">${p.name}</span>
        </div>
        ${p.isHost ? '<span class="host-tag">ANFITRIÓN</span>' : ''}
      `;
      this.playersListEl.appendChild(li);
    });
  }

  handleStartRaceClick() {
    if (!this.multiplayerEngine.isHost) return;
    const snippetSet = getRandomSnippetSet();
    this.multiplayerEngine.startRace(snippetSet);
  }

  onRemoteRaceStart(snippetSet) {
    this.currentSnippetSet = snippetSet;
    this.runRaceCountdownSequence();
  }

  runRaceCountdownSequence() {
    this.countdownOverlay.classList.remove('hidden');
    let count = 3;
    this.countdownNumber.textContent = count;
    this.soundEngine.playCountdownBeep(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownNumber.textContent = count;
        this.soundEngine.playCountdownBeep(count);
      } else if (count === 0) {
        this.countdownNumber.textContent = '¡YA!';
        this.soundEngine.playRaceStartGo();
      } else {
        clearInterval(interval);
        this.countdownOverlay.classList.add('hidden');
        this.startRaceGameplay();
      }
    }, 900);
  }

  startRaceGameplay() {
    this.showScreen('race');
    this.soundEngine.startEngine();
    this.soundEngine.setMusicMode('race');

    // 1. Initialize 3D Cars for all players in room
    const playerList = Array.from(this.multiplayerEngine.players.values());
    this.radarTrackEl.querySelectorAll('.radar-player-dot').forEach(el => el.remove());
    this.radarDots.clear();

    playerList.forEach((p, idx) => {
      const isLocal = p.peerId === this.multiplayerEngine.myPeerId;
      const lane = p.lane !== undefined ? p.lane : idx;
      this.raceEngine.addPlayerCar(p.peerId, p.color, lane, p.name, isLocal);

      // Create radar dot
      const dot = document.createElement('div');
      dot.className = 'radar-player-dot';
      dot.style.setProperty('--dot-color', p.color);
      dot.style.bottom = '0%';
      this.radarTrackEl.appendChild(dot);
      this.radarDots.set(p.peerId, dot);
    });

    this.raceEngine.start();

    // 2. Start Typing Engine & Snippets
    this.codeSnippetTitleEl.textContent = this.currentSnippetSet.title;
    this.typingEngine.startRace(this.currentSnippetSet);

    // 3. Start HUD Timer & Idle Speed Tick
    this.raceStartTime = Date.now();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.updateHUDTimer();
      // Tick effective speed decay if idle
      if (this.typingEngine && this.typingEngine.isActive) {
        const effectiveWpm = this.typingEngine.getEffectiveSpeed();
        const speedKmH = Math.round(effectiveWpm * 1.6);
        this.hudSpeedEl.textContent = speedKmH;
        this.soundEngine.updateEngineSpeed(effectiveWpm);
        const localId = this.multiplayerEngine.myPeerId;
        if (localId) {
          this.raceEngine.updatePlayerProgress(localId, this.typingEngine.getTotalRaceProgressPercent(), effectiveWpm);
        }
      }
    }, 200);
  }

  handleCharacterTyped(stats) {
    this.soundEngine.playKeyClick(stats.keyType);
    this.hudWpmEl.textContent = stats.wpm;
    this.hudAccuracyEl.textContent = `${stats.accuracy}%`;

    // Speed calculation
    const effectiveWpm = this.typingEngine.getEffectiveSpeed();
    const speedKmH = Math.round(effectiveWpm * 1.6);
    this.hudSpeedEl.textContent = speedKmH;
    this.soundEngine.updateEngineSpeed(effectiveWpm);

    // Trigger turbo sound when accelerating in high speed zone
    if (effectiveWpm >= 75) {
      this.soundEngine.playTurboSound();
    }

    // Update 3D car & multiplayer state
    const progressPercent = stats.totalProgressPercent;
    const localId = this.multiplayerEngine.myPeerId;
    this.raceEngine.updatePlayerProgress(localId, progressPercent, stats.wpm);
    this.updateRadarDot(localId, progressPercent);

    // Broadcast to peers
    this.multiplayerEngine.sendProgress(progressPercent, stats.wpm, this.typingEngine.currentBlockIndex + 1);
  }

  handleBlockCompleted(blockIndex, nextBlock) {
    this.soundEngine.playBlockCompleteSound(blockIndex);
    this.currentBlockNumEl.textContent = Math.min(5, nextBlock + 1);
    
    // Update block indicators dots
    const dots = document.querySelectorAll('.block-dots .dot');
    if (dots[blockIndex]) {
      dots[blockIndex].classList.remove('active');
      dots[blockIndex].classList.add('done');
    }
    if (dots[nextBlock]) {
      dots[nextBlock].classList.add('active');
    }
  }

  handleRaceCompleted(finalStats) {
    this.soundEngine.playVictorySound();
    this.soundEngine.stopEngine();
    this.soundEngine.setMusicMode('results');
    clearInterval(this.timerInterval);

    const totalTimeMs = finalStats.totalTimeMs;
    this.multiplayerEngine.sendFinished(totalTimeMs, finalStats.wpm);

    // Trigger Confetti!
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    setTimeout(() => this.showResultsScreen(finalStats), 1500);
  }

  onRemotePlayerProgress(data) {
    this.raceEngine.updatePlayerProgress(data.peerId, data.progress, data.wpm);
    this.updateRadarDot(data.peerId, data.progress);
  }

  onRemotePlayerFinished(data) {
    // Peer finished race
  }

  updateRadarDot(peerId, progressPercent) {
    const dot = this.radarDots.get(peerId);
    if (dot) {
      dot.style.bottom = `${Math.min(95, Math.max(0, progressPercent))}%`;
    }
  }

  updateHUDTimer() {
    if (!this.raceStartTime) return;
    const elapsedSec = Math.floor((Date.now() - this.raceStartTime) / 1000);
    const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
    const secs = (elapsedSec % 60).toString().padStart(2, '0');
    this.hudTimerEl.textContent = `${mins}:${secs}`;
  }

  showResultsScreen(localStats) {
    this.showScreen('results');

    // Stats readout
    this.resWpmEl.textContent = localStats.wpm;
    this.resPeakWpmEl.textContent = localStats.peakWPM;
    this.resAccuracyEl.textContent = `${localStats.accuracy}%`;
    
    const elapsedSec = Math.floor((localStats.totalTimeMs) / 1000);
    const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
    const secs = (elapsedSec % 60).toString().padStart(2, '0');
    this.resTimeEl.textContent = `${mins}:${secs}`;

    // Leaderboard
    const playersArr = Array.from(this.multiplayerEngine.players.values());
    playersArr.sort((a, b) => (b.wpm || 0) - (a.wpm || 0));

    this.leaderboardListEl.innerHTML = '';
    const topPlayer = playersArr[0];
    if (topPlayer) {
      this.winnerAnnouncementEl.textContent = `¡Victoria para ${topPlayer.name}! (${topPlayer.wpm || 0} WPM)`;
    }

    playersArr.forEach((p, idx) => {
      const rank = idx + 1;
      const li = document.createElement('li');
      li.className = 'leader-row';
      li.style.setProperty('--r-color', p.color);

      li.innerHTML = `
        <span class="leader-rank rank-${rank}">#${rank}</span>
        <span class="leader-name">${p.name}</span>
        <span class="leader-wpm">${p.wpm || 0} WPM</span>
      `;
      this.leaderboardListEl.appendChild(li);
    });
  }

  handleLeaveRoom() {
    this.soundEngine.stopEngine();
    this.soundEngine.setMusicMode('lobby');
    this.multiplayerEngine.leaveRoom();
    this.roomWaiting.classList.add('hidden');
    this.btnStartRace.classList.add('hidden');
    this.joinForm.classList.add('hidden');
  }
}

// Start App when DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new CodeRaceApp();
});

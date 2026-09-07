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
    this.btnCreateRoom.addEventListener('click', () => this.handleCreateRoom());
    this.btnShowJoin.addEventListener('click', () => {
      this.joinForm.classList.remove('hidden');
    });
    this.btnCancelJoin.addEventListener('click', () => {
      this.joinForm.classList.add('hidden');
    });
    this.btnJoinRoom.addEventListener('click', () => this.handleJoinRoom());
    this.btnStartRace.addEventListener('click', () => this.handleStartRaceClick());
    this.btnLeaveRoom.addEventListener('click', () => this.handleLeaveRoom());
    this.btnCopyCode.addEventListener('click', () => this.copyRoomCode());
    this.btnPlayAgain.addEventListener('click', () => this.showScreen('lobby'));

    this.btnToggleAudio.addEventListener('click', () => {
      const muted = this.soundEngine.toggleMute();
      document.getElementById('icon-sound-on').classList.toggle('hidden', muted);
      document.getElementById('icon-sound-off').classList.toggle('hidden', !muted);
    });

    // Ensure audio starts on first click anywhere
    document.addEventListener('click', () => this.soundEngine.init(), { once: true });
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
    const name = this.getPlayerName();
    try {
      const room = await this.multiplayerEngine.createRoom(name, this.selectedColor);
      this.displayRoomCode.textContent = room.roomCode;
      this.roomWaiting.classList.remove('hidden');
      this.btnStartRace.classList.remove('hidden');
      this.guestWaitingMsg.classList.add('hidden');
    } catch (err) {
      alert('Error creando la sala: ' + err.message);
    }
  }

  async handleJoinRoom() {
    const code = this.roomCodeInput.value.trim();
    if (!code) {
      alert('Por favor ingresa un código de sala válido.');
      return;
    }
    const name = this.getPlayerName();
    try {
      const room = await this.multiplayerEngine.joinRoom(code, name, this.selectedColor);
      this.displayRoomCode.textContent = room.roomCode;
      this.roomWaiting.classList.remove('hidden');
      this.btnStartRace.classList.add('hidden');
      this.guestWaitingMsg.classList.remove('hidden');
    } catch (err) {
      alert('No se pudo conectar a la sala: ' + (err.message || 'Código incorrecto'));
    }
  }

  copyRoomCode() {
    const code = this.displayRoomCode.textContent;
    navigator.clipboard.writeText(code);
    const originalText = this.btnCopyCode.innerHTML;
    this.btnCopyCode.innerHTML = '✓';
    setTimeout(() => { this.btnCopyCode.innerHTML = originalText; }, 1500);
  }

  updateLobbyPlayersUI(players) {
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
    this.soundEngine.playKeyClick();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownNumber.textContent = count;
        this.soundEngine.playKeyClick();
      } else if (count === 0) {
        this.countdownNumber.textContent = '¡YA!';
        this.soundEngine.playVictorySound();
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

    // 3. Start HUD Timer
    this.raceStartTime = Date.now();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateHUDTimer(), 1000);
  }

  handleCharacterTyped(stats) {
    this.soundEngine.playKeyClick();
    this.hudWpmEl.textContent = stats.wpm;
    this.hudAccuracyEl.textContent = `${stats.accuracy}%`;

    // Speed calculation
    const effectiveWpm = this.typingEngine.getEffectiveSpeed();
    const speedKmH = Math.round(effectiveWpm * 1.6);
    this.hudSpeedEl.textContent = speedKmH;
    this.soundEngine.updateEngineSpeed(effectiveWpm);

    // Update 3D car & multiplayer state
    const progressPercent = stats.totalProgressPercent;
    this.raceEngine.updatePlayerProgress(this.multiplayerEngine.myPeerId, progressPercent, stats.wpm);
    this.updateRadarDot(this.multiplayerEngine.myPeerId, progressPercent);

    // Broadcast to peers
    this.multiplayerEngine.sendProgress(progressPercent, stats.wpm, this.typingEngine.currentBlockIndex + 1);
  }

  handleBlockCompleted(blockIndex, nextBlock) {
    this.soundEngine.playBlockCompleteSound();
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

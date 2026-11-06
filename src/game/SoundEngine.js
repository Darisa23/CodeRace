// SoundEngine.js - Advanced Procedural Web Audio API Sound Engine for CodeRace

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.compressor = null;

    // Shared noise buffer for transients and air/skid effects
    this.noiseBuffer = null;

    // Realistic Engine Sound & Physics Simulation State
    this.engineRunning = false;
    this.engineOscCylinder = null;
    this.engineOscCam = null;
    this.engineExhaustFilter = null;
    this.engineMufflerFilter = null;
    this.engineGain = null;
    this.engineAirNoiseSource = null;
    this.engineAirFilter = null;
    this.engineAirGain = null;

    // Engine Simulation Physics variables
    this.targetWpm = 0;
    this.currentSpeed = 0;       // Speed in km/h
    this.currentRpm = 950;       // Idle RPM
    this.currentGear = 1;        // Gears 1 to 5
    this.isShifting = false;
    this.shiftStartTime = 0;
    this.lastLoopTime = 0;
    this.engineAnimFrame = null;
    this.throttle = 0;

    // Turbo state
    this.lastTurboTime = 0;

    // Background Soundtrack State
    this.musicGain = null;
    this.isMusicPlaying = false;
    this.musicMode = 'lobby'; // 'lobby' | 'race' | 'results'
    this.musicInterval = null;
    this.nextNoteTime = 0;
    this.currentStep = 0;
  }

  // Initialize Web Audio context and master bus with DynamicsCompressor
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Compressor to prevent any clipping, distortion, or headphone fatigue
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Music Gain Bus (soft, non-intrusive background soundtrack level)
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Pre-generate 2-second white noise buffer for procedural transients
      this.generateNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.85;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // ==========================================
  // MECHANICAL KEYBOARD SFX - ULTRA-CREAMY SWITCHES (Lubed Oil King / Morandi / PE Foam Mod)
  // ==========================================
  playKeyClick(keyType = 'default') {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    if (keyType === 'space') {
      // -----------------------------------------------------------------
      // CREAMY SPACEBAR (Deep, dampened, marbly thud - 0 rattle, Krytox lubed)
      // -----------------------------------------------------------------
      // 1. Deep solid spacebar fundamental (warm 118Hz + 236Hz harmonic)
      const spaceFreq = 118 + (Math.random() * 6 - 3);
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(spaceFreq, now);

      bodyGain.gain.setValueAtTime(0.36, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.058);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.062);

      // Warm octave harmonic (thick PBT spacebar mass)
      const harmOsc = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harmOsc.type = 'triangle';
      harmOsc.frequency.setValueAtTime(spaceFreq * 2, now);

      harmGain.gain.setValueAtTime(0.16, now);
      harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

      harmOsc.connect(harmGain);
      harmGain.connect(this.masterGain);
      harmOsc.start(now);
      harmOsc.stop(now + 0.045);

      // 2. Marbly cavity pop (PE foam + deskmat low-mid pop at 620Hz, no harsh highs)
      if (this.noiseBuffer) {
        const popSource = this.ctx.createBufferSource();
        popSource.buffer = this.noiseBuffer;
        popSource.offset = Math.random() * 1.5;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(620 + Math.random() * 80, now);
        popFilter.Q.setValueAtTime(2.8, now);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.22, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain);

        popSource.start(now);
        popSource.stop(now + 0.042);
      }
      return;
    }

    if (keyType === 'enter') {
      // -----------------------------------------------------------------
      // CREAMY ENTER KEY (Solid, dense, marbly bottom-out thud)
      // -----------------------------------------------------------------
      const enterFreq = 145 + Math.random() * 8;
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(enterFreq, now);

      bodyGain.gain.setValueAtTime(0.34, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.050);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.052);

      if (this.noiseBuffer) {
        const popSource = this.ctx.createBufferSource();
        popSource.buffer = this.noiseBuffer;
        popSource.offset = Math.random() * 1.5;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(740, now);
        popFilter.Q.setValueAtTime(3.0, now);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.20, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain);

        popSource.start(now);
        popSource.stop(now + 0.035);
      }
      return;
    }

    if (keyType === 'backspace') {
      // -----------------------------------------------------------------
      // CREAMY BACKSPACE KEY (Soft, bouncy, spring-cushioned marble pop)
      // -----------------------------------------------------------------
      const tapOsc = this.ctx.createOscillator();
      const tapGain = this.ctx.createGain();
      tapOsc.type = 'sine';
      tapOsc.frequency.setValueAtTime(270 + Math.random() * 15, now);
      tapGain.gain.setValueAtTime(0.26, now);
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      tapOsc.connect(tapGain);
      tapGain.connect(this.masterGain);
      tapOsc.start(now);
      tapOsc.stop(now + 0.030);

      if (this.noiseBuffer) {
        const popSource = this.ctx.createBufferSource();
        popSource.buffer = this.noiseBuffer;
        popSource.offset = Math.random() * 1.5;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(850, now);
        popFilter.Q.setValueAtTime(3.2, now);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.14, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain);

        popSource.start(now);
        popSource.stop(now + 0.025);
      }
      return;
    }

    // -----------------------------------------------------------------
    // CREAMY MECHANICAL SWITCH (Vertex V1 / Morandi / Oil King - Marbly Poppiness)
    // -----------------------------------------------------------------
    // 1. Marbly "Creamy Pop" (Resonant PE foam pocket at 720Hz - 880Hz, soft & addictive)
    if (this.noiseBuffer) {
      const popSource = this.ctx.createBufferSource();
      popSource.buffer = this.noiseBuffer;
      popSource.offset = Math.random() * 1.5;

      const popFilter = this.ctx.createBiquadFilter();
      popFilter.type = 'bandpass';
      // Muted, creamy sweet spot: 740Hz - 860Hz with organic per-key variation
      popFilter.frequency.setValueAtTime(760 + Math.random() * 120, now);
      popFilter.Q.setValueAtTime(3.4, now);

      const popGain = this.ctx.createGain();
      popGain.gain.setValueAtTime(0.22 + Math.random() * 0.03, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      popSource.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(this.masterGain);

      popSource.start(now);
      popSource.stop(now + 0.025);

      // Buttery Krytox 205g0 lube glide texture (warm bandpass at 1050Hz, no scratchy highs)
      const lubeSource = this.ctx.createBufferSource();
      lubeSource.buffer = this.noiseBuffer;
      lubeSource.offset = Math.random() * 1.5;

      const lubeFilter = this.ctx.createBiquadFilter();
      lubeFilter.type = 'bandpass';
      lubeFilter.frequency.setValueAtTime(1050 + Math.random() * 120, now);
      lubeFilter.Q.setValueAtTime(2.0, now);

      const lubeGain = this.ctx.createGain();
      lubeGain.gain.setValueAtTime(0.08, now);
      lubeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

      lubeSource.connect(lubeFilter);
      lubeFilter.connect(lubeGain);
      lubeGain.connect(this.masterGain);

      lubeSource.start(now);
      lubeSource.stop(now + 0.018);
    }

    // 2. Dense Rounded Bottom-out Thock (290Hz - 340Hz rounded fundamental)
    const thockOsc = this.ctx.createOscillator();
    const thockGain = this.ctx.createGain();
    thockOsc.type = 'sine';

    // Organic creamy pitch range (290Hz - 335Hz)
    const keyFreq = 310 + (Math.random() * 30 - 15);
    thockOsc.frequency.setValueAtTime(keyFreq, now);

    thockGain.gain.setValueAtTime(0.30 + Math.random() * 0.03, now);
    thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.030);

    thockOsc.connect(thockGain);
    thockGain.connect(this.masterGain);
    thockOsc.start(now);
    thockOsc.stop(now + 0.032);

    // 3. Gasket-mount flex & POM plate cushion (Sub-layer at ~185Hz)
    const gasketOsc = this.ctx.createOscillator();
    const gasketGain = this.ctx.createGain();
    gasketOsc.type = 'triangle';
    gasketOsc.frequency.setValueAtTime(185 + (Math.random() * 12 - 6), now);

    gasketGain.gain.setValueAtTime(0.16, now);
    gasketGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    gasketOsc.connect(gasketGain);
    gasketGain.connect(this.masterGain);
    gasketOsc.start(now);
    gasketOsc.stop(now + 0.028);
  }

  // ==========================================
  // ERROR SFX (Tire Skid / Electronic Glitch)
  // ==========================================
  playErrorSound() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    // 1. Tire screech layer (modulated filtered noise)
    if (this.noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.offset = Math.random() * 1.5;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.22);
      filter.Q.setValueAtTime(7.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 0.25);
    }

    // 2. Electronic glitch stall tone (two discordant square waves)
    [180, 192].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  // ==========================================
  // COUNTDOWN & RACE START
  // ==========================================

  // Count 3, 2, 1 arcade racing beep
  playCountdownBeep(count) {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    const freq = 660; // Clean, high-impact arcade tone

    // Main alert tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    // Punchy sub-bass pulse
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.28);
    subOsc.start(now);
    subOsc.stop(now + 0.15);
  }

  // "¡YA!" (Green light explosion & launch)
  playRaceStartGo() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    // High triumphant green tone (1320Hz / E6)
    const highOsc = this.ctx.createOscillator();
    const highGain = this.ctx.createGain();

    highOsc.type = 'sine';
    highOsc.frequency.setValueAtTime(1320, now);

    highGain.gain.setValueAtTime(0.4, now);
    highGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    highOsc.connect(highGain);
    highGain.connect(this.masterGain);
    highOsc.start(now);
    highOsc.stop(now + 0.6);

    // Triumphant launch chord (D Major: D4, F#4, A4, D5)
    [293.66, 369.99, 440.00, 587.33].forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.7);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.7);
    });

    // Launch sub-kick & air whoosh
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(160, now);
    kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    kickGain.gain.setValueAtTime(0.45, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    kickOsc.connect(kickGain);
    kickGain.connect(this.masterGain);
    kickOsc.start(now);
    kickOsc.stop(now + 0.35);
  }

  // ==========================================
  // REALISTIC PROCEDURAL RACING ENGINE
  // ==========================================

  // Custom periodic wave for realistic 4-stroke combustion pulse
  createEngineWave() {
    if (!this.ctx) return null;
    const n = 16;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    real[0] = 0;
    imag[0] = 0;

    // Harmonically warm cylinder pressure curve (eliminates synthetic harshness)
    const harmonics = [0, 1.0, 0.72, 0.38, 0.20, 0.10, 0.04, 0.015, 0.005];
    for (let i = 1; i < harmonics.length; i++) {
      real[i] = harmonics[i];
      imag[i] = (i % 2 === 0 ? 0.06 : 0.0) * harmonics[i];
    }
    return this.ctx.createPeriodicWave(real, imag);
  }

  startEngine() {
    this.init();
    if (this.engineRunning) return;

    const now = this.ctx.currentTime;
    this.currentRpm = 950;
    this.currentSpeed = 0;
    this.targetWpm = 0;
    this.currentGear = 1;
    this.isShifting = false;
    this.throttle = 0;

    // 1. Custom periodic wave for realistic cylinder combustion pulses
    const engineWave = this.createEngineWave();

    // 2. Main cylinder firing oscillator
    this.engineOscCylinder = this.ctx.createOscillator();
    if (engineWave) {
      this.engineOscCylinder.setPeriodicWave(engineWave);
    } else {
      this.engineOscCylinder.type = 'triangle';
    }
    // Idle 950 RPM -> Firing freq = (950 / 60) * 2 = 31.67 Hz
    this.engineOscCylinder.frequency.setValueAtTime(31.67, now);

    // 3. Camshaft / 4-stroke sub-harmonic oscillator (subtle rhythmic cycle thump)
    this.engineOscCam = this.ctx.createOscillator();
    this.engineOscCam.type = 'sine';
    this.engineOscCam.frequency.setValueAtTime(15.83, now); // Half of firing frequency

    // 4. Exhaust cavity resonator (peaking filter around 125Hz for deep body purr)
    this.engineExhaustFilter = this.ctx.createBiquadFilter();
    this.engineExhaustFilter.type = 'peaking';
    this.engineExhaustFilter.frequency.setValueAtTime(125, now);
    this.engineExhaustFilter.Q.setValueAtTime(2.0, now);
    this.engineExhaustFilter.gain.setValueAtTime(4.0, now);

    // 5. Muffler lowpass filter (keeps tone warm, deep and non-fatiguing, 380Hz idle -> 760Hz rev)
    this.engineMufflerFilter = this.ctx.createBiquadFilter();
    this.engineMufflerFilter.type = 'lowpass';
    this.engineMufflerFilter.frequency.setValueAtTime(380, now);
    this.engineMufflerFilter.Q.setValueAtTime(1.2, now);

    // 6. Engine volume gain (soft, comforting, non-intrusive)
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.024, now);

    // Connect audio graph
    this.engineOscCylinder.connect(this.engineExhaustFilter);
    this.engineOscCam.connect(this.engineExhaustFilter);
    this.engineExhaustFilter.connect(this.engineMufflerFilter);
    this.engineMufflerFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOscCylinder.start(now);
    this.engineOscCam.start(now);

    // 7. Subtle aerodynamic road / air rush (barely perceptible texture)
    if (this.noiseBuffer) {
      this.engineAirNoiseSource = this.ctx.createBufferSource();
      this.engineAirNoiseSource.buffer = this.noiseBuffer;
      this.engineAirNoiseSource.loop = true;

      this.engineAirFilter = this.ctx.createBiquadFilter();
      this.engineAirFilter.type = 'bandpass';
      this.engineAirFilter.frequency.setValueAtTime(480, now);
      this.engineAirFilter.Q.setValueAtTime(1.2, now);

      this.engineAirGain = this.ctx.createGain();
      this.engineAirGain.gain.setValueAtTime(0, now);

      this.engineAirNoiseSource.connect(this.engineAirFilter);
      this.engineAirFilter.connect(this.engineAirGain);
      this.engineAirGain.connect(this.masterGain);

      this.engineAirNoiseSource.start(now);
    }

    this.engineRunning = true;
    this.lastLoopTime = performance.now();

    // Start 60fps physics & RPM interpolation loop
    const runLoop = () => {
      if (!this.engineRunning) return;
      this.updateEnginePhysics();
      this.engineAnimFrame = requestAnimationFrame(runLoop);
    };
    this.engineAnimFrame = requestAnimationFrame(runLoop);
  }

  updateEnginePhysics() {
    if (!this.engineRunning || !this.ctx || !this.engineOscCylinder) return;

    const nowPerf = performance.now();
    const dt = Math.min(0.1, (nowPerf - this.lastLoopTime) / 1000);
    this.lastLoopTime = nowPerf;

    const targetKmH = Math.max(0, this.targetWpm * 1.6);

    // Smooth speed tracking with vehicle inertia
    if (targetKmH > this.currentSpeed) {
      this.currentSpeed += (targetKmH - this.currentSpeed) * Math.min(1, dt * 3.2);
    } else {
      this.currentSpeed += (targetKmH - this.currentSpeed) * Math.min(1, dt * 1.8);
    }

    // 5-Speed Gearbox Simulation
    let targetGear = 1;
    let minSpd = 0, maxSpd = 30;
    let minRpm = 950, maxRpm = 4600;

    if (this.currentSpeed > 130) {
      targetGear = 5;
      minSpd = 130; maxSpd = 240;
      minRpm = 3000; maxRpm = 5800;
    } else if (this.currentSpeed > 88) {
      targetGear = 4;
      minSpd = 88; maxSpd = 140;
      minRpm = 2700; maxRpm = 5400;
    } else if (this.currentSpeed > 52) {
      targetGear = 3;
      minSpd = 52; maxSpd = 98;
      minRpm = 2500; maxRpm = 5100;
    } else if (this.currentSpeed > 24) {
      targetGear = 2;
      minSpd = 24; maxSpd = 60;
      minRpm = 2300; maxRpm = 4800;
    }

    // Handle Gear Shift (natural clutch dip & mechanical shift sound)
    if (targetGear !== this.currentGear && this.currentSpeed > 15) {
      const isUpshift = targetGear > this.currentGear;
      this.currentGear = targetGear;
      this.isShifting = true;
      this.shiftStartTime = nowPerf;
      this.playGearShiftSound(targetGear, isUpshift);
    }

    const gearRatio = Math.max(0, Math.min(1, (this.currentSpeed - minSpd) / (maxSpd - minSpd)));
    let calculatedRpm = minRpm + Math.pow(gearRatio, 1.15) * (maxRpm - minRpm);

    // Clutch dip effect during shift (~85ms)
    if (this.isShifting) {
      const shiftElapsed = nowPerf - this.shiftStartTime;
      if (shiftElapsed < 85) {
        calculatedRpm *= 0.78; // Momentary RPM drop as clutch disengages
      } else {
        this.isShifting = false;
      }
    }

    // Engine flywheel inertia (RPM builds smoothly, decays naturally)
    const rpmInertia = targetKmH > this.currentSpeed ? 4.5 : 2.5;
    this.currentRpm += (calculatedRpm - this.currentRpm) * Math.min(1, dt * rpmInertia);

    // Throttle decay
    this.throttle = Math.max(0, this.throttle - dt * 1.6);

    // Audio parameter updates
    const audioNow = this.ctx.currentTime;
    // Firing frequency (Hz) for 4-stroke 4-cylinder engine
    const firingFreq = Math.max(25, (this.currentRpm / 60) * 2);
    const camFreq = firingFreq * 0.5;

    this.engineOscCylinder.frequency.setTargetAtTime(firingFreq, audioNow, 0.04);
    this.engineOscCam.frequency.setTargetAtTime(camFreq, audioNow, 0.04);

    // Muffler filter opens smoothly with RPM (380Hz at idle -> 760Hz at high RPM)
    const filterCutoff = 380 + (this.currentRpm / 6000) * 380;
    this.engineMufflerFilter.frequency.setTargetAtTime(filterCutoff, audioNow, 0.05);

    // Volume level: soft, warm, gentle (not loud or distracting)
    const idleVol = 0.022;
    const speedVolBonus = (this.currentSpeed / 180) * 0.016;
    const throttleBonus = this.throttle * 0.008;
    const finalVolume = this.isMuted ? 0 : (idleVol + speedVolBonus + throttleBonus);

    this.engineGain.gain.setTargetAtTime(finalVolume, audioNow, 0.05);

    // Road/Air friction noise
    if (this.engineAirGain) {
      const airVol = this.isMuted ? 0 : (this.currentSpeed / 180) * 0.02;
      this.engineAirGain.gain.setTargetAtTime(airVol, audioNow, 0.1);
    }
  }

  updateEngineSpeed(wpm) {
    this.targetWpm = Math.max(0, wpm);
    // Every time the player is typing/accelerating, blip the throttle
    if (wpm > 0) {
      this.throttle = 1.0;
    }
  }

  stopEngine() {
    if (!this.engineRunning) return;

    if (this.engineAnimFrame) {
      cancelAnimationFrame(this.engineAnimFrame);
      this.engineAnimFrame = null;
    }

    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
    }
    if (this.engineAirGain && this.ctx) {
      this.engineAirGain.gain.setTargetAtTime(0, now, 0.1);
    }

    setTimeout(() => {
      try {
        if (this.engineOscCylinder) this.engineOscCylinder.stop();
        if (this.engineOscCam) this.engineOscCam.stop();
        if (this.engineAirNoiseSource) this.engineAirNoiseSource.stop();
      } catch (e) {}
      this.engineRunning = false;
      this.engineOscCylinder = null;
      this.engineOscCam = null;
      this.engineAirNoiseSource = null;
    }, 120);
  }

  // ==========================================
  // GEAR SHIFT SOUND EFFECT
  // ==========================================
  playGearShiftSound(gear, isUpshift = true) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (isUpshift) {
      // 1. Exhaust ignition cut pop / burble ("thump-pop")
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(110 + gear * 8, now);
      popOsc.frequency.exponentialRampToValueAtTime(38, now + 0.06);

      popGain.gain.setValueAtTime(0.08, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      popOsc.connect(popGain);
      popGain.connect(this.masterGain);
      popOsc.start(now);
      popOsc.stop(now + 0.07);

      // 2. Transmission mechanical selector engagement ("clack")
      const clackOsc = this.ctx.createOscillator();
      const clackGain = this.ctx.createGain();
      clackOsc.type = 'sine';
      clackOsc.frequency.setValueAtTime(320 + gear * 30, now);
      clackOsc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

      clackGain.gain.setValueAtTime(0.07, now);
      clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      clackOsc.connect(clackGain);
      clackGain.connect(this.masterGain);
      clackOsc.start(now);
      clackOsc.stop(now + 0.05);

      // 3. Exhaust manifold air puff / backpressure flutter
      if (this.noiseBuffer) {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.offset = Math.random() * 1.5;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(550 + gear * 80, now);
        noiseFilter.Q.setValueAtTime(3.5, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.05, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseSource.start(now);
        noiseSource.stop(now + 0.065);
      }
    } else {
      // Downshift rev-match blip (smoother mechanical transition)
      const blipOsc = this.ctx.createOscillator();
      const blipGain = this.ctx.createGain();
      blipOsc.type = 'triangle';
      blipOsc.frequency.setValueAtTime(80, now);
      blipOsc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
      blipOsc.frequency.exponentialRampToValueAtTime(60, now + 0.09);

      blipGain.gain.setValueAtTime(0.04, now);
      blipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      blipOsc.connect(blipGain);
      blipGain.connect(this.masterGain);
      blipOsc.start(now);
      blipOsc.stop(now + 0.095);
    }
  }

  // ==========================================
  // TURBO / NITRO WHOOSH (Soft, satisfying whistle)
  // ==========================================
  playTurboSound() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    // Throttle turbo sound to avoid spamming
    if (now - this.lastTurboTime < 2.0) return;
    this.lastTurboTime = now;

    // 1. High resonant whistle sweep (turbo spool-up)
    const whistleOsc = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();

    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(1400, now);
    whistleOsc.frequency.exponentialRampToValueAtTime(2800, now + 0.3);
    whistleOsc.frequency.exponentialRampToValueAtTime(1800, now + 0.55);

    whistleGain.gain.setValueAtTime(0.001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.06, now + 0.2);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(this.masterGain);
    whistleOsc.start(now);
    whistleOsc.stop(now + 0.55);

    // 2. Soft air release hiss (wastegate flutter)
    if (this.noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.offset = Math.random() * 1.5;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now + 0.25);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.55);
      filter.Q.setValueAtTime(3.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setValueAtTime(0.07, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noiseSource.start(now + 0.25);
      noiseSource.stop(now + 0.6);
    }
  }

  // ==========================================
  // CHECKPOINT / BLOCK COMPLETION
  // ==========================================
  // Escalating futuristic chord with sweep for each block (0 to 4)
  playBlockCompleteSound(blockIndex = 0) {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    // Escalating major triad chords per block to build tension:
    // Block 0: G Maj (G4, B4, D5, G5)
    // Block 1: A Maj (A4, C#5, E5, A5)
    // Block 2: B Maj (B4, D#5, F#5, B5)
    // Block 3: C# Maj (C#5, E#5, G#5, C#6)
    // Block 4: D Maj (D5, F#5, A5, D6)
    const chordSets = [
      [392.00, 493.88, 587.33, 783.99],
      [440.00, 554.37, 659.25, 880.00],
      [493.88, 622.25, 739.99, 987.77],
      [554.37, 698.46, 830.61, 1108.73],
      [587.33, 739.99, 880.00, 1174.66]
    ];

    const chord = chordSets[Math.min(blockIndex, chordSets.length - 1)];

    // Fast arpeggiated sparkle
    chord.forEach((freq, idx) => {
      const time = now + (idx * 0.05);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.32);
    });

    // Sub-bass sweep pass
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(60, now + 0.25);

    subGain.gain.setValueAtTime(0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.25);
  }

  // ==========================================
  // VICTORY FANFARE & CONFETTI POPS
  // ==========================================
  playVictorySound() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    // 1. Triumphant Synth Brass Chords (Synthwave style)
    const melody = [
      { time: 0.00, notes: [440, 554.37, 659.25], dur: 0.2 },       // A Maj
      { time: 0.22, notes: [493.88, 622.25, 739.99], dur: 0.2 },    // B Maj
      { time: 0.44, notes: [554.37, 659.25, 830.61], dur: 0.2 },    // C#m
      { time: 0.68, notes: [587.33, 739.99, 880.00, 1174.66], dur: 0.9 } // Big D Maj Finale
    ];

    melody.forEach(step => {
      const stepTime = now + step.time;

      step.notes.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, stepTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, stepTime);
        filter.frequency.exponentialRampToValueAtTime(900, stepTime + step.dur);

        gain.gain.setValueAtTime(0.14, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + step.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(stepTime);
        osc.stop(stepTime + step.dur);
      });
    });

    // 2. Confetti cannon pops (randomized snappy bursts)
    if (this.noiseBuffer) {
      const popTimes = [0.1, 0.35, 0.65, 0.9, 1.15];
      popTimes.forEach(pTime => {
        const t = now + pTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.offset = Math.random() * 1.5;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600 + Math.random() * 1200, t);
        filter.Q.setValueAtTime(4.0, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);
        noise.stop(t + 0.06);
      });
    }
  }

  // ==========================================
  // UI & LOBBY MICRO-INTERACTIONS
  // ==========================================

  // Subtle futuristic hover tick
  playUIHover() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  // Crisp tactile button click
  playUIClick() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.035);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Neon color swatch selection zap
  playColorPick() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(1300, now + 0.06);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Room code copied confirmation chime
  playCodeCopied() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    [659.25, 987.77].forEach((freq, idx) => {
      const time = now + (idx * 0.07);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.18);
    });
  }

  // Player joined room radar notification
  playPlayerJoined() {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    [523.25, 783.99].forEach((freq, idx) => {
      const time = now + (idx * 0.09);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.16, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.25);
    });
  }

  // ==========================================
  // PROCEDURAL CYBERPUNK SYNTHWAVE SOUNDTRACK
  // ==========================================
  startMusic(mode = 'lobby') {
    this.init();
    this.musicMode = mode;

    if (this.isMusicPlaying) {
      this.setMusicMode(mode);
      return;
    }

    this.isMusicPlaying = true;
    this.currentStep = 0;
    // 112 BPM: 1 beat = 0.5357s, 16th note step = 0.1339s
    this.stepDuration = (60 / 112) / 4;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.updateMusicVolume();

    // High precision Web Audio lookahead scheduler loop (every 25ms, scheduling ~120ms ahead)
    if (this.musicInterval) clearInterval(this.musicInterval);
    this.musicInterval = setInterval(() => {
      if (!this.isMusicPlaying || !this.ctx) return;
      while (this.nextStepTime < this.ctx.currentTime + 0.12) {
        this.scheduleMusicStep(this.currentStep, this.nextStepTime);
        this.advanceMusicStep();
      }
    }, 25);
  }

  setMusicMode(mode) {
    this.musicMode = mode;
    this.updateMusicVolume();
  }

  updateMusicVolume() {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    let targetVol = 0.065;
    if (this.musicMode === 'race') targetVol = 0.082;
    else if (this.musicMode === 'lobby') targetVol = 0.060;
    else if (this.musicMode === 'results') targetVol = 0.070;

    this.musicGain.gain.setTargetAtTime(targetVol, now, 0.15);
  }

  advanceMusicStep() {
    this.nextStepTime += this.stepDuration;
    this.currentStep = (this.currentStep + 1) % 64; // 4-bar loop (64 16th notes)
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    this.isMusicPlaying = false;
  }

  // Precision 16th-note step dispatcher
  scheduleMusicStep(step, time) {
    if (!this.ctx || !this.musicGain) return;

    // 4-Bar Chord Progression: Dm -> F Maj -> Bb Maj -> C Maj
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;

    // Chords and root frequencies
    // Dm: D (73.42), F (87.31), A (110.00)
    // F:  F (87.31), A (110.00), C (130.81)
    // Bb: Bb (58.27), D (73.42), F (87.31)
    // C:  C (65.41), E (82.41), G (98.00)
    let rootFreq = 73.42;       // D2
    let padNotes = [146.83, 174.61, 220.00, 293.66]; // D3, F3, A3, D4
    let arpScale = [293.66, 349.23, 440.00, 523.25, 587.33, 698.46]; // Dm scale

    if (bar === 1) {
      rootFreq = 87.31;         // F2
      padNotes = [174.61, 220.00, 261.63, 329.63]; // F3, A3, C4, E4
      arpScale = [349.23, 440.00, 523.25, 659.25, 698.46, 783.99];
    } else if (bar === 2) {
      rootFreq = 58.27;         // Bb1
      padNotes = [116.54, 146.83, 174.61, 233.08]; // Bb2, D3, F3, Bb3
      arpScale = [233.08, 293.66, 349.23, 466.16, 587.33, 698.46];
    } else if (bar === 3) {
      rootFreq = 65.41;         // C2
      padNotes = [130.81, 164.81, 196.00, 261.63]; // C3, E3, G3, C4
      arpScale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    }

    // 1. LUSH SYNTH AMBIENT PAD (Downbeat of each bar)
    if (stepInBar === 0) {
      this.playSynthPad(padNotes, time);
    }

    // 2. ROLLING ANALOG BASSLINE
    if (this.musicMode === 'race') {
      // Outrun/Cyberpunk rolling 16th bassline: root on even, octave on odd
      const isOctave = (stepInBar % 2 === 1);
      const bassFreq = isOctave ? rootFreq * 2 : rootFreq;
      // Slight groove accentuation
      const isAccent = (stepInBar % 4 === 0);
      this.playSynthBass(bassFreq, time, isAccent, 0.12);
    } else if (this.musicMode === 'lobby') {
      // Gentle sub-bass pulse on quarter notes (steps 0, 4, 8, 12)
      if (stepInBar % 4 === 0) {
        this.playSynthBass(rootFreq, time, false, 0.32);
      }
    } else if (this.musicMode === 'results') {
      // Calm whole note bass
      if (stepInBar === 0) {
        this.playSynthBass(rootFreq, time, true, 0.6);
      }
    }

    // 3. HYPNOTIC CYBERPUNK ARPEGGIO / LEAD PLUCK
    // Arpeggio rhythm pattern: 16th notes with rhythmic syncopation
    const arpRhythm = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
    if (arpRhythm[stepInBar]) {
      const noteIndex = (step * 2 + bar) % arpScale.length;
      const arpFreq = arpScale[noteIndex];
      const volMultiplier = this.musicMode === 'race' ? 1.0 : 0.65;
      this.playSynthArp(arpFreq, time, volMultiplier);
    }

    // 4. RETRO DRUMS (ONLY in 'race' mode!)
    if (this.musicMode === 'race') {
      // Kick drum on four-on-the-floor (steps 0, 4, 8, 12)
      if (stepInBar % 4 === 0) {
        this.playSynthKick(time);
      }
      // Snare drum on 2 and 4 (steps 4, 12)
      if (stepInBar === 4 || stepInBar === 12) {
        this.playSynthSnare(time);
      }
      // Off-beat open hi-hat (steps 2, 6, 10, 14) + ghost closed hats
      if (stepInBar % 4 === 2) {
        this.playSynthHiHat(time, true); // Open accent hat
      } else if (stepInBar % 2 === 0) {
        this.playSynthHiHat(time, false); // Subtle closed ghost hat
      }
    }
  }

  // --- SYNTH INSTRUMENT IMPLEMENTATIONS ---

  // 1. Lush Synth Pad (Blade Runner warm analog pad)
  playSynthPad(chordNotes, time) {
    const padDuration = this.stepDuration * 16 * 1.05; // Sustains across the full bar

    chordNotes.forEach((freq, i) => {
      // Dual detuned oscillators for thick analog chorus width
      [-4, 4].forEach((detuneVal) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(detuneVal, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, time);
        filter.Q.setValueAtTime(1.0, time);

        // Smooth swelling attack and crossfade release
        const basePadVol = this.musicMode === 'lobby' ? 0.07 : 0.05;
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(basePadVol, time + 0.35);
        gain.gain.setValueAtTime(basePadVol, time + padDuration - 0.4);
        gain.gain.linearRampToValueAtTime(0.001, time + padDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + padDuration);
      });
    });
  }

  // 2. Analog Synth Bass (Rolling 16th-note electro pulse)
  playSynthBass(freq, time, isAccent, dur = 0.12) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = this.musicMode === 'lobby' ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    // Snappy resonant filter envelope
    const startCutoff = isAccent ? 620 : 380;
    const endCutoff = 110;
    filter.frequency.setValueAtTime(startCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(endCutoff, time + dur * 0.75);
    filter.Q.setValueAtTime(2.5, time);

    const bassVol = isAccent ? 0.22 : 0.16;
    gain.gain.setValueAtTime(bassVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // 3. Cyberpunk Arpeggio / Lead Pluck
  playSynthArp(freq, time, volMultiplier = 1.0) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(450, time + 0.11);
    filter.Q.setValueAtTime(3.0, time);

    const arpVol = 0.045 * volMultiplier;
    gain.gain.setValueAtTime(arpVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.13);
  }

  // 4. Retro Synthwave 808 Kick Drum
  playSynthKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Tight pitch drop from 145Hz down to 42Hz
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    gain.gain.setValueAtTime(0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  // 5. Retro Snare Drum (Body punch + noise snap)
  playSynthSnare(time) {
    // Tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.05);

    oscGain.gain.setValueAtTime(0.18, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    osc.connect(oscGain);
    oscGain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.07);

    // Snappy noise rattle
    if (this.noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.offset = Math.random() * 1.5;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2100, time);
      filter.Q.setValueAtTime(2.2, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.16, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.musicGain);

      noiseSource.start(time);
      noiseSource.stop(time + 0.12);
    }
  }

  // 6. Crisp Electro Hi-Hat
  playSynthHiHat(time, isOpen = false) {
    if (!this.noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    noiseSource.offset = Math.random() * 1.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isOpen ? 6000 : 7500, time);

    const gain = this.ctx.createGain();
    const hatVol = isOpen ? 0.07 : 0.035;
    const dur = isOpen ? 0.065 : 0.025;

    gain.gain.setValueAtTime(hatVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noiseSource.start(time);
    noiseSource.stop(time + dur + 0.005);
  }
}


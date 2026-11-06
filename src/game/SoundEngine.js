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
  // REALISTIC PROCEDURAL RACING ENGINE (v2, sintesis en capas)
  //  - Nucleo: osciladores diente de sierra + sub + armonico -> distorsion -> formantes de escape/admision
  //  - "Lope" de ralenti, rumble de escape modulado por los disparos, silbido de turbo
  //  - Viento (sube con la velocidad^2), rodadura del asfalto, chasquidos al soltar, blow-off
  //  - Capa de NITRO (rugido + chillido) con ignicion y cierre
  // ==========================================

  makeDistortionCurve(k = 30) {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Fuente de ruido en bucle (se registra para detenerla al parar el motor)
  makeNoiseLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  startEngine() {
    this.init();
    if (this.engineRunning) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.currentRpm = 900;
    this.currentSpeed = 0;
    this.targetWpm = 0;
    this.currentGear = 1;
    this.isShifting = false;
    this.throttle = 0;
    this.prevThrottle = 0;
    this.boost = 0;
    this.nitroTarget = 0;
    this.nitroLevel = 0;
    this.lastPopTime = 0;
    this.lastPassTime = 0;
    this.engineSources = []; // fuentes a detener

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(this.isMuted ? 0 : 1, now);
    bus.connect(this.masterGain);
    this.engineBus = bus;

    const osc = (type, freq) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      this.engineSources.push(o);
      return o;
    };
    const noise = () => {
      const n = this.makeNoiseLoop();
      this.engineSources.push(n);
      return n;
    };

    // ---------- NUCLEO DEL MOTOR ----------
    // Frecuencia de encendido de un 4 cilindros 4T: rpm/60*2
    this.eOsc1 = osc('sawtooth', 30);   // fundamental
    this.eOsc2 = osc('square', 15);     // sub (cigueñal / bloque)
    this.eOsc3 = osc('sawtooth', 60.2); // segundo armonico algo desafinado => aspereza

    const mix = ctx.createGain();
    mix.gain.setValueAtTime(1, now);
    const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.55, now);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.35, now);
    const g3 = ctx.createGain(); g3.gain.setValueAtTime(0.28, now);
    this.eOsc1.connect(g1).connect(mix);
    this.eOsc2.connect(g2).connect(mix);
    this.eOsc3.connect(g3).connect(mix);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(35);
    shaper.oversample = '2x';

    this.eExhaustPeak = ctx.createBiquadFilter(); // resonancia del escape
    this.eExhaustPeak.type = 'peaking';
    this.eExhaustPeak.frequency.setValueAtTime(140, now);
    this.eExhaustPeak.Q.setValueAtTime(1.6, now);
    this.eExhaustPeak.gain.setValueAtTime(7, now);

    this.eIntakePeak = ctx.createBiquadFilter();  // resonancia de la admision
    this.eIntakePeak.type = 'peaking';
    this.eIntakePeak.frequency.setValueAtTime(950, now);
    this.eIntakePeak.Q.setValueAtTime(1.2, now);
    this.eIntakePeak.gain.setValueAtTime(4, now);

    this.eLowpass = ctx.createBiquadFilter();
    this.eLowpass.type = 'lowpass';
    this.eLowpass.frequency.setValueAtTime(700, now);
    this.eLowpass.Q.setValueAtTime(0.9, now);

    this.eCoreGain = ctx.createGain();
    this.eCoreGain.gain.setValueAtTime(0.1, now);

    mix.connect(shaper);
    shaper.connect(this.eExhaustPeak);
    this.eExhaustPeak.connect(this.eIntakePeak);
    this.eIntakePeak.connect(this.eLowpass);
    this.eLowpass.connect(this.eCoreGain);
    this.eCoreGain.connect(bus);

    // "Lope" del ralenti: pequeña modulacion de frecuencia lenta
    this.eLope = osc('sine', 6.5);
    this.eLopeGain = ctx.createGain();
    this.eLopeGain.gain.setValueAtTime(1.6, now);
    this.eLope.connect(this.eLopeGain);
    this.eLopeGain.connect(this.eOsc1.frequency);
    this.eLopeGain.connect(this.eOsc3.frequency);

    // ---------- RUMBLE DE ESCAPE (ruido grave pulsado por los disparos) ----------
    const rumbleSrc = noise();
    const rumbleLP = ctx.createBiquadFilter();
    rumbleLP.type = 'lowpass';
    rumbleLP.frequency.setValueAtTime(230, now);
    this.eRumbleGain = ctx.createGain();
    this.eRumbleGain.gain.setValueAtTime(0.5, now);
    this.ePulse = osc('sine', 30);
    this.ePulseGain = ctx.createGain();
    this.ePulseGain.gain.setValueAtTime(0.5, now);
    this.ePulse.connect(this.ePulseGain);
    this.ePulseGain.connect(this.eRumbleGain.gain);
    this.eRumbleOut = ctx.createGain();
    this.eRumbleOut.gain.setValueAtTime(0.16, now);
    rumbleSrc.connect(rumbleLP);
    rumbleLP.connect(this.eRumbleGain);
    this.eRumbleGain.connect(this.eRumbleOut);
    this.eRumbleOut.connect(bus);

    // ---------- ADMISION (siseo mecanico con el acelerador) ----------
    const intakeSrc = noise();
    this.eIntakeBP = ctx.createBiquadFilter();
    this.eIntakeBP.type = 'bandpass';
    this.eIntakeBP.frequency.setValueAtTime(1100, now);
    this.eIntakeBP.Q.setValueAtTime(1.8, now);
    this.eIntakeGain = ctx.createGain();
    this.eIntakeGain.gain.setValueAtTime(0, now);
    intakeSrc.connect(this.eIntakeBP);
    this.eIntakeBP.connect(this.eIntakeGain);
    this.eIntakeGain.connect(bus);

    // ---------- TURBO (silbido que sube con la presion) ----------
    this.eTurbo = osc('sine', 1800);
    this.eTurbo2 = osc('sine', 3600);
    this.eTurboGain = ctx.createGain();
    this.eTurboGain.gain.setValueAtTime(0, now);
    const t2 = ctx.createGain(); t2.gain.setValueAtTime(0.3, now);
    this.eTurbo.connect(this.eTurboGain);
    this.eTurbo2.connect(t2);
    t2.connect(this.eTurboGain);
    this.eTurboGain.connect(bus);

    // ---------- VIENTO ----------
    const windSrc = noise();
    this.eWindBP = ctx.createBiquadFilter();
    this.eWindBP.type = 'bandpass';
    this.eWindBP.frequency.setValueAtTime(800, now);
    this.eWindBP.Q.setValueAtTime(0.55, now);
    this.eWindGain = ctx.createGain();
    this.eWindGain.gain.setValueAtTime(0, now);
    windSrc.connect(this.eWindBP);
    this.eWindBP.connect(this.eWindGain);
    this.eWindGain.connect(bus);

    // ---------- RODADURA / NEUMATICOS ----------
    const roadSrc = noise();
    const roadLP = ctx.createBiquadFilter();
    roadLP.type = 'lowpass';
    roadLP.frequency.setValueAtTime(520, now);
    this.eRoadGain = ctx.createGain();
    this.eRoadGain.gain.setValueAtTime(0, now);
    roadSrc.connect(roadLP);
    roadLP.connect(this.eRoadGain);
    this.eRoadGain.connect(bus);

    // ---------- NITRO (rugido + chillido distorsionado) ----------
    const nitroSrc = noise();
    this.eNitroBP = ctx.createBiquadFilter();
    this.eNitroBP.type = 'bandpass';
    this.eNitroBP.frequency.setValueAtTime(1500, now);
    this.eNitroBP.Q.setValueAtTime(0.8, now);
    this.eNitroNoiseGain = ctx.createGain();
    this.eNitroNoiseGain.gain.setValueAtTime(0, now);
    nitroSrc.connect(this.eNitroBP);
    this.eNitroBP.connect(this.eNitroNoiseGain);
    this.eNitroNoiseGain.connect(bus);

    this.eNitroOsc = osc('sawtooth', 120);
    const nShaper = ctx.createWaveShaper();
    nShaper.curve = this.makeDistortionCurve(60);
    const nLP = ctx.createBiquadFilter();
    nLP.type = 'lowpass';
    nLP.frequency.setValueAtTime(2600, now);
    this.eNitroOscGain = ctx.createGain();
    this.eNitroOscGain.gain.setValueAtTime(0, now);
    this.eNitroOsc.connect(nShaper);
    nShaper.connect(nLP);
    nLP.connect(this.eNitroOscGain);
    this.eNitroOscGain.connect(bus);

    this.engineSources.forEach((s) => {
      try { s.start(now, s.buffer ? Math.random() * 1.6 : 0); } catch (e) {}
    });
    // los osciladores ignoran el 2.o argumento (offset) y arrancan normal
    this.engineRunning = true;
    this.lastLoopTime = performance.now();

    const runLoop = () => {
      if (!this.engineRunning) return;
      this.updateEnginePhysics();
      this.engineAnimFrame = requestAnimationFrame(runLoop);
    };
    this.engineAnimFrame = requestAnimationFrame(runLoop);
  }

  updateEnginePhysics() {
    if (!this.engineRunning || !this.ctx || !this.eOsc1) return;

    const nowPerf = performance.now();
    const dt = Math.min(0.1, (nowPerf - this.lastLoopTime) / 1000);
    this.lastLoopTime = nowPerf;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // El nitro empuja la velocidad percibida
    this.nitroLevel += (this.nitroTarget - this.nitroLevel) * Math.min(1, dt * 5);
    const targetKmH = Math.max(0, this.targetWpm * 1.6) * (1 + 0.3 * this.nitroLevel);

    // Inercia del vehiculo
    const accelRate = targetKmH > this.currentSpeed ? 3.2 : 1.8;
    this.currentSpeed += (targetKmH - this.currentSpeed) * Math.min(1, dt * accelRate);

    // Caja de 5 marchas
    let targetGear = 1;
    let minSpd = 0, maxSpd = 30, minRpm = 950, maxRpm = 4600;
    if (this.currentSpeed > 130) { targetGear = 5; minSpd = 130; maxSpd = 240; minRpm = 3000; maxRpm = 6200; }
    else if (this.currentSpeed > 88) { targetGear = 4; minSpd = 88; maxSpd = 140; minRpm = 2700; maxRpm = 5800; }
    else if (this.currentSpeed > 52) { targetGear = 3; minSpd = 52; maxSpd = 98; minRpm = 2500; maxRpm = 5500; }
    else if (this.currentSpeed > 24) { targetGear = 2; minSpd = 24; maxSpd = 60; minRpm = 2300; maxRpm = 5200; }

    if (targetGear !== this.currentGear && this.currentSpeed > 15) {
      const isUpshift = targetGear > this.currentGear;
      this.currentGear = targetGear;
      this.isShifting = true;
      this.shiftStartTime = nowPerf;
      this.playGearShiftSound(targetGear, isUpshift);
    }

    const ratio = Math.max(0, Math.min(1, (this.currentSpeed - minSpd) / (maxSpd - minSpd)));
    let rpm = minRpm + Math.pow(ratio, 1.1) * (maxRpm - minRpm) + 500 * this.nitroLevel * ratio;

    if (this.isShifting) {
      const el = nowPerf - this.shiftStartTime;
      if (el < 90) rpm *= 0.76; // corte de embrague
      else this.isShifting = false;
    }

    const inertia = targetKmH > this.currentSpeed ? 5 : 2.6;
    this.currentRpm += (rpm - this.currentRpm) * Math.min(1, dt * inertia);

    // Acelerador y presion de turbo
    this.throttle = Math.max(0, this.throttle - dt * 1.7);
    const boostTarget = Math.min(1, this.throttle * (0.35 + this.currentSpeed / 140)) + this.nitroLevel * 0.5;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * (boostTarget > this.boost ? 3 : 6));

    // Soltar el acelerador a presion: blow-off y chasquidos de escape
    if (this.prevThrottle > 0.7 && this.throttle < 0.45 && this.boost > 0.35) this.playBlowOff();
    if (this.currentRpm > 2800 && this.throttle < 0.2 && this.currentSpeed > 40 &&
        Math.random() < dt * 4 && t - this.lastPopTime > 0.09) {
      this.lastPopTime = t;
      this.playExhaustPop(0.5 + Math.random() * 0.5);
    }
    this.prevThrottle = this.throttle;

    // ---------- Aplicar parametros ----------
    const fire = Math.max(24, (this.currentRpm / 60) * 2);
    const tc = 0.035;
    this.eOsc1.frequency.setTargetAtTime(fire, t, tc);
    this.eOsc2.frequency.setTargetAtTime(fire * 0.5, t, tc);
    this.eOsc3.frequency.setTargetAtTime(fire * 2.006, t, tc);
    this.ePulse.frequency.setTargetAtTime(fire, t, tc);

    const rpmN = Math.min(1, this.currentRpm / 6200);
    // El lope solo se nota al ralenti
    this.eLopeGain.gain.setTargetAtTime(Math.max(0, 1.8 * (1 - rpmN * 2.2)), t, 0.1);
    this.eLope.frequency.setTargetAtTime(5.5 + rpmN * 3, t, 0.2);

    // Brillo del motor: sube con rpm y con acelerador
    const cutoff = 520 + rpmN * 2600 + this.throttle * 900 + this.nitroLevel * 700;
    this.eLowpass.frequency.setTargetAtTime(cutoff, t, 0.05);
    this.eExhaustPeak.frequency.setTargetAtTime(110 + rpmN * 170, t, 0.08);
    this.eIntakePeak.frequency.setTargetAtTime(700 + rpmN * 1500, t, 0.08);

    const core = this.isMuted ? 0 : 0.085 + rpmN * 0.07 + this.throttle * 0.05 + this.nitroLevel * 0.03;
    this.eCoreGain.gain.setTargetAtTime(core, t, 0.05);
    this.eRumbleOut.gain.setTargetAtTime(0.13 + this.throttle * 0.1 - rpmN * 0.05, t, 0.08);

    this.eIntakeBP.frequency.setTargetAtTime(900 + rpmN * 2400, t, 0.1);
    this.eIntakeGain.gain.setTargetAtTime(this.throttle * (0.012 + rpmN * 0.03), t, 0.06);

    // Turbo: silbido de 2 a 7 kHz segun presion
    this.eTurbo.frequency.setTargetAtTime(1900 + this.boost * 5200, t, 0.08);
    this.eTurbo2.frequency.setTargetAtTime((1900 + this.boost * 5200) * 2.01, t, 0.08);
    this.eTurboGain.gain.setTargetAtTime(Math.max(0, this.boost - 0.12) * 0.022, t, 0.1);

    // Viento y rodadura
    const spdN = Math.min(1.4, this.currentSpeed / 200);
    this.eWindBP.frequency.setTargetAtTime(600 + spdN * 2400, t, 0.15);
    this.eWindGain.gain.setTargetAtTime(Math.pow(spdN, 1.6) * 0.2, t, 0.12);
    this.eRoadGain.gain.setTargetAtTime(Math.min(1, this.currentSpeed / 60) * 0.045 + spdN * 0.05, t, 0.12);

    // Nitro
    this.eNitroOsc.frequency.setTargetAtTime(fire * 3 + 90, t, tc);
    this.eNitroBP.frequency.setTargetAtTime(1400 + this.nitroLevel * 1600, t, 0.1);
    this.eNitroNoiseGain.gain.setTargetAtTime(this.nitroLevel * 0.1, t, 0.08);
    this.eNitroOscGain.gain.setTargetAtTime(this.nitroLevel * 0.035, t, 0.08);
  }

  updateEngineSpeed(wpm) {
    this.targetWpm = Math.max(0, wpm);
    if (wpm > 0) this.throttle = 1.0; // cada tecla pisa el acelerador
  }

  stopEngine() {
    if (!this.engineRunning) return;
    if (this.engineAnimFrame) {
      cancelAnimationFrame(this.engineAnimFrame);
      this.engineAnimFrame = null;
    }
    const t = this.ctx ? this.ctx.currentTime : 0;
    if (this.engineBus && this.ctx) this.engineBus.gain.setTargetAtTime(0, t, 0.08);
    this.engineRunning = false;

    const sources = this.engineSources || [];
    const bus = this.engineBus;
    this.engineSources = [];
    this.eOsc1 = null; // detiene updateEnginePhysics
    setTimeout(() => {
      sources.forEach((s) => { try { s.stop(); } catch (e) {} });
      try { if (bus) bus.disconnect(); } catch (e) {}
    }, 400);
  }

  // ==========================================
  // NITRO: ignicion y cierre
  // ==========================================
  setNitro(active) {
    this.nitroTarget = active ? 1 : 0;
    if (!this.ctx || this.isMuted) return;
    this.init();
    if (active) this.playNitroIgnite();
    else this.playNitroEnd();
  }

  playNitroIgnite() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Golpe grave al encender
    const boom = ctx.createOscillator();
    const boomG = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, now);
    boom.frequency.exponentialRampToValueAtTime(34, now + 0.5);
    boomG.gain.setValueAtTime(0.0001, now);
    boomG.gain.exponentialRampToValueAtTime(0.5, now + 0.015);
    boomG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    boom.connect(boomG).connect(this.masterGain);
    boom.start(now); boom.stop(now + 0.6);

    // Whoosh de aire barriendo hacia arriba
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.1, now);
    bp.frequency.setValueAtTime(350, now);
    bp.frequency.exponentialRampToValueAtTime(5200, now + 0.55);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.4, now + 0.12);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    src.connect(bp).connect(ng).connect(this.masterGain);
    src.start(now, Math.random() * 1.2); src.stop(now + 0.85);

    // Spool-up del turbo
    const riser = ctx.createOscillator();
    const rg = ctx.createGain();
    riser.type = 'sawtooth';
    riser.frequency.setValueAtTime(260, now);
    riser.frequency.exponentialRampToValueAtTime(2200, now + 0.6);
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.setValueAtTime(1800, now);
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.exponentialRampToValueAtTime(0.07, now + 0.35);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    riser.connect(rlp).connect(rg).connect(this.masterGain);
    riser.start(now); riser.stop(now + 0.8);

    // "Click" de valvula
    this.playExhaustPop(1);
  }

  playNitroEnd() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Escape de presion
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.9, now);
    bp.frequency.setValueAtTime(6000, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    src.connect(bp).connect(g).connect(this.masterGain);
    src.start(now, Math.random() * 1.2); src.stop(now + 0.7);
    // Chasquidos
    [0.05, 0.13, 0.22, 0.34].forEach((d, i) => {
      setTimeout(() => this.playExhaustPop(0.9 - i * 0.15), d * 1000);
    });
  }

  // Valvula blow-off del turbo al soltar
  playBlowOff() {
    if (this.isMuted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.4, now);
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(bp).connect(g).connect(this.masterGain);
    src.start(now, Math.random() * 1.2); src.stop(now + 0.4);

    const chirp = ctx.createOscillator();
    const cg = ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(2600, now);
    chirp.frequency.exponentialRampToValueAtTime(900, now + 0.3);
    cg.gain.setValueAtTime(0.0001, now);
    cg.gain.exponentialRampToValueAtTime(0.025, now + 0.02);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    chirp.connect(cg).connect(this.masterGain);
    chirp.start(now); chirp.stop(now + 0.34);
  }

  // Chasquido corto de escape (backfire)
  playExhaustPop(intensity = 1) {
    if (this.isMuted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.2, now);
    bp.frequency.setValueAtTime(500 + Math.random() * 600, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * intensity, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(bp).connect(g).connect(this.masterGain);
    src.start(now, Math.random() * 1.5); src.stop(now + 0.07);

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.06);
    tg.gain.setValueAtTime(0.12 * intensity, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    thump.connect(tg).connect(this.masterGain);
    thump.start(now); thump.stop(now + 0.08);
  }

  // ==========================================
  // PASADAS (postes, porticos): whoosh con barrido tipo Doppler y paneo estereo
  // ==========================================
  playPassBy({ kind = 'pole', side = 1, speed = 20 } = {}) {
    if (this.isMuted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - this.lastPassTime < 0.07) return;
    this.lastPassTime = now;

    const intensity = Math.min(1.3, speed / 55);
    if (intensity < 0.15) return;
    const isGantry = kind === 'gantry' || kind === 'finish';
    const dur = isGantry ? 0.75 : 0.32;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(isGantry ? 0.7 : 1.1, now);
    // Doppler: agudo al acercarse, cae al alejarse
    const f0 = isGantry ? 900 : 1500;
    bp.frequency.setValueAtTime(f0, now);
    bp.frequency.exponentialRampToValueAtTime(f0 * 2.3, now + dur * 0.4);
    bp.frequency.exponentialRampToValueAtTime(f0 * 0.3, now + dur);

    const g = ctx.createGain();
    const peak = (isGantry ? 0.2 : 0.07) * intensity;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.38);
    g.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    let out = g;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(side * 0.35, now);
      pan.pan.linearRampToValueAtTime(side * 0.95, now + dur);
      g.connect(pan);
      out = pan;
    }
    src.connect(bp).connect(g);
    out.connect(this.masterGain);
    src.start(now, Math.random() * 1.4);
    src.stop(now + dur + 0.05);

    if (isGantry) {
      // Golpe de presion al pasar bajo la estructura
      const th = ctx.createOscillator();
      const tg = ctx.createGain();
      th.type = 'sine';
      th.frequency.setValueAtTime(90, now + dur * 0.3);
      th.frequency.exponentialRampToValueAtTime(40, now + dur * 0.6);
      tg.gain.setValueAtTime(0.0001, now + dur * 0.3);
      tg.gain.exponentialRampToValueAtTime(0.12 * intensity, now + dur * 0.36);
      tg.gain.exponentialRampToValueAtTime(0.0005, now + dur * 0.65);
      th.connect(tg).connect(this.masterGain);
      th.start(now + dur * 0.3); th.stop(now + dur * 0.7);
    }
  }

  // ==========================================
  // META: bocina, publico y barrido
  // ==========================================
  playFinishLine() {
    if (this.isMuted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Bocina de aire (dos tonos desafinados distorsionados)
    const horn = ctx.createGain();
    horn.gain.setValueAtTime(0.0001, now);
    horn.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
    horn.gain.setValueAtTime(0.16, now + 0.9);
    horn.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    const sh = ctx.createWaveShaper();
    sh.curve = this.makeDistortionCurve(25);
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.setValueAtTime(2400, now);
    [415.3, 523.25, 622.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * (1 + i * 0.002), now);
      const og = ctx.createGain();
      og.gain.setValueAtTime(i === 2 ? 0.3 : 0.5, now);
      o.connect(og).connect(sh);
      o.start(now); o.stop(now + 1.35);
    });
    sh.connect(hlp).connect(horn).connect(this.masterGain);

    // Publico: ruido que crece, con aplausos (envolvente irregular)
    const crowd = ctx.createBufferSource();
    crowd.buffer = this.noiseBuffer;
    crowd.loop = true;
    const cbp = ctx.createBiquadFilter();
    cbp.type = 'bandpass';
    cbp.frequency.setValueAtTime(1100, now);
    cbp.Q.setValueAtTime(0.4, now);
    const cg = ctx.createGain();
    const n = 80;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const swell = Math.min(1, x / 0.15) * Math.pow(1 - Math.max(0, (x - 0.55) / 0.45), 1.5);
      env[i] = swell * (0.07 + Math.random() * 0.09);
    }
    cg.gain.setValueCurveAtTime(env, now + 0.25, 4.5);
    crowd.connect(cbp).connect(cg).connect(this.masterGain);
    crowd.start(now + 0.25, Math.random() * 1.2);
    crowd.stop(now + 4.8);

    // Barrido ascendente de celebracion
    const sw = ctx.createOscillator();
    const swg = ctx.createGain();
    sw.type = 'triangle';
    sw.frequency.setValueAtTime(500, now + 0.1);
    sw.frequency.exponentialRampToValueAtTime(1600, now + 0.7);
    swg.gain.setValueAtTime(0.0001, now + 0.1);
    swg.gain.exponentialRampToValueAtTime(0.07, now + 0.3);
    swg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    sw.connect(swg).connect(this.masterGain);
    sw.start(now + 0.1); sw.stop(now + 0.85);
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


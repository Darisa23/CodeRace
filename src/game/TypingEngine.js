// TypingEngine.js - Handles character validation, WPM math, 5-block progression

// Relleno del textarea oculto (permite detectar Backspace en teclados virtuales)
const INPUT_PAD = '  ';

// NITRO: racha de teclas correctas sin error que carga la barra; al llenarse se activa unos segundos
const NITRO_STREAK = 30;
const NITRO_DURATION_MS = 3500;

export class TypingEngine {
  constructor(options = {}) {
    this.containerEl = options.containerEl;
    this.onCharacterTyped = options.onCharacterTyped || (() => {});
    this.onBlockCompleted = options.onBlockCompleted || (() => {});
    this.onRaceCompleted = options.onRaceCompleted || (() => {});
    this.onError = options.onError || (() => {});
    this.onTimeUp = options.onTimeUp || (() => {}); // NUEVO: callback cuando se acaba el tiempo límite
    this.onBackspace = options.onBackspace || (() => {});
    this.onNitroChange = options.onNitroChange || (() => {}); // { active, charge }

    this.snippetSet = null;
    this.currentBlockIndex = 0; // 0 to 4
    this.codeText = "";
    this.cursorIndex = 0;

    // Stats
    this.totalCorrectChars = 0;
    this.totalKeystrokes = 0;
    this.errorCount = 0;
    this.startTime = null;
    this.lastTypedTime = null;
    this.currentWPM = 0;
    this.peakWPM = 0;
    this.accuracy = 100;
    this.isActive = false;

    this.hasErrorState = false;
    this.autoChars = new Set();
    this.nitroToggle = false;

    // Nitro
    this.streak = 0;
    this.nitroActive = false;
    this.nitroTimer = null;

    // NUEVO: límite de tiempo de la carrera (por defecto 5 minutos)
    this.timeLimitMs = options.timeLimitMs || 5 * 60 * 1000;
    this.timeLimitTimer = null;

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.focusInput = this.focusInput.bind(this);
    this.handleInputBlur = this.handleInputBlur.bind(this);

    // Entrada móvil: textarea oculto que abre el teclado virtual
    this.inputEl = null;
    this.lastInputValue = '';
    this.onInputFocusChange = options.onInputFocusChange || (() => {});
  }

  // Crea (una sola vez) el textarea oculto que captura el teclado virtual del móvil.
  // En Android el keydown llega como 'Unidentified' (keyCode 229), así que se lee el texto con el evento 'input'.
  ensureInputEl() {
    if (this.inputEl) return;
    const el = document.createElement('textarea');
    el.id = 'mobile-input';
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('enterkeyhint', 'enter');
    el.setAttribute('aria-label', 'Entrada de código');
    el.rows = 1;
    document.body.appendChild(el);
    this.inputEl = el;
  }

  focusInput() {
    if (!this.isActive || !this.inputEl) return;
    try { this.inputEl.focus({ preventScroll: true }); } catch (_) { this.inputEl.focus(); }
  }

  handleInputBlur() {
    this.onInputFocusChange(false);
  }

  // Procesa cambios del textarea comparando con el valor anterior (robusto ante autocorrección/composición)
  handleInput(e) {
    if (!this.isActive) return;
    const value = this.inputEl.value;
    const prev = this.lastInputValue;

    let cp = 0;
    const max = Math.min(prev.length, value.length);
    while (cp < max && prev[cp] === value[cp]) cp++;

    const removed = prev.length - cp;
    const added = value.slice(cp);
    this.lastInputValue = value;

    for (let i = 0; i < removed; i++) this.processTypedKey('Backspace');
    for (const ch of added) {
      if (!this.isActive) break;
      this.processTypedKey(ch === '\n' ? 'Enter' : ch);
    }

    // Sin composición activa: mantener el relleno entre 2 y 12 caracteres para que
    // Backspace siempre tenga algo que borrar (si no, el móvil no dispara ningún evento)
    if (!(e && e.isComposing) && (value.length > 12 || value.length < INPUT_PAD.length)) {
      this.resetInput();
    }
  }

  resetInput() {
    if (this.inputEl) {
      this.inputEl.value = INPUT_PAD;
      try { this.inputEl.setSelectionRange(INPUT_PAD.length, INPUT_PAD.length); } catch (_) {}
    }
    this.lastInputValue = INPUT_PAD;
  }

  startRace(snippetSet) {
    this.snippetSet = snippetSet;
    this.currentBlockIndex = 0;
    this.totalCorrectChars = 0;
    this.totalKeystrokes = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
    this.lastTypedTime = Date.now();
    this.currentWPM = 0;
    this.peakWPM = 0;
    this.accuracy = 100;
    this.isActive = true;
    this.streak = 0;
    this.setNitro(false);

    this.loadBlock(0);
    window.addEventListener('keydown', this.handleKeyDown);

    this.ensureInputEl();
    this.resetInput();
    this.inputEl.addEventListener('input', this.handleInput);
    this.inputEl.addEventListener('blur', this.handleInputBlur);
    this.inputEl.addEventListener('focus', () => this.onInputFocusChange(true));
    // Cualquier toque durante la carrera devuelve el foco (y el teclado) al campo de entrada.
    // Se usa 'click' (último evento de la secuencia táctil): con 'pointerup' el mousedown posterior
    // sobre el canvas quitaba el foco y el teclado se cerraba de inmediato.
    document.addEventListener('click', this.focusInput);
    this.focusInput();

    // NUEVO: arranca el contador de límite de tiempo
    this.timeLimitTimer = setTimeout(() => this.handleTimeUp(), this.timeLimitMs);
  }

  stop() {
    this.isActive = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.focusInput);
    if (this.inputEl) {
      this.inputEl.removeEventListener('input', this.handleInput);
      this.inputEl.removeEventListener('blur', this.handleInputBlur);
      this.inputEl.blur();
      this.resetInput();
    }

    this.setNitro(false);

    // NUEVO: limpiar el timer de límite de tiempo si sigue activo
    if (this.timeLimitTimer) {
      clearTimeout(this.timeLimitTimer);
      this.timeLimitTimer = null;
    }
  }

  loadBlock(blockIndex) {
    if (!this.snippetSet || blockIndex >= this.snippetSet.blocks.length) return;

    this.currentBlockIndex = blockIndex;
    this.codeText = this.snippetSet.blocks[blockIndex].code;
    this.cursorIndex = 0;
    this.hasErrorState = false;
    this.spans = null; // fuerza reconstruir los <span> del bloque nuevo
    this.autoChars = new Set(); // letras que completó el nitro en este bloque
    this.nitroToggle = false;

    this.renderCodeDisplay();
  }

  renderCodeDisplay() {
    if (!this.containerEl) return;

    // Los <span> se crean una sola vez por bloque; después solo se actualizan las clases cambiadas
    if (this.spansText !== this.codeText || !this.spans) {
      this.containerEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      this.spans = [];
      this.spanClass = [];
      for (let i = 0; i < this.codeText.length; i++) {
        const char = this.codeText[i];
        const charSpan = document.createElement('span');
        if (char === '\n') {
          charSpan.innerHTML = '↵\n';
        } else if (char === ' ') {
          charSpan.innerHTML = '&nbsp;';
        } else {
          charSpan.textContent = char;
        }
        this.spans.push(charSpan);
        this.spanClass.push('');
        frag.appendChild(charSpan);
      }
      this.containerEl.appendChild(frag);
      this.spansText = this.codeText;
    }

    for (let i = 0; i < this.spans.length; i++) {
      let cls;
      if (i < this.cursorIndex) cls = this.autoChars.has(i) ? 'char-correct char-nitro' : 'char-correct';
      else if (i === this.cursorIndex) cls = this.hasErrorState ? 'char-error char-cursor' : 'char-pending char-cursor';
      else cls = 'char-pending';
      if (this.spanClass[i] !== cls) {
        this.spans[i].className = cls;
        this.spanClass[i] = cls;
      }
    }

    // Scroll active cursor into view
    // (scroll manual del contenedor: scrollIntoView movía toda la página al abrir el teclado móvil)
    const activeSpan = this.spans[this.cursorIndex] || null;
    if (activeSpan) {
      const c = this.containerEl;
      const top = activeSpan.offsetTop;
      const bottom = top + activeSpan.offsetHeight;
      if (top < c.scrollTop) c.scrollTop = top;
      else if (bottom > c.scrollTop + c.clientHeight) c.scrollTop = bottom - c.clientHeight;
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;

    // Detect AltGr state (Windows AltGr sets e.altKey & e.ctrlKey, or getModifierState('AltGraph'))
    const isAltGraph = e.altKey || (typeof e.getModifierState === 'function' && e.getModifierState('AltGraph'));

    // Allow browser shortcuts (like Ctrl+R, Ctrl+C, Cmd+R, Cmd+C) when Ctrl/Cmd is pressed without AltGr
    if ((e.ctrlKey || e.metaKey) && !isAltGraph) {
      return;
    }

    // Ignore non-printable/modifier/navigation/dead keys (e.key.length > 1 or 'Dead' / 'Unidentified'),
    // EXCEPT for 'Enter' (maps to newline) and 'Backspace' (clears error state).
    if (e.key !== 'Enter' && e.key !== 'Backspace' && (e.key.length > 1 || e.key === 'Dead' || e.key === 'Unidentified')) {
      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent tab focus switch
      }
      return;
    }

    e.preventDefault();
    // El teclado físico ya se procesó: evitar que el textarea acumule texto
    this.resetInput();

    this.processTypedKey(e.key);
  }

  // Lógica común (teclado físico y teclado virtual). key: carácter, 'Enter' o 'Backspace'
  processTypedKey(key) {
    if (!this.isActive) return;

    // Handle Backspace
    if (key === 'Backspace') {
      if (this.hasErrorState) {
        this.hasErrorState = false;
        this.renderCodeDisplay();
        this.onBackspace();
      }
      return;
    }

    let typedKey = key;

    // Map Enter key to newline
    if (key === 'Enter') {
      typedKey = '\n';
    }

    const expectedChar = this.codeText[this.cursorIndex];
    this.totalKeystrokes++;
    const now = Date.now();
    this.lastTypedTime = now;

    // Check key correctness
    // Un fallo marca la letra en rojo y no avanza; basta pulsar la tecla correcta para continuar
    // (no hace falta Backspace). Mientras tanto no hay tracción: el coche solo rueda por inercia.
    if (typedKey === expectedChar) {
      // Correct keystroke!
      this.totalCorrectChars++;
      this.cursorIndex++;
      this.hasErrorState = false;
      this.autoIndent();

      // NITRO activo: una de cada dos teclas correctas completa además un carácter (x1.5).
      // Nunca salta un Enter ni el último carácter del bloque (la última tecla siempre es real, así la
      // meta se cruza justo al escribir la última letra). Las letras completadas se marcan aparte.
      if (this.nitroActive &&
          this.cursorIndex < this.codeText.length - 1 &&
          this.codeText[this.cursorIndex] !== '\n') {
        this.nitroToggle = !this.nitroToggle;
        if (this.nitroToggle) {
          this.autoChars.add(this.cursorIndex);
          this.cursorIndex++;
          this.totalCorrectChars++;
          this.autoIndent();
        }
      }

      // Racha para cargar el nitro
      this.streak++;
      if (!this.nitroActive && this.streak >= NITRO_STREAK) {
        this.streak = 0;
        this.setNitro(true);
      }

      this.updateStats();
      this.renderCodeDisplay();

      const keyType = typedKey === ' ' ? 'space' : (typedKey === '\n' ? 'enter' : 'default');

      this.onCharacterTyped({
        wpm: this.currentWPM,
        accuracy: this.accuracy,
        cursorIndex: this.cursorIndex,
        blockProgress: this.cursorIndex / this.codeText.length,
        totalProgressPercent: this.getTotalRaceProgressPercent(),
        nitroActive: this.nitroActive,
        nitroCharge: this.getNitroCharge(),
        keyType
      });

      // Check if current block is finished
      if (this.cursorIndex >= this.codeText.length) {
        const nextBlock = this.currentBlockIndex + 1;
        this.onBlockCompleted(this.currentBlockIndex, nextBlock);

        if (nextBlock < this.snippetSet.blocks.length) {
          this.loadBlock(nextBlock);
        } else {
          // RACE COMPLETED (Completed all 5 blocks!)
          this.stop();
          this.onRaceCompleted({
            completed: true, // NUEVO: terminó la carrera completa antes del límite de tiempo
            totalTimeMs: Date.now() - this.startTime,
            wpm: this.currentWPM,
            peakWPM: this.peakWPM,
            accuracy: this.accuracy,
            errorCount: this.errorCount,
            totalProgressPercent: 100 // NUEVO: para comparar de forma consistente con onTimeUp
          });
        }
      }
    } else {
      // Error keystroke!
      const wasInError = this.hasErrorState;
      this.hasErrorState = true;
      this.errorCount++;
      if (this.streak > 0) {
        this.streak = 0;
        this.onNitroChange({ active: this.nitroActive, charge: 0 });
      }
      this.updateStats();
      if (!wasInError) this.renderCodeDisplay();
      this.onError();
    }
  }

  // Smart auto-indent: tras un salto de linea, los espacios siguientes se avanzan solos
  autoIndent() {
    while (this.cursorIndex < this.codeText.length &&
           this.codeText[this.cursorIndex - 1] === '\n' &&
           this.codeText[this.cursorIndex] === ' ') {
      this.cursorIndex++;
      this.totalCorrectChars++;
    }
  }

  getNitroCharge() {
    return this.nitroActive ? 1 : Math.min(1, this.streak / NITRO_STREAK);
  }

  setNitro(active) {
    if (this.nitroTimer) {
      clearTimeout(this.nitroTimer);
      this.nitroTimer = null;
    }
    const changed = this.nitroActive !== active;
    this.nitroActive = active;
    if (active) {
      this.nitroTimer = setTimeout(() => {
        this.nitroTimer = null;
        this.setNitro(false);
      }, NITRO_DURATION_MS);
    }
    if (changed) {
      this.onNitroChange({ active, charge: active ? 1 : 0, durationMs: NITRO_DURATION_MS });
    }
  }

  updateStats() {
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    if (elapsedMinutes > 0) {
      // Standard WPM = (all correct characters / 5) / elapsed minutes
      this.currentWPM = Math.round((this.totalCorrectChars / 5) / elapsedMinutes);
      if (this.currentWPM > this.peakWPM) {
        this.peakWPM = this.currentWPM;
      }
    }

    if (this.totalKeystrokes > 0) {
      this.accuracy = Math.max(0, Math.round(((this.totalKeystrokes - this.errorCount) / this.totalKeystrokes) * 100));
    }
  }

  // Check if player hasn't typed for > 1.2s -> decay speed/WPM
  getEffectiveSpeed() {
    if (!this.isActive || this.hasErrorState) return 0;
    const timeSinceLastKey = Date.now() - (this.lastTypedTime || Date.now());

    // Stop car if idle for > 1.5 seconds or in error state
    if (timeSinceLastKey > 1500) {
      return 0;
    } else if (timeSinceLastKey > 600) {
      // Smooth decay
      const factor = 1 - ((timeSinceLastKey - 600) / 900);
      return Math.max(0, Math.round(this.currentWPM * factor));
    }

    return this.currentWPM;
  }

  getTotalRaceProgressPercent() {
    if (!this.snippetSet) return 0;
    const blockWeight = 1 / this.snippetSet.blocks.length; // 20% per block
    const completedBlocksRatio = this.currentBlockIndex * blockWeight;
    const currentBlockRatio = (this.cursorIndex / this.codeText.length) * blockWeight;
    return Math.min(100, (completedBlocksRatio + currentBlockRatio) * 100);
  }

  // NUEVO: se dispara cuando se agota el timeLimitMs sin haber completado la carrera
  handleTimeUp() {
    if (!this.isActive) return; // ya terminó por otra vía (ej. completó los 5 bloques), no hacer nada

    this.stop();

    this.onTimeUp({
      completed: false, // no llegó a terminar los 5 bloques
      totalTimeMs: this.timeLimitMs,
      wpm: this.currentWPM,
      peakWPM: this.peakWPM,
      accuracy: this.accuracy,
      errorCount: this.errorCount,
      totalProgressPercent: this.getTotalRaceProgressPercent() // clave para desempatar por quién llegó más lejos
    });
  }
}

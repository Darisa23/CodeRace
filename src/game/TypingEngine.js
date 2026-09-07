// TypingEngine.js - Handles character validation, WPM math, 5-block progression

export class TypingEngine {
  constructor(options = {}) {
    this.containerEl = options.containerEl;
    this.onCharacterTyped = options.onCharacterTyped || (() => {});
    this.onBlockCompleted = options.onBlockCompleted || (() => {});
    this.onRaceCompleted = options.onRaceCompleted || (() => {});
    this.onError = options.onError || (() => {});

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

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
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

    this.loadBlock(0);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  stop() {
    this.isActive = false;
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  loadBlock(blockIndex) {
    if (!this.snippetSet || blockIndex >= this.snippetSet.blocks.length) return;
    
    this.currentBlockIndex = blockIndex;
    this.codeText = this.snippetSet.blocks[blockIndex].code;
    this.cursorIndex = 0;
    this.hasErrorState = false;

    this.renderCodeDisplay();
  }

  renderCodeDisplay() {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = '';
    
    // Create span for each character with status class
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

      if (i < this.cursorIndex) {
        charSpan.className = 'char-correct';
      } else if (i === this.cursorIndex) {
        if (this.hasErrorState) {
          charSpan.className = 'char-error char-cursor';
        } else {
          charSpan.className = 'char-pending char-cursor';
        }
      } else {
        charSpan.className = 'char-pending';
      }

      this.containerEl.appendChild(charSpan);
    }

    // Scroll active cursor into view
    const activeSpan = this.containerEl.querySelector('.char-cursor');
    if (activeSpan) {
      activeSpan.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;

    // Ignore modifier keys alone
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
      if (e.key === 'Tab') e.preventDefault(); // Prevent focus switch
      return;
    }

    e.preventDefault();

    const expectedChar = this.codeText[this.cursorIndex];
    this.totalKeystrokes++;
    const now = Date.now();
    this.lastTypedTime = now;

    // Handle Backspace if in error state
    if (e.key === 'Backspace') {
      if (this.hasErrorState) {
        this.hasErrorState = false;
        this.renderCodeDisplay();
      }
      return;
    }

    let typedKey = e.key;

    // Map Enter key to newline
    if (e.key === 'Enter') {
      typedKey = '\n';
    }

    // Check key correctness
    if (typedKey === expectedChar && !this.hasErrorState) {
      // Correct keystroke!
      this.totalCorrectChars++;
      this.cursorIndex++;
      this.hasErrorState = false;

      // Smart auto-indent: if next characters are whitespace after newline, auto-advance
      while (this.cursorIndex < this.codeText.length && 
             this.codeText[this.cursorIndex - 1] === '\n' && 
             this.codeText[this.cursorIndex] === ' ') {
        this.cursorIndex++;
        this.totalCorrectChars++;
      }

      this.updateStats();
      this.renderCodeDisplay();

      this.onCharacterTyped({
        wpm: this.currentWPM,
        accuracy: this.accuracy,
        cursorIndex: this.cursorIndex,
        blockProgress: this.cursorIndex / this.codeText.length,
        totalProgressPercent: this.getTotalRaceProgressPercent()
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
            totalTimeMs: Date.now() - this.startTime,
            wpm: this.currentWPM,
            peakWPM: this.peakWPM,
            accuracy: this.accuracy,
            errorCount: this.errorCount
          });
        }
      }
    } else {
      // Error keystroke!
      this.hasErrorState = true;
      this.errorCount++;
      this.updateStats();
      this.renderCodeDisplay();
      this.onError();
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
}

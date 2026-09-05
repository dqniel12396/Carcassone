// Web Audio API Sound Effects Synthesizer

class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  playTilePlace() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    
    // Wooden clack sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playTileRotate() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.06);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playMeeplePlace() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playScore() {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + (idx * 0.08);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // ==================== 6 MEDIEVAL CUSTOM TURN SOUNDS ====================

  // 1. 📯 Cuerno de Guerra Nórdico (War Horn) - Deep, resonant brassy horn
  playWarHorn() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    // Warm horn swell: F3 (174.6Hz) to A3 (220Hz)
    osc1.frequency.setValueAtTime(160, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.15);
    osc1.frequency.setValueAtTime(220, now + 0.45);
    osc1.frequency.exponentialRampToValueAtTime(175, now + 0.75);

    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(110, now + 0.15);
    osc2.frequency.setValueAtTime(110, now + 0.45);
    osc2.frequency.exponentialRampToValueAtTime(87, now + 0.75);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.75);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.12);
    gain.gain.setValueAtTime(0.45, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  }

  // 2. 🎺 Fanfarria Real de Trompetas (Royal Trumpets) - Bright castle fanfare
  playTrumpets() {
    if (!this.enabled) return;
    this.init();
    const notes = [
      { f: 392.00, t: 0, d: 0.1 },    // G4
      { f: 523.25, t: 0.1, d: 0.1 },  // C5
      { f: 659.25, t: 0.2, d: 0.12 }, // E5
      { f: 783.99, t: 0.32, d: 0.35 } // G5 (sustained)
    ];

    notes.forEach(n => {
      const now = this.ctx.currentTime + n.t;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, now);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + n.d);
    });
  }

  // 3. ⚔️ Choque de Espadas de Acero (Sword Clash) - Sharp metallic impact
  playSwordClash() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;

    // Metallic ring oscillator 1 (high ringing bell-like overtones)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2400, now);
    osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.35);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3650, now);
    osc2.frequency.exponentialRampToValueAtTime(2700, now + 0.35);

    ringGain.gain.setValueAtTime(0.35, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(ringGain);
    osc2.connect(ringGain);
    ringGain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.38);
    osc2.stop(now + 0.38);

    // Friction scrape burst (FM noise simulation)
    const noiseOsc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    noiseOsc.type = 'sawtooth';
    noiseOsc.frequency.setValueAtTime(800, now);
    noiseOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noiseOsc.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noiseOsc.start(now);
    noiseOsc.stop(now + 0.08);
  }

  // 4. 🔔 Campana de Catedral Medieval (Cathedral Bell) - Deep rich cathedral bell
  playCathedralBell() {
    if (!this.enabled) return;
    this.init();
    const freqs = [330, 440, 587, 880, 1174]; // Inharmonic strike
    const now = this.ctx.currentTime;

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      const amp = 0.25 / (i + 1);
      const decay = 0.5 + (0.4 / (i + 1));

      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + decay);
    });
  }

  // 5. 🥁 Tambores de Batalla (War Drums) - Powerful double war drum hit
  playWarDrums() {
    if (!this.enabled) return;
    this.init();
    const hits = [0, 0.14]; // Double hit

    hits.forEach((t, idx) => {
      const now = this.ctx.currentTime + t;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const baseFreq = idx === 0 ? 110 : 90;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  // 6. 🪕 Arpa / Laúd de Trovador (Bard Harp) - Swift renaissance pluck
  playBardHarp() {
    if (!this.enabled) return;
    this.init();
    const notes = [440, 554.37, 659.25, 880, 1108.73]; // A major arpeggio
    notes.forEach((f, i) => {
      const now = this.ctx.currentTime + (i * 0.05);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  // Plays chosen custom turn sound
  playTurnSound(preset) {
    const sound = preset || this.getTurnSound();
    switch (sound) {
      case 'horn': this.playWarHorn(); break;
      case 'trumpets': this.playTrumpets(); break;
      case 'sword': this.playSwordClash(); break;
      case 'bell': this.playCathedralBell(); break;
      case 'drums': this.playWarDrums(); break;
      case 'harp': this.playBardHarp(); break;
      default: this.playTrumpets(); break;
    }
  }

  getTurnSound() {
    try {
      return localStorage.getItem('carcassonne_turn_sound') || 'horn';
    } catch (_) {
      return 'horn';
    }
  }

  setTurnSound(preset) {
    try {
      localStorage.setItem('carcassonne_turn_sound', preset);
    } catch (_) {}
  }

  toggleSound() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('carcassonne_sound_enabled', this.enabled ? '1' : '0');
    } catch (e) {}
    this.updateSoundButtons();
    if (this.enabled) {
      this.playClick();
    }
    return this.enabled;
  }

  updateSoundButtons() {
    const btns = document.querySelectorAll('.sound-toggle-btn');
    btns.forEach(btn => {
      btn.innerHTML = this.enabled ? '🔊 <span class="desktop-only">Sonido: ON</span>' : '🔇 <span class="desktop-only">Sonido: OFF</span>';
      btn.setAttribute('title', this.enabled ? 'Desactivar Sonido' : 'Activar Sonido');
    });
  }
}

const audio = new AudioManager();

try {
  const saved = localStorage.getItem('carcassonne_sound_enabled');
  if (saved !== null) {
    audio.enabled = saved === '1';
  }
} catch (e) {}

document.addEventListener('DOMContentLoaded', () => {
  audio.updateSoundButtons();
  document.addEventListener('click', (e) => {
    if (e.target && (e.target.classList.contains('sound-toggle-btn') || e.target.closest('.sound-toggle-btn'))) {
      e.preventDefault();
      audio.toggleSound();
    }
  });
});


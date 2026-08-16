/**
 * Mediarca Audio Synthesizer
 * Generates hospital-grade digital chimes and queue call alerts using Web Audio API
 */
class MediarcaAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playChime(type = 'queue-call') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      if (type === 'queue-call') {
        // Modern 2-tone hospital ding-dong (F5 -> C5)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        // Tone 1: 698.46 Hz (F5)
        osc1.frequency.setValueAtTime(698.46, now);
        // Tone 2: 523.25 Hz (C5) after 0.28s
        osc1.frequency.setValueAtTime(523.25, now + 0.28);

        osc2.frequency.setValueAtTime(698.46, now);
        osc2.frequency.setValueAtTime(523.25, now + 0.28);

        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.9);
        osc2.stop(now + 0.9);
      } else if (type === 'success') {
        // Crisp 3-step ascending chime (C5 -> E5 -> G5)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + i * 0.08;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.01, t);
          gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.4);
        });
      }
    } catch (e) {
      console.warn('Audio playback not permitted yet:', e);
    }
  }
}

window.mediarcaAudio = new MediarcaAudio();

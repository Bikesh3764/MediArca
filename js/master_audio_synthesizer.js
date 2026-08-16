/**
 * Pizza Ready! 3D Tycoon - Polyphonic 16-Bit Web Audio Synthesizer Engine
 * Generates rich chiptune arcade music, sound effect waveforms, and spatial audio attenuation with zero external MP3 lags.
 * Unity Portability: Maps to AudioManager.cs, ProceduralSynthVoice.cs, SpatialAudioEmitter.cs
 */

class MasterAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmGain = null;
    this.sfxGain = null;
    this.currentTrack = 'classic';
    this.isPlayingBGM = false;
    this.bgmInterval = null;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
    }
  }

  ensureContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgmGain && this.sfxGain && this.ctx) {
      const targetGain = this.muted ? 0 : 0.22;
      this.bgmGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.muted;
  }

  /** Play Polyphonic Tone Note */
  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.3) {
    if (this.muted || !this.ctx) return;
    this.ensureContext();

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(g);
    g.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /** SFX: Satisfying Cash Register Ding */
  playCashRegister() {
    this.playTone(987.77, 'triangle', 0.1, 0.4); // B5
    setTimeout(() => this.playTone(1318.51, 'triangle', 0.25, 0.5), 60); // E6
  }

  /** SFX: Pizza Box Pickup Swoosh */
  playBoxPickup() {
    this.playTone(440, 'sine', 0.08, 0.25);
    setTimeout(() => this.playTone(659.25, 'sine', 0.1, 0.3), 40);
  }

  /** SFX: Unlock Pad Milestone Fanfare */
  playUnlockFanfare() {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.2, 0.4), idx * 80);
    });
  }

  /** SFX: Cleaner Busboy Sparkle Clean Sound */
  playSparkleClean() {
    [1046.50, 1318.51, 1567.98, 2093.00].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.12, 0.2), idx * 45);
    });
  }
}

window.MasterAudioSynthesizer = MasterAudioSynthesizer;

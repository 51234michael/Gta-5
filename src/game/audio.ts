import { RadioStationId, WeaponId } from './types';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private radioStation: RadioStationId = 'off';
  private radioStep = 0;
  private radioTimer: number | null = null;
  private sirenPhase = 0;
  private muted = false;
  private sfxVolume = 0.85;
  private radioVolume = 0.75;

  public setVolumes(sfx: number, radio: number) {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.radioVolume = Math.max(0, Math.min(1, radio));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55 * this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  public unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.55 * this.sfxVolume;
      this.masterGain.connect(this.ctx.destination);
      this.initContinuousNodes();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private initContinuousNodes() {
    if (!this.ctx || !this.masterGain) return;

    // Engine oscillator
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 48;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 240;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // Police siren oscillator
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 620;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOsc.start();
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.55 * this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted() {
    return this.muted;
  }

  public playDodge() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public updateVehicleAudio(inVehicle: boolean, speedRatio: number, sirenActive: boolean, dt: number) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.sirenGain || !this.sirenOsc) return;
    const now = this.ctx.currentTime;
    if (inVehicle && !this.muted) {
      const targetFreq = 45 + Math.abs(speedRatio) * 115;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.08 + Math.abs(speedRatio) * 0.09, now, 0.08);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    if (sirenActive && !this.muted) {
      this.sirenPhase += dt * 4.2;
      const wail = 560 + Math.sin(this.sirenPhase) * 260;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.065, now, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public playWeaponSound(weapon: WeaponId) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    if (weapon === 'fists') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    // Gunfire noise burst + low punch
    const dur = weapon === 'shotgun' ? 0.24 : weapon === 'rifle' ? 0.14 : 0.11;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = weapon === 'shotgun' ? 680 : weapon === 'smg' ? 1450 : 1050;
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(weapon === 'shotgun' ? 0.42 : 0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);

    const punch = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(weapon === 'shotgun' ? 140 : 220, now);
    punch.frequency.exponentialRampToValueAtTime(42, now + 0.08);
    pGain.gain.setValueAtTime(0.22, now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    punch.connect(pGain);
    pGain.connect(this.masterGain);
    punch.start(now);
    punch.stop(now + 0.1);
  }

  public playExplosion() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = 0.75;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  public playCrash(intensity = 0.6) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    gain.gain.setValueAtTime(Math.min(0.35, intensity * 0.3), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playHorn() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.29);
    });
  }

  public playCash() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [880, 1318.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.14, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.17);
    });
  }

  public playSwitchSwoosh() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.22);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playMissionPassed() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.11);
      gain.gain.setValueAtTime(0.18, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.38);
    });
  }

  public setRadioStation(station: RadioStationId) {
    this.radioStation = station;
    if (this.radioTimer !== null) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    if (station === 'off') return;

    this.radioStep = 0;
    const tempoMs = station === 'los_solis' ? 240 : station === 'vinewood' ? 190 : 165;
    this.radioTimer = window.setInterval(() => {
      this.tickRadio();
    }, tempoMs);
  }

  private tickRadio() {
    if (!this.ctx || !this.masterGain || this.muted || this.radioStation === 'off') return;
    const now = this.ctx.currentTime;
    const step = this.radioStep % 16;
    this.radioStep++;

    let bassNotes: number[] = [];
    let leadNotes: number[] = [];
    let wave: OscillatorType = 'triangle';

    if (this.radioStation === 'los_solis') {
      bassNotes = [73.42, 0, 73.42, 87.31, 98.0, 0, 82.41, 0, 73.42, 0, 110.0, 0, 98.0, 87.31, 82.41, 0];
      leadNotes = [0, 0, 293.66, 0, 349.23, 0, 392.0, 0, 0, 440, 0, 392, 349.23, 0, 293.66, 0];
      wave = 'sine';
    } else if (this.radioStation === 'vinewood') {
      bassNotes = [65.41, 65.41, 130.81, 65.41, 77.78, 77.78, 155.56, 77.78, 87.31, 87.31, 174.61, 87.31, 98.0, 98.0, 196.0, 98.0];
      leadNotes = [523.25, 0, 622.25, 0, 587.33, 0, 523.25, 466.16, 392.0, 0, 466.16, 0, 523.25, 0, 698.46, 0];
      wave = 'sawtooth';
    } else {
      bassNotes = [82.41, 82.41, 0, 82.41, 98.0, 98.0, 0, 110.0, 82.41, 82.41, 0, 82.41, 123.47, 110.0, 98.0, 87.31];
      leadNotes = [329.63, 0, 392.0, 440.0, 0, 493.88, 440.0, 0, 329.63, 0, 392.0, 0, 523.25, 493.88, 440.0, 392.0];
      wave = 'square';
    }

    const rv = this.radioVolume;
    const b = bassNotes[step];
    if (b > 0 && rv > 0.01) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(b, now);
      g.gain.setValueAtTime(0.065 * rv, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    const l = leadNotes[step];
    if (l > 0 && rv > 0.01) {
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(l, now);
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      g.gain.setValueAtTime(0.032 * rv, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  public dispose() {
    if (this.radioTimer !== null) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundManager = new SoundManager();

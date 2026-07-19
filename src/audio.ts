class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private sfxVolume: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc1: OscillatorNode | null = null;
  private sirenOsc2: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialization on first gesture
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);

      this.sfxVolume = this.ctx.createGain();
      this.sfxVolume.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxVolume.connect(this.masterVolume);

      // Setup continuous engine sound
      this.setupEngineOsc();
      // Setup continuous siren sound
      this.setupSirenOsc();
    } catch (e) {
      console.warn("Failed to initialize Web Audio API", e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterVolume && this.ctx) {
      this.masterVolume.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  private setupEngineOsc() {
    if (!this.ctx || !this.sfxVolume) return;
    
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, this.ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime); // start quiet

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    osc.start();

    this.engineOsc = osc;
    this.engineGain = gain;
  }

  public setEngineSound(active: boolean, speedRatio: number = 0) {
    this.resume();
    if (!this.engineGain || !this.engineOsc || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    if (active) {
      // Scale engine sound volume and pitch
      const targetGain = 0.08 + speedRatio * 0.07;
      const targetFreq = 45 + speedRatio * 130;
      
      this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
    } else {
      this.engineGain.gain.setTargetAtTime(0, t, 0.15);
    }
  }

  private setupSirenOsc() {
    if (!this.ctx || !this.sfxVolume) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(600, this.ctx.currentTime);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(400, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxVolume);

    osc1.start();
    osc2.start();

    this.sirenOsc1 = osc1;
    this.sirenOsc2 = osc2;
    this.sirenGain = gain;
  }

  public setSirenSound(active: boolean) {
    this.resume();
    if (!this.sirenGain || !this.sirenOsc1 || !this.sirenOsc2 || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    if (active) {
      this.sirenGain.gain.setTargetAtTime(0.04, t, 0.1);
      
      // Siren wobble effect using code-based scheduling
      const speed = 2.5; // speed of wobble
      const wave = Math.sin(t * speed * Math.PI * 2);
      const freq1 = 600 + wave * 250;
      const freq2 = 450 - wave * 150;

      this.sirenOsc1.frequency.setValueAtTime(freq1, t);
      this.sirenOsc2.frequency.setValueAtTime(freq2, t);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  // --- Dynamic Triggered SFX ---

  public playPistol() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Shoot sound: quick high pass white noise + pitch sweep sine
    const bufferSize = this.ctx.sampleRate * 0.12; // 0.12 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, t);
    noiseFilter.Q.setValueAtTime(4, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    // Sine pop
    const pop = this.ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(300, t);
    pop.frequency.exponentialRampToValueAtTime(60, t + 0.08);

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(0.6, t);
    popGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxVolume);

    pop.connect(popGain);
    popGain.connect(this.sfxVolume);

    noise.start(t);
    pop.start(t);
    noise.stop(t + 0.12);
    pop.stop(t + 0.08);
  }

  public playSMG() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Quick burst pop, slightly higher and faster than pistol
    const pop = this.ctx.createOscillator();
    pop.type = 'sawtooth';
    pop.frequency.setValueAtTime(400, t);
    pop.frequency.exponentialRampToValueAtTime(100, t + 0.06);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    pop.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    pop.start(t);
    pop.stop(t + 0.06);
  }

  public playShotgun() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Blast: lots of noise, long heavy boom
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    // Boom
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(180, t);
    boom.frequency.linearRampToValueAtTime(40, t + 0.2);

    const boomGain = this.ctx.createGain();
    boomGain.gain.setValueAtTime(0.8, t);
    boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    boom.connect(boomGain);
    boomGain.connect(this.sfxVolume);

    noise.start(t);
    boom.start(t);
    noise.stop(t + 0.25);
    boom.stop(t + 0.2);
  }

  public playRocketLaunch() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Woosh sound: low pass noise rising then falling
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(150, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    noise.start(t);
    noise.stop(t + 0.4);
  }

  public playExplosion() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Massive blast
    const bufferSize = this.ctx.sampleRate * 0.7;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, t);
    filter.frequency.exponentialRampToValueAtTime(30, t + 0.65);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.68);

    // Low rumble
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(90, t);
    rumble.frequency.linearRampToValueAtTime(20, t + 0.5);

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(100, t);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.8, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.sfxVolume);

    noise.start(t);
    rumble.start(t);
    noise.stop(t + 0.7);
    rumble.stop(t + 0.5);
  }

  public playPunch() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Fleshy thump: short low pass triangle pop
    const pop = this.ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(120, t);
    pop.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    pop.connect(gain);
    gain.connect(this.sfxVolume);

    pop.start(t);
    pop.stop(t + 0.08);
  }

  public playCrash() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Crash metal clank
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    noise.start(t);
    noise.stop(t + 0.3);
  }

  public playMoney() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Beautiful shiny coin ring (two high sine tones)
    const tone1 = this.ctx.createOscillator();
    const tone2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    tone1.type = 'sine';
    tone1.frequency.setValueAtTime(987.77, t); // B5
    tone1.frequency.setValueAtTime(1318.51, t + 0.08); // E6

    tone2.type = 'sine';
    tone2.frequency.setValueAtTime(1567.98, t); // G6
    tone2.frequency.setValueAtTime(1975.53, t + 0.08); // B6

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    tone1.connect(gain);
    tone2.connect(gain);
    gain.connect(this.sfxVolume);

    tone1.start(t);
    tone2.start(t);
    tone1.stop(t + 0.35);
    tone2.stop(t + 0.35);
  }

  public playTireScreech() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // High pitched noise scream
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.Q.setValueAtTime(5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    noise.start(t);
    noise.stop(t + 0.15);
  }

  public playMissionComplete() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Overkill upbeat sound: C4 -> E4 -> G4 -> C5
    const freqs = [261.63, 329.63, 392.00, 523.25];
    const dur = 0.12;

    freqs.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + index * dur);

      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.setValueAtTime(0.3, t + index * dur);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + index * dur + 0.25);

      osc.connect(oscGain);
      oscGain.connect(this.sfxVolume!);

      osc.start(t + index * dur);
      osc.stop(t + index * dur + 0.35);
    });
  }

  public playMissionFailed() {
    this.resume();
    if (!this.ctx || !this.sfxVolume || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Sad descending tones
    const freqs = [311.13, 293.66, 277.18, 220.00]; // Eb4 -> D4 -> Db4 -> A3
    const dur = 0.2;

    freqs.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + index * dur);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, t);

      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.setValueAtTime(0.25, t + index * dur);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + index * dur + 0.45);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.sfxVolume!);

      osc.start(t + index * dur);
      osc.stop(t + index * dur + 0.5);
    });
  }
}

export const sound = new SoundEngine();

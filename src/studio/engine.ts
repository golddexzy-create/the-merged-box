import { KITS, type BoxState, type Kit, type KitId, lockAmount, nearestRadio } from "./content";

const SEMIS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

function degreeFreq(degree: number, base: number): number {
  const semi = SEMIS[((degree % SEMIS.length) + SEMIS.length) % SEMIS.length] ?? 0;
  return base * 2 ** (semi / 12);
}

export class GrooveEngine {
  private ctx: AudioContext | null = null;
  private desired: BoxState | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  private kitId: KitId = "console";
  private musicTarget = 0;
  private noise: AudioBuffer | null = null;
  private program: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private staticGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private lpf: BiquadFilterNode | null = null;
  private musicBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bins = new Uint8Array(0);

  sync(state: BoxState): void {
    this.desired = state;
    if (!this.ctx) {
      if (!state.powered) return;
      this.build();
    }
    const ctx = this.ctx;
    if (!ctx) return;
    void ctx.resume();
    this.apply();
  }

  levels(): number[] {
    const analyser = this.analyser;
    if (!analyser || !this.desired?.powered) return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    analyser.getByteFrequencyData(this.bins);
    const out: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      const idx = Math.min(this.bins.length - 1, 1 + i * 2);
      out.push((this.bins[idx] ?? 0) / 255);
    }
    return out;
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private build(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    const musicBus = ctx.createGain();
    musicBus.gain.value = 0.9;
    const program = ctx.createGain();
    program.gain.value = 0;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 2800;
    lpf.Q.value = 0.65;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 90;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.008;
    comp.release.value = 0.18;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;
    this.bins = new Uint8Array(analyser.frequencyBinCount);

    musicBus.connect(program);
    program.connect(lpf);
    lpf.connect(analyser);
    analyser.connect(hpf);

    const hiss = ctx.createBufferSource();
    hiss.buffer = buffer;
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "highpass";
    hissFilter.frequency.value = 3800;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(hpf);
    hiss.start();

    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = buffer;
    staticSrc.loop = true;
    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = "bandpass";
    staticFilter.frequency.value = 1700;
    staticFilter.Q.value = 0.7;
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0;
    staticSrc.connect(staticFilter);
    staticFilter.connect(staticGain);
    staticGain.connect(hpf);
    staticSrc.start();

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 120;
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    hum.connect(humGain);
    humGain.connect(hpf);
    hum.start();

    hpf.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    this.musicBus = musicBus;
    this.program = program;
    this.hissGain = hissGain;
    this.staticGain = staticGain;
    this.humGain = humGain;
    this.lpf = lpf;
    this.analyser = analyser;
  }

  private apply(): void {
    const ctx = this.ctx;
    const state = this.desired;
    if (!ctx || !state || !this.program || !this.hissGain || !this.staticGain || !this.humGain || !this.lpf) {
      return;
    }
    const lock = state.powered ? lockAmount(state.freq, state.merged) : 0;
    const volume = state.powered ? state.volume : 0;
    const now = ctx.currentTime;
    this.program.gain.setTargetAtTime(lock * volume, now, 0.06);
    this.hissGain.gain.setTargetAtTime(volume * (0.02 + (1 - lock) * 0.04), now, 0.08);
    this.staticGain.gain.setTargetAtTime(volume * (1 - lock) * 0.18, now, 0.05);
    this.humGain.gain.setTargetAtTime(volume * (state.powered ? 0.012 : 0), now, 0.1);
    this.lpf.frequency.setTargetAtTime(680 + lock * 2700, now, 0.08);
    this.musicTarget = lock * volume;
    this.kitId = state.merged ? "merge" : nearestRadio(state.freq).radio.id;
    if (state.powered) this.start();
    else this.stop();
  }

  private start(): void {
    if (this.timer || !this.ctx) return;
    this.next = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  private stop(): void {
    if (!this.timer) return;
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const kit = KITS[this.kitId];
    const stepDur = 60 / kit.bpm / 4;
    while (this.next < ctx.currentTime + 0.14) {
      const swing = kit.swing && this.step % 2 === 1 ? stepDur * 0.2 : 0;
      const when = this.next + swing;
      if (this.musicTarget > 0.02) this.schedule(kit, this.step, when);
      const crackleChance = this.musicTarget > 0.4 ? 0.05 : 0.2;
      if (Math.random() < crackleChance) this.burst(when, 2400, 0.03, 0.04 + Math.random() * 0.05, "highpass");
      this.next += stepDur;
      this.step = (this.step + 1) % 16;
    }
  }

  private schedule(kit: Kit, step: number, time: number): void {
    if (kit.kick.includes(step)) this.kick(time);
    if (kit.snare.includes(step)) this.burst(time, 1600, 0.12, 0.12, "bandpass");
    if (kit.hat.includes(step)) this.burst(time, 7000, 0.04, 0.045, "highpass");
    if (kit.voice.includes(step)) this.burst(time, 1100, 0.09, 0.05, "bandpass");
    if (kit.teletype.includes(step)) this.tickClick(time);
    const bass = kit.bass[step];
    if (bass !== null && bass !== undefined) this.note(time, degreeFreq(bass, 110), 0.22, "triangle", 0.2);
    const lead = kit.lead[step];
    if (lead !== null && lead !== undefined) this.note(time, degreeFreq(lead, 220), 0.18, "square", 0.045);
    if (kit.organ && (step === 0 || step === 8)) {
      this.note(time, degreeFreq(0, 220), 0.7, "sine", 0.05);
      this.note(time, degreeFreq(4, 220), 0.7, "sine", 0.03);
    }
  }

  private note(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    amount: number,
  ): void {
    const ctx = this.ctx;
    const dest = this.musicBus;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(type === "square" ? 1400 : 2400, time);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amount, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(tone);
    tone.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private kick(time: number): void {
    const ctx = this.ctx;
    const dest = this.musicBus;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.55, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private burst(
    time: number,
    freq: number,
    dur: number,
    amount: number,
    kind: BiquadFilterType,
  ): void {
    const ctx = this.ctx;
    const dest = this.musicBus;
    if (!ctx || !dest || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = kind === "bandpass" ? 1.4 : 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amount, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private tickClick(time: number): void {
    const ctx = this.ctx;
    const dest = this.musicBus;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800 + Math.random() * 400, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.04, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.03);
  }
}

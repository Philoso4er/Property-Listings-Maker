// Procedural Web Audio Ambient Synthesizer for Cinematic Property Tours
class TourSoundtrack {
  private ctx: AudioContext | null = null;
  private chordInterval: any = null;
  private melodyInterval: any = null;
  private noiseNode: AudioNode | null = null;
  private isPlaying: boolean = false;
  private currentTrackName: string = 'none';

  // Chords progression for Luxury Lounge
  private loungeChords = [
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
    [146.83, 174.61, 220.00, 261.63], // Dm7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [164.81, 196.00, 246.94, 293.66], // Em7
  ];

  // Chords progression for Jazz Cafe (Warm Rhodes-like)
  private jazzChords = [
    [110.00, 164.81, 207.65, 261.63], // Am7
    [116.54, 155.56, 196.00, 233.08], // Bbm7
    [130.81, 196.00, 246.94, 293.66], // Cmaj7
    [146.83, 174.61, 220.00, 293.66], // G9/D
  ];

  // Chords for Corporate Clean (Bright plucky pentatonic)
  private corporateChords = [
    [146.83, 220.00, 293.66, 329.63], // Dadd9
    [164.81, 220.00, 329.63, 392.00], // Aadd9
    [130.81, 196.00, 261.63, 329.63], // Cadd9
    [146.83, 196.00, 293.66, 392.00], // Gadd9
  ];

  private activeNodes: AudioNode[] = [];

  constructor() {}

  public start(track: 'luxury_lounge' | 'cinematic_vibe' | 'jazz_cafe' | 'corporate_clean') {
    if (this.isPlaying && this.currentTrackName === track) return;
    this.stop();

    this.currentTrackName = track;
    this.isPlaying = true;

    try {
      // Initialize context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      
      const mainGain = this.ctx.createGain();
      mainGain.gain.setValueAtTime(0.12, this.ctx.currentTime); // keep background music soft
      mainGain.connect(this.ctx.destination);

      // Start dynamic noise generator for environmental wind/waves sweep
      this.startNoiseSweep(mainGain);

      // Distribute chord structures
      let chordSet = this.loungeChords;
      let cadenceSpeed = 4000; // milliseconds
      let melodySpeed = 750;

      if (track === 'jazz_cafe') {
        chordSet = this.jazzChords;
        cadenceSpeed = 5000;
        melodySpeed = 1000;
      } else if (track === 'corporate_clean') {
        chordSet = this.corporateChords;
        cadenceSpeed = 3500;
        melodySpeed = 500;
      }

      let chordIndex = 0;
      const playChordCycle = () => {
        if (!this.ctx) return;
        const currentChord = chordSet[chordIndex];
        const now = this.ctx.currentTime;
        
        // Play 4 oscillators in unison to build warm rich pads
        currentChord.forEach((freq) => {
          this.playPadOsc(freq, now, cadenceSpeed / 1000, mainGain);
        });

        chordIndex = (chordIndex + 1) % chordSet.length;
      };

      // Play immediate first chord
      playChordCycle();
      this.chordInterval = setInterval(playChordCycle, cadenceSpeed);

      // Start delicate melody bell engine
      let step = 0;
      const playMelodyCycle = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const chord = chordSet[chordIndex === 0 ? chordSet.length - 1 : chordIndex - 1];
        
        // Pick random pentatonic note from current chord or adjacent harmonic scale
        if (Math.random() > 0.4) {
          const rootFreq = chord[Math.floor(Math.random() * chord.length)];
          const bellFreq = rootFreq * (Math.random() > 0.6 ? 2 : 4); // octave bells
          this.playBellOsc(bellFreq, now, mainGain);
        }
        step++;
      };

      this.melodyInterval = setInterval(playMelodyCycle, melodySpeed);

    } catch (err) {
      console.warn('Web Audio initialization failed or was blocked by browser security policy:', err);
    }
  }

  private startNoiseSweep(output: AudioNode) {
    if (!this.ctx) return;

    // Create a 2-second buffer of white noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // High cut filter to turn white noise into a lush forest wind/ocean wave roar
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(1, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.015, this.ctx.currentTime); // very subtle backbed noise

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start();

    // Slow sweep on filter frequency to simulate changing drafts/breezes
    const sweepFilter = () => {
      if (!this.ctx || !this.isPlaying) return;
      const now = this.ctx.currentTime;
      const targetFreq = 200 + Math.random() * 500;
      filter.frequency.exponentialRampToValueAtTime(targetFreq, now + 6);
    };

    const sweepInterval = setInterval(sweepFilter, 7000);
    this.activeNodes.push(noise);
    
    // Store additional cleanups
    (noise as any).sweepInterval = sweepInterval;
  }

  private playPadOsc(freq: number, startTime: number, duration: number, output: AudioNode) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    // Use low-pass triangle/sine for smooth non-harsh pads
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    // Smooth fade-in
    gain.gain.linearRampToValueAtTime(0.025, startTime + duration * 0.3);
    // Smooth fade-out before the next chord enters
    gain.gain.setValueAtTime(0.025, startTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private playBellOsc(freq: number, startTime: number, output: AudioNode) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    // Sine for clear bell-like chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.012, startTime + 0.05); // quick bright punch
    gain.gain.exponentialRampToValueAtTime(0.00001, startTime + 1.8); // slow decay resonance

    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.25, startTime);

    const feedback = this.ctx.createGain();
    feedback.gain.setValueAtTime(0.3, startTime); // echoplex bells!

    osc.connect(gain);
    gain.connect(output);

    // Build delay echo
    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(output);

    osc.start(startTime);
    osc.stop(startTime + 2.0);
  }

  public stop() {
    this.isPlaying = false;
    this.currentTrackName = 'none';

    if (this.chordInterval) clearInterval(this.chordInterval);
    if (this.melodyInterval) clearInterval(this.melodyInterval);

    this.activeNodes.forEach((node: any) => {
      try {
        node.stop();
        if (node.sweepInterval) clearInterval(node.sweepInterval);
      } catch (e) {}
    });
    this.activeNodes = [];

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundscape = new TourSoundtrack();

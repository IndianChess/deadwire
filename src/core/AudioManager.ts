import * as THREE from 'three';

export class AudioManager {
  private listener: THREE.AudioListener;
  private context: AudioContext;
  private masterGain: GainNode;
  private sounds = new Map<string, { audio: THREE.PositionalAudio | THREE.Audio; stop: () => void }>();
  private initialized = false;

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.context = this.listener.context;
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.5;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.initialized = true;
  }

  // === Procedural Sound Generators ===

  createGeneratorHum(position: THREE.Vector3, scene: THREE.Scene): THREE.PositionalAudio {
    const audio = new THREE.PositionalAudio(this.listener);
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    osc2.type = 'square';
    osc2.frequency.value = 60;

    filter.type = 'lowpass';
    filter.frequency.value = 200;

    gain.gain.value = 0.15;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);

    audio.setNodeSource(gain as unknown as AudioBufferSourceNode);
    audio.setRefDistance(3);
    audio.setRolloffFactor(2);

    const obj = new THREE.Object3D();
    obj.position.copy(position);
    obj.add(audio);
    scene.add(obj);

    osc1.start();
    osc2.start();

    this.sounds.set('generatorHum', {
      audio,
      stop: () => { try { osc1.stop(); osc2.stop(); } catch { } },
    });

    return audio;
  }

  createFenceCrackle(position: THREE.Vector3, scene: THREE.Scene): THREE.PositionalAudio {
    const audio = new THREE.PositionalAudio(this.listener);
    const bufferSize = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    // Crackle: sparse random impulses
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() < 0.005 ? (Math.random() * 2 - 1) * 0.5 : 0;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 2;

    const gain = this.context.createGain();
    gain.gain.value = 0.1;

    source.connect(filter);
    filter.connect(gain);

    audio.setNodeSource(gain as unknown as AudioBufferSourceNode);
    audio.setRefDistance(4);
    audio.setRolloffFactor(1.5);


    const obj = new THREE.Object3D();
    obj.position.copy(position);
    obj.add(audio);
    scene.add(obj);

    source.start();

    this.sounds.set('fenceCrackle', {
      audio,
      stop: () => source.stop(),
    });

    return audio;
  }

  createAmbience(): THREE.Audio {
    const audio = new THREE.Audio(this.listener);
    const bufferSize = this.context.sampleRate * 4;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    // Wind: filtered noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    const gain = this.context.createGain();
    gain.gain.value = 0.08;

    // Slow LFO on filter frequency for wind effect
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    source.connect(filter);
    filter.connect(gain);
    audio.setNodeSource(gain as unknown as AudioBufferSourceNode);


    source.start();

    this.sounds.set('ambience', {
      audio,
      stop: () => { source.stop(); lfo.stop(); },
    });

    return audio;
  }

  createHeartbeat(): THREE.Audio {
    const audio = new THREE.Audio(this.listener);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    audio.setNodeSource(gain as unknown as AudioBufferSourceNode);

    this.sounds.set('heartbeat', {
      audio,
      stop: () => { },
    });

    return audio;
  }

  playOneShot(type: 'hit' | 'pickup' | 'repair' | 'scare'): void {
    if (!this.initialized) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    switch (type) {
      case 'hit':
        osc.type = 'sawtooth';
        osc.frequency.value = 80;
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.5);
        break;
      case 'pickup':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.context.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.2);
        break;
      case 'repair':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.context.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.4);
        break;
      case 'scare':
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        gain.gain.setValueAtTime(0.4, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.5);
        break;
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.context.currentTime + 2);
  }

  setGeneratorActive(active: boolean): void {
    const hum = this.sounds.get('generatorHum');
    if (hum) {
      (hum.audio as THREE.PositionalAudio).setVolume(active ? 1 : 0);
    }
    const crackle = this.sounds.get('fenceCrackle');
    if (crackle) {
      (crackle.audio as THREE.PositionalAudio).setVolume(active ? 1 : 0);
    }
  }

  dispose(): void {
    for (const [, sound] of this.sounds) {
      try { sound.stop(); } catch { }
    }
    this.sounds.clear();
  }
}

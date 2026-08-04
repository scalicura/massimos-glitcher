import { CUE_TYPES } from './model.js';

export function createCueEngine(getSoundboardPads = () => []) {
  let audioContext = null;
  let limiter = null;
  const active = new Set();

  function ensureContext() {
    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is unavailable in this browser.');
      audioContext = new Context();
      limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = -16; limiter.knee.value = 12; limiter.ratio.value = 10; limiter.attack.value = 0.003; limiter.release.value = 0.2;
      limiter.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration, volume, endFrequency = frequency, type = 'square') {
    const context = ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(limiter); oscillator.start(now); oscillator.stop(now + duration + 0.02);
    active.add(oscillator); oscillator.addEventListener('ended', () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }, { once: true });
  }

  function noise(duration, volume) {
    const context = ensureContext();
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource(); const gain = context.createGain(); const now = context.currentTime;
    source.buffer = buffer; gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(gain); gain.connect(limiter); source.start(); active.add(source);
    source.addEventListener('ended', () => { active.delete(source); source.disconnect(); gain.disconnect(); }, { once: true });
  }

  function playCue(cue, volume = 0.35) {
    const safeVolume = Math.min(0.65, Math.max(0, volume));
    if (String(cue).startsWith('pad:')) {
      const id = String(cue).slice(4); const pad = [...getSoundboardPads()].find((candidate) => candidate.id === id);
      if (!pad) throw new Error('The selected Soundboard pad is no longer available.');
      pad.audio.volume = Math.min(0.65, pad.volume * safeVolume); pad.audio.currentTime = 0; pad.audio.play().catch(() => {}); return;
    }
    if (!CUE_TYPES.includes(cue)) return;
    if (cue === 'warning-beep') { tone(760, 0.12, safeVolume * 0.55); window.setTimeout(() => tone(760, 0.12, safeVolume * 0.55), 170); }
    if (cue === 'low-alarm') tone(92, 0.7, safeVolume * 0.55, 72, 'sawtooth');
    if (cue === 'static-burst') noise(0.22, safeVolume * 0.36);
    if (cue === 'signal-chirp') tone(520, 0.18, safeVolume * 0.45, 1280, 'sine');
    if (cue === 'impact-hit') { tone(78, 0.3, safeVolume * 0.65, 34, 'sine'); noise(0.08, safeVolume * 0.16); }
    if (cue === 'rising-tone') tone(180, 0.65, safeVolume * 0.38, 920, 'sine');
    if (cue === 'power-down') tone(780, 0.72, safeVolume * 0.42, 42, 'sawtooth');
  }

  function stopAll() {
    active.forEach((node) => { try { node.stop(); } catch { /* Already stopped. */ } });
    active.clear();
  }

  return { playCue, stopAll, destroy() { stopAll(); audioContext?.close(); audioContext = null; limiter = null; } };
}


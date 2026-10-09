// Original, quietly played room scores and foley, synthesized locally.
// Audio is created only after a visitor's gesture; no remote audio or downloads.
export function createWorldAudio({ onState } = {}) {
  const scores = {
    projects: { root: 48, tempo: 76, wave: 'triangle', melody: [12, 16, 19, 21, 19, 16, 14, 12, 7, 12, 14, 16, 19, 16, 14, 7] },
    experience: { root: 45, tempo: 86, wave: 'triangle', melody: [12, 15, 19, 12, 22, 19, 15, 10, 12, 19, 15, 22, 19, 17, 15, 10] },
    skills: { root: 50, tempo: 62, wave: 'sine', melody: [19, 24, 26, 31, 26, 24, 19, 14, 19, 26, 24, 21, 19, 14, 12, 14] },
    achievements: { root: 53, tempo: 70, wave: 'sine', melody: [24, 28, 31, 33, 31, 28, 26, 24, 19, 24, 28, 31, 28, 26, 24, 19] },
    certifications: { root: 43, tempo: 52, wave: 'sine', melody: [24, 31, 34, 38, 34, 31, 29, 26, 24, 29, 31, 34, 31, 29, 26, 22] },
    contact: { root: 48, tempo: 82, wave: 'triangle', melody: [12, 19, 16, 14, 12, 7, 9, 12, 16, 19, 21, 19, 16, 14, 12, 7] },
    story: { root: 46, tempo: 64, wave: 'triangle', melody: [12, 14, 19, 21, 19, 14, 12, 7, 12, 19, 21, 24, 21, 19, 14, 12] },
    map: { root: 48, tempo: 60, wave: 'sine', melody: [19, 16, 12, 14, 19, 21, 24, 21, 19, 16, 14, 12, 7, 12, 14, 16] }
  };
  let context, master, music, currentRoom = null, bus, beat = 0, nextNote = 0, timer;
  let muted = false, disposed = false;
  try { muted = localStorage.getItem('world-sound-muted') === 'true'; } catch {}
  const voices = new Set();
  const frequency = note => 440 * 2 ** ((note - 69) / 12);
  function tone(note, time, duration, volume, wave, output, shimmer = false) {
    const envelope = context.createGain(); envelope.connect(output);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + .035);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    [1, ...(shimmer ? [2.003] : [])].forEach((ratio, i) => {
      const oscillator = context.createOscillator(); oscillator.type = i ? 'sine' : wave;
      oscillator.frequency.value = frequency(note) * ratio;
      oscillator.connect(envelope); oscillator.start(time); oscillator.stop(time + duration + .05);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); if (!i) envelope.disconnect(); };
    });
  }
  function schedule() {
    if (!context || context.state !== 'running' || !currentRoom || muted || document.hidden) return;
    const score = scores[currentRoom] || scores.story;
    const step = 60 / score.tempo * .75;
    if (nextNote < context.currentTime - .1) nextNote = context.currentTime + .06;
    while (nextNote < context.currentTime + .28) {
      const note = score.root + score.melody[beat % score.melody.length];
      // A breathing phrase, with little rests instead of a relentless loop.
      if (beat % 8 !== 7) tone(note, nextNote, currentRoom === 'certifications' ? 3.3 : 1.8, .14, score.wave, bus, score.wave === 'sine');
      if (beat % 8 === 0) {
        const chord = beat % 32 < 16 ? [0, 7, 12] : [5, 12, 16];
        chord.forEach((offset, i) => tone(score.root + offset, nextNote + i * .05, step * 7, .045, 'sine', bus));
      }
      beat++; nextNote += step;
    }
  }
  function room(kind) {
    currentRoom = kind;
    if (!context) return;
    const now = context.currentTime;
    if (bus) {
      const oldBus = bus; oldBus.gain.cancelScheduledValues(now);
      oldBus.gain.setValueAtTime(oldBus.gain.value, now); oldBus.gain.linearRampToValueAtTime(0, now + .65);
      setTimeout(() => { if (!disposed) oldBus.disconnect(); }, 4500);
    }
    bus = context.createGain(); bus.gain.value = 0; bus.connect(music);
    bus.gain.linearRampToValueAtTime(kind ? 1 : 0, now + .8);
    beat = 0; nextNote = now + .15; schedule();
  }
  function unlock() {
    if (disposed) return;
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      context.onstatechange = () => { if (!disposed) onState?.(); };
      master = context.createGain(); master.gain.value = muted ? 0 : .24; master.connect(context.destination);
      music = context.createGain(); music.gain.value = .8; music.connect(master);
      const echo = context.createDelay(1), echoGain = context.createGain();
      echo.delayTime.value = .32; echoGain.gain.value = .18;
      music.connect(echo); echo.connect(echoGain); echoGain.connect(master);
      room(currentRoom); timer = setInterval(schedule, 120);
    }
    if (context.state === 'suspended' && !document.hidden) context.resume().then(() => { schedule(); onState?.(); }).catch(() => {});
    else onState?.();
  }
  function door(opening = true) {
    unlock();
    if (!context || muted) return;
    const now = context.currentTime + .04, length = 1.1;
    const buffer = context.createBuffer(1, context.sampleRate * length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 73, brown = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      brown = (brown + (seed / 2147483648 - 1) * .035) / 1.025;
      samples[i] = brown * Math.max(0, Math.sin(i / samples.length * Math.PI)) * (1 + .3 * Math.sin(i * .002));
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = 6;
    filter.frequency.setValueAtTime(opening ? 240 : 700, now);
    filter.frequency.exponentialRampToValueAtTime(opening ? 780 : 170, now + length);
    gain.gain.value = .8; source.connect(filter); filter.connect(gain); gain.connect(master);
    source.start(now); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    tone(opening ? 39 : 36, now, .85, .1, 'sawtooth', master);
    if (!opening) tone(28, now + .85, .15, .2, 'sine', master);
  }
  function setMuted(value) {
    muted = value;
    try { localStorage.setItem('world-sound-muted', String(value)); } catch {}
    unlock();
    if (master) master.gain.setTargetAtTime(value ? 0 : .24, context.currentTime, .12);
    schedule();
  }
  function visibility() {
    if (!context) return;
    if (document.hidden) context.suspend().catch(() => {});
    else context.resume().then(schedule).catch(() => {});
  }
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', visibility);
  return {
    room, door, setMuted, get muted() { return muted; }, get ready() { return context?.state === 'running'; },
    dispose() {
      disposed = true; clearInterval(timer);
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      voices.forEach(voice => { try { voice.stop(); } catch {} }); voices.clear();
      context?.close().catch(() => {});
    }
  };
}

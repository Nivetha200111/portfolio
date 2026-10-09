import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('room audio waits for interaction, changes score, mutes, and releases its resources', async t => {
  const listeners = new Map(), saved = new Map(), contexts = [], frequencies = [], buffers = [], timers = new Map();
  let timerId = 0;
  class Param {
    value = 0;
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    setTargetAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); delayTime = new Param();
    connect() {} disconnect() { this.disconnected = true; }
    start() { if (this.frequency.value) frequencies.push(this.frequency.value); }
    stop() { this.stopped = true; }
  }
  class Context {
    state = 'suspended'; currentTime = 0; sampleRate = 8000; destination = new Node(); nodes = [];
    constructor() { contexts.push(this); }
    node() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.node(); } createOscillator() { return this.node(); }
    createDelay() { return this.node(); } createBufferSource() { return this.node(); }
    createBiquadFilter() { return this.node(); }
    createBuffer(channels, length) { const samples = new Float32Array(length); buffers.push(samples); return { getChannelData: () => samples }; }
    async resume() { this.state = 'running'; this.onstatechange?.(); }
    async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
    async close() { this.state = 'closed'; this.onstatechange?.(); }
  }
  t.mock.method(globalThis, 'setInterval', callback => { timers.set(++timerId, callback); return timerId; });
  t.mock.method(globalThis, 'clearInterval', id => timers.delete(id));
  t.mock.method(globalThis, 'setTimeout', () => ++timerId);
  globalThis.window = { AudioContext: Context };
  globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  globalThis.document = { hidden: false, addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: name => listeners.delete(name) };
  t.after(() => { delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; });
  const source = await readFile(new URL('../public/story/audio.js', import.meta.url), 'utf8');
  const { createWorldAudio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const audio = createWorldAudio(); audio.room('projects');
  assert.equal(contexts.length, 0, 'a deep link must not create an audio context or autoplay');
  listeners.get('pointerdown')(); await Promise.resolve();
  assert.equal(audio.ready, true); assert.equal(timers.size, 1);
  const workshopMelody = frequencies.slice(); assert.ok(workshopMelody.length > 0);
  frequencies.length = 0; audio.room('skills');
  assert.notDeepEqual(frequencies, workshopMelody, 'the greenhouse has its own musical phrase');
  audio.setMuted(true); assert.equal(saved.get('world-sound-muted'), 'true');
  assert.equal(contexts[0].nodes[0].gain.value, 0);
  const beforeMutedDoor = buffers.length; audio.door(); assert.equal(buffers.length, beforeMutedDoor);
  audio.setMuted(false); audio.door();
  assert.equal(buffers.length, beforeMutedDoor + 1);
  const energy = buffers.at(-1).reduce((sum, value) => sum + value * value, 0);
  assert.ok(energy > 0 && energy < buffers.at(-1).length, 'the creak contains a bounded audible signal');
  document.hidden = true; listeners.get('visibilitychange')(); await Promise.resolve(); assert.equal(audio.ready, false);
  audio.dispose(); await Promise.resolve();
  assert.equal(contexts[0].state, 'closed'); assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
});

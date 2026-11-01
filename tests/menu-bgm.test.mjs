import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuBgm } from '../src/audio/menu-bgm.js';

function harness(blocked = false) {
  let timestamp = 0, next = 1;
  const frames = new Map(), listeners = {};
  const sound = {
    volume: 1, paused: true, loop: false, preload: 'none', currentTime: 10, plays: 0, pauses: 0,
    play() {
      this.plays++;
      if (blocked) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; this.pauses++; }
  };
  const events = { addEventListener(name, fn) { listeners[name] = fn; } };
  const raf = fn => { const id = next++; frames.set(id, fn); return id; };
  const cancelRaf = id => { frames.delete(id); };
  const controller = createMenuBgm('/bgm.mp3', {
    audio: sound, events, raf, cancelRaf, now: () => timestamp,
    fadeInMs: 800, fadeOutMs: 1400, menuVolume: 0.32
  });
  function tick(delta) {
    timestamp += delta;
    const queued = [...frames.entries()];
    frames.clear();
    for (const [, fn] of queued) fn(timestamp);
  }
  return { sound, controller, tick, events: listeners, unblock() { blocked = false; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('autoplay loops invisibly in menu, fades out smoothly during loading, and stops', async () => {
  const h = harness();
  h.controller.enterMenu(); await settle();
  assert.equal(h.sound.loop, true);
  assert.equal(h.sound.preload, 'auto');
  assert.equal(h.sound.plays, 1);
  h.tick(400);
  assert.ok(h.sound.volume > 0 && h.sound.volume < 0.32);
  h.tick(400); assert.equal(h.sound.volume, 0.32);
  h.controller.leaveMenu();
  h.tick(700);
  assert.ok(h.sound.volume > 0 && h.sound.volume < 0.32);
  h.tick(700);
  assert.equal(h.sound.volume, 0);
  assert.equal(h.sound.paused, true);
  assert.equal(h.sound.currentTime, 0);
});

test('autoplay rejection retries on user pointer/key gesture without extra UI', async () => {
  const h = harness(true);
  h.controller.enterMenu(); await settle();
  assert.equal(h.sound.paused, true);
  assert.equal(h.sound.volume, 0);
  h.unblock();
  h.events.pointerdown(); await settle();
  h.tick(800);
  assert.equal(h.sound.volume, 0.32);
});

test('return to room resumes music and cancels a previous fade-out', async () => {
  const h = harness();
  h.controller.enterMenu(); await settle(); h.tick(800);
  h.controller.leaveMenu(); h.tick(300);
  h.controller.enterMenu();
  h.tick(800);
  assert.equal(h.sound.volume, 0.32);
  assert.equal(h.sound.paused, false);
  assert.equal(h.sound.pauses, 0);
});

test('late play resolution cannot start BGM after match loading', async () => {
  let resolvePlay;
  const h = harness();
  h.sound.play = () => new Promise(resolve => {resolvePlay = resolve;});
  h.controller.enterMenu();
  h.controller.leaveMenu();
  resolvePlay(); await settle();
  assert.equal(h.sound.volume, 0);
  assert.equal(h.sound.paused, true);
});

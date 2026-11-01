// PointBlock menu BGM: one hidden HTMLAudioElement, independent of combat SFX.
// Browsers may reject unmuted autoplay until the first trusted user interaction.
export function createMenuBgm(sourceUrl, options = {}) {
  const sound = options.audio ?? new Audio(sourceUrl);
  const events = options.events ?? document;
  const raf = options.raf ?? requestAnimationFrame;
  const cancel = options.cancelRaf ?? cancelAnimationFrame;
  const now = options.now ?? (() => performance.now());
  const menuVolume = options.menuVolume ?? 0.32;
  const fadeInMs = options.fadeInMs ?? 800;
  const fadeOutMs = options.fadeOutMs ?? 1400;

  sound.loop = true;
  sound.preload = 'auto';
  sound.volume = 0;

  let state = 'idle';
  let frame = 0;
  let fadeToken = 0;
  let pendingPlay = null;

  function cancelFade() {
    fadeToken++;
    if (frame) cancel(frame);
    frame = 0;
  }
  function fadeTo(target, duration, done) {
    cancelFade();
    const token = fadeToken;
    const startVolume = sound.volume;
    const startTime = now();
    if (duration <= 0 || Math.abs(target - startVolume) < 0.001) {
      sound.volume = target;
      if (done) done();
      return;
    }
    function tick(time) {
      if (token !== fadeToken) return;
      const elapsed = Math.max(0, time - startTime);
      const fraction = Math.min(1, elapsed / duration);
      const smooth = fraction * fraction * (3 - 2 * fraction);
      sound.volume = Math.max(0, Math.min(1, startVolume + (target - startVolume) * smooth));
      if (fraction < 1) frame = raf(tick);
      else {
        frame = 0;
        if (done) done();
      }
    }
    frame = raf(tick);
  }
  function attemptPlayback() {
    if (state !== 'menu' || pendingPlay || !sound.paused) return;
    try {
      const result = sound.play();
      if (result && typeof result.then === 'function') {
        pendingPlay = result;
        result.then(() => {
          if (pendingPlay !== result) return;
          pendingPlay = null;
          if (state === 'menu') fadeTo(menuVolume, fadeInMs);
          else {
            sound.pause();
            sound.volume = 0;
          }
        }).catch(() => {
          // Expected on browsers that block unmuted autoplay. Retry only on a gesture.
          if (pendingPlay === result) pendingPlay = null;
        });
      } else if (state === 'menu') fadeTo(menuVolume, fadeInMs);
    } catch (_) {
      // Media startup is optional; never break game initialization.
    }
  }
  function enterMenu() {
    if (state === 'menu' && !sound.paused) return;
    state = 'menu';
    if (sound.paused) {
      cancelFade();
      sound.volume = 0;
      attemptPlayback();
    } else fadeTo(menuVolume, fadeInMs);
  }
  function leaveMenu() {
    if (state === 'match') return;
    state = 'match';
    if (sound.paused) {
      cancelFade();
      sound.volume = 0;
      return;
    }
    fadeTo(0, fadeOutMs, () => {
      if (state !== 'match') return;
      sound.pause();
      try { sound.currentTime = 0; } catch (_) { /* Unseekable media. */ }
    });
  }
  function gestureRetry() {
    if (state === 'menu' && sound.paused) attemptPlayback();
  }
  events.addEventListener('pointerdown', gestureRetry, { capture: true });
  events.addEventListener('keydown', gestureRetry, { capture: true });

  return Object.freeze({ enterMenu, leaveMenu });
}

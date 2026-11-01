// Worker heartbeat is best-effort. A normal setInterval is the fallback when
// Worker creation fails; visibility restoration always reconciles elapsed time.
export function createBackgroundTicker({
  workerFactory = () => new Worker(new URL('./heartbeat.worker.js', import.meta.url), { type: 'module' }),
  fallbackSetInterval = setInterval,
  fallbackClearInterval = clearInterval
} = {}) {
  let worker = null, fallback = null, hidden = false, pulse = () => {};
  function fallbackStart() {
    if (fallback === null && hidden) fallback = fallbackSetInterval(() => pulse(), 100);
  }
  function fallbackStop() {
    if (fallback !== null) fallbackClearInterval(fallback);
    fallback = null;
  }
  try {
    worker = workerFactory();
    worker.addEventListener('message', event => {
      if (event.data === 'tick' && hidden) pulse();
    });
    worker.addEventListener('error', () => {
      if (worker) worker.terminate();
      worker = null;
      fallbackStart();
    });
  } catch (_) { fallbackStart(); }
  function setHidden(value) {
    hidden = !!value;
    if (worker) worker.postMessage(hidden ? 'start' : 'stop');
    else if (hidden) fallbackStart();
    else fallbackStop();
  }
  function dispose() {
    hidden = false;
    fallbackStop();
    if (worker) { worker.postMessage('stop'); worker.terminate(); worker = null; }
  }
  return Object.freeze({
    onPulse(callback) { if (typeof callback !== 'function') throw new TypeError('Invalid pulse callback'); pulse = callback; },
    setHidden,
    dispose
  });
}

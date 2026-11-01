// Best-effort background heartbeat. Rendering and the game simulation stay on
// the main thread. Browsers may still throttle or suspend workers entirely.
let intervalId = null;
self.addEventListener('message', event => {
  if (event.data === 'start') {
    if (intervalId !== null) return;
    intervalId = setInterval(() => self.postMessage('tick'), 100);
  } else if (event.data === 'stop' && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
});

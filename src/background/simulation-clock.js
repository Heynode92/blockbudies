// Keeps simulation time separate from WebGL rendering.
// Visible frames retain their original 50ms delta cap; hidden pulses advance in
// 50ms physics steps, with a bounded CPU budget and explicit timer reconciliation.
export function createSimulationClock({ now, isRunning, step, fastForward, maxBackgroundSteps = 30 }) {
  if (typeof now !== 'function' || typeof isRunning !== 'function' ||
      typeof step !== 'function' || typeof fastForward !== 'function') {
    throw new TypeError('Simulation clock requires its four callbacks');
  }
  if (!Number.isSafeInteger(maxBackgroundSteps) || maxBackgroundSteps < 1) {
    throw new RangeError('maxBackgroundSteps must be a positive integer');
  }
  let previous = now();
  const maxStep = 0.05;
  function elapsed(time) {
    const current = Number.isFinite(time) ? time : now();
    const delta = Math.max(0, (current - previous) / 1000);
    previous = current;
    return Number.isFinite(delta) ? delta : 0;
  }
  function tickBackground(time = now()) {
    const delta = elapsed(time);
    if (!isRunning() || delta <= 0) return;
    let remaining = delta, steps = 0;
    // Do not use one giant dt: bullets, movement and collision expect <= 50ms.
    while (remaining > 0.000001 && steps < maxBackgroundSteps && isRunning()) {
      const slice = Math.min(maxStep, remaining);
      step(slice);
      remaining -= slice;
      steps++;
    }
    // Browser throttling/suspension can produce large gaps. Advance objective
    // clocks without trying to simulate thousands of bot/physics frames at once.
    if (remaining > 0.000001 && isRunning()) fastForward(remaining);
  }
  function tickVisible(time = now()) {
    const delta = elapsed(time);
    if (!isRunning() || delta <= 0) return;
    if (delta > 0.25) {
      // Missed visibility event or a long browser scheduler stall.
      // Reconcile lost time before displaying the next frame.
      let remaining = delta, steps = 0;
      while (remaining > 0.000001 && steps < maxBackgroundSteps && isRunning()) {
        const slice = Math.min(maxStep, remaining);
        step(slice);
        remaining -= slice;
        steps++;
      }
      if (remaining > 0.000001 && isRunning()) fastForward(remaining);
    } else {
      step(Math.min(delta, maxStep));
    }
  }
  return Object.freeze({ tickVisible, tickBackground });
}

// site/js/countdown.js
export const WEDDING_START = '2027-08-21T00:00:00-05:00';

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function timeLeft(now, target) {
  const ms = new Date(target).getTime() - new Date(now).getTime();
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const s = Math.floor(ms / 1000);
  return {
    done: false,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

// Fills [data-unit="days|hours|minutes|seconds"] elements inside `root` and ticks every second.
// Returns a function that stops the timer.
export function startCountdown(root, target = WEDDING_START, now = () => new Date()) {
  const set = (unit, value) => {
    const el = root.querySelector(`[data-unit="${unit}"]`);
    if (el) el.textContent = unit === 'days' ? String(value) : pad(value);
  };
  let id;
  const tick = () => {
    const t = timeLeft(now(), target);
    set('days', t.days);
    set('hours', t.hours);
    set('minutes', t.minutes);
    set('seconds', t.seconds);
    if (t.done) clearInterval(id);
  };
  id = setInterval(tick, 1000);
  tick();
  return () => clearInterval(id);
}

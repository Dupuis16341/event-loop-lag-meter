import { monotonicNow } from './clock.js';

/**
 * Measures event loop lag by scheduling a fixed-interval timer and
 * comparing the expected tick time with the actual callback time.
 */
export class EventLoopLagMeter {
  /**
   * @param {object} [options]
   * @param {number} [options.interval=1000] Timer interval in milliseconds.
   * @param {(now: number) => number} [options.clock] Function returning a
   *   monotonic timestamp in milliseconds. Defaults to process.hrtime based
   *   monotonicNow. Injectable for deterministic tests.
   * @param {(lagMs: number, timestampMs: number) => void} [options.onLag]
   *   Callback invoked after each timer tick with the measured lag.
   */
  constructor({
    interval = 1000,
    clock = monotonicNow,
    onLag = () => {},
  } = {}) {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new RangeError('interval must be a positive finite number');
    }
    if (typeof clock !== 'function') {
      throw new TypeError('clock must be a function');
    }
    if (typeof onLag !== 'function') {
      throw new TypeError('onLag must be a function');
    }

    this._interval = interval;
    this._clock = clock;
    this._onLag = onLag;
    this._timer = null;
    this._nextExpected = null;
  }

  /**
   * Starts the lag meter. If already running, this is a no-op.
   */
  start() {
    if (this._timer !== null) {
      return;
    }
    this._nextExpected = this._clock() + this._interval;
    this._timer = setInterval(() => this._tick(), this._interval);
    // Allow tests and embedders to avoid an open handle when they are done.
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  /**
   * Stops the lag meter. If not running, this is a no-op.
   */
  stop() {
    if (this._timer === null) {
      return;
    }
    clearInterval(this._timer);
    this._timer = null;
    this._nextExpected = null;
  }

  /**
   * Returns true when the meter is currently scheduled.
   */
  isRunning() {
    return this._timer !== null;
  }

  /**
   * Handles a timer tick.
   *
   * Lag is computed as actual tick time minus expected tick time.
   * The expected time for the next tick is advanced by whole intervals
   * from the previous expected time, not from the actual time. This
   * avoids a feedback loop where a single slow tick pushes all future
   * expected times forward and hides persistent lag.
   */
  _tick() {
    const now = this._clock();
    const lag = now - this._nextExpected;
    this._nextExpected += this._interval;

    // If the process was suspended (laptop sleep, debugger pause) and
    // missed more than one interval, the nextExpected value is now in
    // the past. Jump it forward to the first interval boundary after
    // `now` so we measure fresh lag rather than reporting one huge
    // accumulated delay forever.
    if (this._nextExpected <= now) {
      const missedIntervals = Math.floor((now - this._nextExpected) / this._interval) + 1;
      this._nextExpected += missedIntervals * this._interval;
    }

    this._onLag(lag, now);
  }
}

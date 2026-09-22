# Event Loop Lag Meter

A small JavaScript library that measures Node.js event loop lag by scheduling a timer at a fixed interval and reporting the difference between the scheduled and actual callback time.

## Usage

```js
import { EventLoopLagMeter } from 'event-loop-lag-meter';

const meter = new EventLoopLagMeter({
  interval: 1000,
  onLag: (lagMs, timestampMs) => {
    console.log(`Event loop lag: ${lagMs} ms`);
  },
});

meter.start();

// Later:
meter.stop();
```

The exported names are `EventLoopLagMeter` and `monotonicNow`.

`EventLoopLagMeter` constructor options:
- `interval`: timer interval in milliseconds, must be a positive finite number. Default `1000`.
- `clock`: function returning a monotonic timestamp in milliseconds. Defaults to `monotonicNow`, which uses `process.hrtime.bigint()`. Override for deterministic tests.
- `onLag`: callback `(lagMs, timestampMs)` invoked after each timer tick. Default no-op.

`start()` schedules the timer. `stop()` clears it. Both are idempotent. `isRunning()` reports whether the timer is currently scheduled.

## Why this exists

Event loop lag is a direct signal of how much time the process spends doing synchronous work between timer callbacks. A healthy service has near-zero lag; a process stuck parsing a huge JSON payload or running a synchronous database driver shows a large lag. This library gives you that number without any third-party dependencies.

The main trade-off is accuracy versus simplicity. It measures lag only at timer tick boundaries, so lag spikes shorter than the interval can be missed. A smaller interval gives finer granularity but adds a tiny amount of timer overhead. This library does not attempt to sample continuously or use `async_hooks`; it is deliberately a simple, predictable timer-based meter.

## Edge cases

If the process is suspended for longer than one interval — laptop sleep, a debugger pause, or a very long synchronous task — the meter skips ahead to the next interval boundary after the current time. It reports the initial large lag for the missed tick, then resumes measuring fresh lag rather than reporting one accumulated delay forever.

The timer is unref'ed when possible so it does not keep the Node process alive on its own.

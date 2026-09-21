import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventLoopLagMeter } from '../src/index.js';

function createFakeClock(start = 1000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms) => {
      now += ms;
      return now;
    },
  };
}

test('exports EventLoopLagMeter', () => {
  assert.equal(typeof EventLoopLagMeter, 'function');
});

test('start schedules a timer and stop clears it', () => {
  const clock = createFakeClock();
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  assert.equal(meter.isRunning(), true);

  meter.stop();
  assert.equal(meter.isRunning(), false);
});

test('start is idempotent', () => {
  const clock = createFakeClock();
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  meter.start();
  assert.equal(meter.isRunning(), true);

  meter.stop();
  assert.equal(lags.length, 0);
});

test('stop is idempotent', () => {
  const clock = createFakeClock();
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
  });

  meter.start();
  meter.stop();
  meter.stop();
  assert.equal(meter.isRunning(), false);
});

test('reports zero lag when timer fires exactly on time', () => {
  const clock = createFakeClock(1000);
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 50,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  clock.advance(50);
  meter._tick();

  assert.deepEqual(lags, [0]);
  meter.stop();
});

test('reports positive lag when timer fires late', () => {
  const clock = createFakeClock(2000);
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  clock.advance(130);
  meter._tick();

  assert.deepEqual(lags, [30]);
  meter.stop();
});

test('reports negative lag when timer fires early', () => {
  const clock = createFakeClock(5000);
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 200,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  clock.advance(150);
  meter._tick();

  assert.deepEqual(lags, [-50]);
  meter.stop();
});

test('expected time advances by interval, not actual time', () => {
  const clock = createFakeClock(0);
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  clock.advance(100);
  meter._tick(); // lag 0
  clock.advance(180);
  meter._tick(); // actual 280, expected 200, lag 80

  assert.deepEqual(lags, [0, 80]);
  meter.stop();
});

test('handles a missed interval by skipping to the next boundary', () => {
  const clock = createFakeClock(10000);
  const lags = [];
  const meter = new EventLoopLagMeter({
    interval: 100,
    clock: clock.now,
    onLag: (lag) => lags.push(lag),
  });

  meter.start();
  clock.advance(350);
  meter._tick(); // actual 10350, expected 10100, lag 250
  // nextExpected jumped from 10200 to 10400
  clock.advance(50);
  meter._tick(); // actual 10400, expected 10400, lag 0

  assert.deepEqual(lags, [250, 0]);
  meter.stop();
});

test('passes timestamp to onLag', () => {
  const clock = createFakeClock(42);
  const calls = [];
  const meter = new EventLoopLagMeter({
    interval: 10,
    clock: clock.now,
    onLag: (lag, ts) => calls.push([lag, ts]),
  });

  meter.start();
  clock.advance(10);
  meter._tick();

  assert.deepEqual(calls, [[0, 52]]);
  meter.stop();
});

test('constructor rejects non-positive interval', () => {
  assert.throws(
    () => new EventLoopLagMeter({ interval: 0 }),
    RangeError
  );
  assert.throws(
    () => new EventLoopLagMeter({ interval: -5 }),
    RangeError
  );
});

test('constructor rejects non-finite interval', () => {
  assert.throws(
    () => new EventLoopLagMeter({ interval: Infinity }),
    RangeError
  );
  assert.throws(
    () => new EventLoopLagMeter({ interval: NaN }),
    RangeError
  );
});

test('constructor rejects non-function clock', () => {
  assert.throws(
    () => new EventLoopLagMeter({ clock: 42 }),
    TypeError
  );
});

test('constructor rejects non-function onLag', () => {
  assert.throws(
    () => new EventLoopLagMeter({ onLag: 'nope' }),
    TypeError
  );
});

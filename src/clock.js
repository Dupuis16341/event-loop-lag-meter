/**
 * Returns a monotonic timestamp in milliseconds.
 *
 * Uses process.hrtime.bigint() because Node's hrtime is monotonic and
 * unaffected by wall-clock changes such as NTP adjustments or manual
 * date changes. This matters for lag measurement: we compare the expected
 * timer tick against the actual tick, and wall-clock time can jump.
 */
export function monotonicNow() {
  return Number(process.hrtime.bigint() / 1000000n);
}

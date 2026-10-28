const test = require('node:test');
const assert = require('node:assert/strict');
const { compare, normalizeRect } = require('../src/diff-core.js');

function rgba(width, height, pixel = [255, 255, 255, 255]) {
  return new Uint8ClampedArray(Array.from({ length: width * height }, () => pixel).flat());
}
function set(pixels, width, x, y, pixel) { pixels.set(pixel, (y * width + x) * 4); }

test('identical pictures produce no changes and fully opaque output', () => {
  const a = rgba(2, 2, [16, 24, 40, 255]);
  const r = compare({ a, b: a.slice(), width: 2, height: 2 });
  assert.equal(r.changed, 0); assert.equal(r.compared, 4); assert.equal(r.ratio, 0);
  assert.equal(r.bounds, null); assert.equal(r.ignored, 0); assert.equal(r.data[3], 255);
});

test('channel threshold is strictly exceeded, including the zero threshold', () => {
  const a = rgba(3, 1, [100, 100, 100, 255]);
  const b = rgba(3, 1, [100, 100, 100, 255]);
  set(b, 3, 0, 0, [116, 100, 100, 255]);
  set(b, 3, 1, 0, [100, 117, 100, 255]);
  assert.equal(compare({ a, b, width: 3, height: 1, threshold: 16 }).changed, 1);
  assert.equal(compare({ a, b, width: 3, height: 1, threshold: 0 }).changed, 2);
});

test('exact ratio, changed bounds, and highlight color are correct', () => {
  const a = rgba(4, 3), b = a.slice();
  set(b, 4, 1, 0, [0, 0, 0, 255]); set(b, 4, 3, 2, [0, 0, 0, 255]);
  const r = compare({ a, b, width: 4, height: 3 });
  assert.equal(r.changed, 2); assert.equal(r.compared, 12); assert.equal(r.ratio, 1 / 6);
  assert.deepEqual(r.bounds, { x: 1, y: 0, width: 3, height: 3 });
  assert.deepEqual([...r.data.slice(4, 8)], [236, 71, 106, 255]);
});

test('invisible RGB differences are ignored and semi-transparent pixels composite over white', () => {
  const a = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 0, 128]);
  const b = new Uint8ClampedArray([0, 255, 0, 0, 127, 127, 127, 255]);
  const r = compare({ a, b, width: 2, height: 1, threshold: 0.001 });
  assert.equal(r.changed, 0);
});

test('overlapping ignored rectangles exclude their union exactly once', () => {
  const a = rgba(4, 2), b = rgba(4, 2, [0, 0, 0, 255]);
  const r = compare({ a, b, width: 4, height: 2, ignores: [
    { x: 0, y: 0, width: 2, height: 2 }, { x: 1, y: 0, width: 2, height: 2 }
  ] });
  assert.equal(r.ignored, 6); assert.equal(r.compared, 2); assert.equal(r.changed, 2); assert.equal(r.ratio, 1);
  assert.deepEqual([...r.data.slice(0, 4)], [226, 230, 237, 255]);
});

test('selection is clipped and ignores outside selection do not affect counts', () => {
  const a = rgba(4, 4), b = rgba(4, 4, [0, 0, 0, 255]);
  const r = compare({ a, b, width: 4, height: 4,
    region: { x: -2, y: 1, width: 4, height: 6 },
    ignores: [{ x: 3, y: 0, width: 1, height: 4 }, { x: 1, y: 3, width: 1, height: 1 }]
  });
  assert.equal(r.compared, 5); assert.equal(r.ignored, 1); assert.equal(r.changed, 5);
  assert.deepEqual(r.bounds, { x: 0, y: 1, width: 2, height: 3 });
});

test('fully excluded selections report no ratio, not an artificial perfect score', () => {
  const a = rgba(2, 2), b = a.slice();
  for (const extra of [
    { ignores: [{ x: 0, y: 0, width: 2, height: 2 }] },
    { region: { x: 3, y: 3, width: 2, height: 2 } },
    { region: { x: 0, y: 0, width: 0, height: 2 } }
  ]) {
    const r = compare({ a, b, width: 2, height: 2, ...extra });
    assert.equal(r.compared, 0); assert.equal(r.changed, 0); assert.equal(r.ratio, null); assert.equal(r.bounds, null);
  }
});

test('mismatched extents count missing pixels and exclude shared padding', () => {
  const a = rgba(3, 3), b = rgba(3, 3);
  const r = compare({ a, b, width: 3, height: 3, threshold: 255,
    aSize: { width: 3, height: 1 }, bSize: { width: 1, height: 3 } });
  assert.equal(r.compared, 5); assert.equal(r.changed, 4); assert.equal(r.ratio, 4 / 5);
  assert.deepEqual(r.bounds, { x: 0, y: 0, width: 3, height: 3 });
});

test('ignoring missing-only pixels works without counting both-missing padding', () => {
  const a = rgba(3, 3), b = rgba(3, 3);
  const r = compare({ a, b, width: 3, height: 3,
    aSize: { width: 3, height: 1 }, bSize: { width: 1, height: 3 },
    ignores: [{ x: 1, y: 0, width: 2, height: 3 }] });
  assert.equal(r.ignored, 2); assert.equal(r.compared, 3); assert.equal(r.changed, 2);
});

test('rectangle normalization handles reverse dragging, fractions, and invalid coordinates', () => {
  assert.deepEqual(normalizeRect({ x: 4.4, y: 4.2, width: -3.2, height: -2.4 }, 10, 10), { x: 1, y: 1, width: 4, height: 4 });
  assert.equal(normalizeRect({ x: 11, y: 0, width: 1, height: 1 }, 10, 10), null);
  assert.equal(normalizeRect({ x: NaN, y: 0, width: 1, height: 1 }, 10, 10), null);
  assert.equal(normalizeRect(null, 10, 10), null);
});

test('malformed input fails explicitly rather than yielding misleading metrics', () => {
  const a = rgba(1, 1);
  assert.throws(() => compare({ a, b: a, width: 1.5, height: 1 }), TypeError);
  assert.throws(() => compare({ a, b: a, width: 1, height: 1, threshold: -1 }), RangeError);
  assert.throws(() => compare({ a, b: new Uint8ClampedArray(0), width: 1, height: 1 }), TypeError);
  assert.throws(() => compare({ a, b: a, width: 1, height: 1, aSize: { width: 2, height: 1 } }), RangeError);
});


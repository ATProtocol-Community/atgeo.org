import { test } from 'node:test';
import assert from 'node:assert/strict';

import { snapBox, bboxParam, centralBoxes, fitsBudget, findSearchableBox, boxLabel, boxNote } from '../src/js/places.js';

// About the demo's 506 by 470 map at z13 over London (centre -0.1276, 51.5072).
const LONDON_Z13 = [-0.14932, 51.494912, -0.10588, 51.519482];

test('snapBox snaps outward to the 0.01° grid', () => {
  assert.deepEqual(snapBox([-0.14932, 51.494912, -0.10588, 51.519482]), [-0.15, 51.49, -0.1, 51.52]);
  // Already on the grid: unchanged, so the SDK's own snapping leaves it alone.
  assert.deepEqual(snapBox([-75.19, 39.94, -75.14, 39.97]), [-75.19, 39.94, -75.14, 39.97]);
  // Float noise just off a grid line doesn't widen the box by a cell.
  assert.deepEqual(snapBox([0.1 + 0.2 - 0.3, 0, 0.07 * 3, 0.03]), [0, 0, 0.21, 0.03]);
  // 0.57 * 100 is 56.99999999999999 in floating point; it's still on the grid.
  assert.deepEqual(snapBox([0.57, 0.57, 0.6, 0.6]), [0.57, 0.57, 0.6, 0.6]);
});

test('snapBox never returns an empty span and stays on the globe', () => {
  assert.deepEqual(snapBox([1.234, 5.67, 1.234, 5.67]), [1.23, 5.67, 1.24, 5.68]);
  assert.deepEqual(snapBox([179.995, 89.995, 180, 90]), [179.99, 89.99, 180, 90]);
  assert.deepEqual(snapBox([-180, -90, -179.995, -89.995]), [-180, -90, -179.99, -89.99]);
  // A zero-width span at the limit opens downward, not past it.
  assert.deepEqual(snapBox([0, 90, 1, 90]), [0, 89.99, 1, 90]);
  assert.deepEqual(snapBox([180, 0, 180, 1]), [179.99, 0, 180, 1]);
});

test('bboxParam writes two decimals', () => {
  assert.equal(bboxParam([-0.15, 51.49, -0.1, 51.52]), '-0.15,51.49,-0.10,51.52');
});

test('centralBoxes halves the span around the centre, snapped, at most four', () => {
  const boxes = centralBoxes(LONDON_Z13);
  assert.ok(boxes.length >= 1 && boxes.length <= 4);
  // First box: the measured one on the live server.
  assert.deepEqual(boxes[0], [-0.14, 51.5, -0.11, 51.52]);
  const centre = [(LONDON_Z13[0] + LONDON_Z13[2]) / 2, (LONDON_Z13[1] + LONDON_Z13[3]) / 2];
  for (const [w, s, e, n] of boxes) {
    assert.ok(w <= centre[0] && centre[0] <= e && s <= centre[1] && centre[1] <= n, 'contains the centre');
  }
  // Each one is a different, strictly smaller region than the one before, and than the view.
  const area = ([w, s, e, n]) => (e - w) * (n - s);
  let prev = snapBox(LONDON_Z13);
  for (const b of boxes) {
    assert.ok(area(b) < area(prev) - 1e-12, `${b} is smaller than ${prev}`);
    prev = b;
  }
});

test('centralBoxes drops repeats that snapping produces at small spans', () => {
  // A view a little over one cell: every halving snaps to at most a 0.01°-0.02° box.
  const boxes = centralBoxes([10.004, 20.004, 10.016, 20.016]);
  const keys = boxes.map((b) => b.join());
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes(snapBox([10.004, 20.004, 10.016, 20.016]).join()));
});

test('centralBoxes drops a box that repeats an earlier one, not only the view', () => {
  // Halvings 1 and 2 both snap to 0.01–0.04, and 3 and 4 both to 0.02–0.03.
  assert.deepEqual(centralBoxes([0.001, 0.001, 0.049, 0.049]), [
    [0.01, 0.01, 0.04, 0.04],
    [0.02, 0.02, 0.03, 0.03],
  ]);
});

test('centralBoxes takes a step count', () => {
  assert.ok(centralBoxes([0, 0, 1, 1], 2).length <= 2);
  assert.deepEqual(centralBoxes([0, 0, 1, 1], 2), [[0.25, 0.25, 0.75, 0.75], [0.37, 0.37, 0.63, 0.63]]);
});

test('centralBoxes gives nothing for a view across the antimeridian', () => {
  assert.deepEqual(centralBoxes([179.9, -1, -179.9, 1]), []);
});

test('fitsBudget reads a getTiles answer', () => {
  assert.equal(fitsBudget(200, { tiles: ['a', 'b'] }), true);
  assert.equal(fitsBudget(200, { tiles: [] }), true);
  assert.equal(fitsBudget(200, { tiles: ['a'], overview: true }), false);
  assert.equal(fitsBudget(200, { tiles: ['a'], overview: false }), true);
  assert.equal(fitsBudget(400, { error: 'BboxTooLarge', message: 'x' }), false);
  assert.throws(() => fitsBudget(200, { nope: 1 }));
  assert.throws(() => fitsBudget(200, null));
  assert.throws(() => fitsBudget(400, { error: 'InvalidRequest' }));
  assert.throws(() => fitsBudget(502, null));
});

// A probe that answers from a set of fitting bbox strings, recording what it was asked.
function fakeProbe(fits) {
  const asked = [];
  const probe = async (bbox) => {
    asked.push(bbox);
    if (fits instanceof Error) throw fits;
    return typeof fits === 'function' ? fits(bbox, asked.length) : fits.has(bbox);
  };
  return { probe, asked };
}

test('findSearchableBox leaves a view that fits alone, after one probe', async () => {
  const { probe, asked } = fakeProbe(new Set(['-0.15,51.49,-0.10,51.52']));
  const r = await findSearchableBox(LONDON_Z13, probe);
  assert.deepEqual(r, { box: null });
  assert.deepEqual(asked, ['-0.15,51.49,-0.10,51.52']);
});

test('findSearchableBox returns the first central box that fits', async () => {
  const boxes = centralBoxes(LONDON_Z13);
  const { probe, asked } = fakeProbe(new Set([bboxParam(boxes[1])]));
  const r = await findSearchableBox(LONDON_Z13, probe);
  assert.deepEqual(r.box, boxes[1]);
  assert.deepEqual(asked, ['-0.15,51.49,-0.10,51.52', bboxParam(boxes[0]), bboxParam(boxes[1])]);
});

test('findSearchableBox gives no box when none fits, after the view and at most four boxes', async () => {
  const { probe, asked } = fakeProbe(() => false);
  const r = await findSearchableBox(LONDON_Z13, probe);
  assert.deepEqual(r, { box: null });
  assert.deepEqual(asked, [snapBox(LONDON_Z13), ...centralBoxes(LONDON_Z13)].map(bboxParam));
  assert.ok(asked.length <= 5);
});

test('findSearchableBox probes no more boxes than its step count', async () => {
  const { probe, asked } = fakeProbe(() => false);
  await findSearchableBox(LONDON_Z13, probe, { steps: 2 });
  assert.deepEqual(asked, [snapBox(LONDON_Z13), ...centralBoxes(LONDON_Z13, 2)].map(bboxParam));
  assert.equal(asked.length, 3);
});

test('findSearchableBox falls back to the view when a probe fails', async () => {
  const first = fakeProbe(new Error('network'));
  assert.deepEqual(await findSearchableBox(LONDON_Z13, first.probe), { box: null });
  const later = fakeProbe((_, n) => {
    if (n === 1) return false;
    throw new Error('boom');
  });
  assert.deepEqual(await findSearchableBox(LONDON_Z13, later.probe), { box: null });
  assert.equal(later.asked.length, 2);
});

test('findSearchableBox stops probing once the search is superseded', async () => {
  let current = true;
  const { probe, asked } = fakeProbe(() => {
    current = false;
    return false;
  });
  const r = await findSearchableBox(LONDON_Z13, probe, { isCurrent: () => current });
  assert.equal(asked.length, 1);
  assert.deepEqual(r, { box: null });
});

test('findSearchableBox does not probe a view across the antimeridian', async () => {
  const { probe, asked } = fakeProbe(() => false);
  assert.deepEqual(await findSearchableBox([179.9, -1, -179.9, 1], probe), { box: null });
  assert.equal(asked.length, 0);
});

test('boxLabel gives the longer side in kilometres', () => {
  // 0.03° of longitude at 51.5°N is 2.1 km; 0.02° of latitude is 2.2 km.
  assert.equal(boxLabel([-0.14, 51.5, -0.11, 51.52]), '~2 km');
  // Philadelphia's measured box: 4.3 by 4.4 km.
  assert.equal(boxLabel([-75.19, 39.93, -75.14, 39.97]), '~4 km');
  assert.equal(boxLabel([0, 0, 0.005, 0.005]), '~0.6 km');
  // The longer side, whichever it is.
  assert.equal(boxLabel([0, 0, 0.1, 0.02]), '~11 km');
  assert.equal(boxLabel([0, 0, 0.02, 0.1]), '~11 km');
  // Longitude shrinks with latitude: 0.1° at 60°N is 5.6 km.
  assert.equal(boxLabel([0, 60, 0.1, 60.02]), '~6 km');
  // Measured at the box's middle latitude (50°), not its south or north edge.
  assert.equal(boxLabel([0, 40, 40, 60]), '~2862 km');
});

test('boxNote says how much ground the search covered and what to do about the rest', () => {
  assert.equal(
    boxNote([-0.14, 51.5, -0.11, 51.52]),
    'Searched the central ~2 km; zoom in or pan to search elsewhere',
  );
});

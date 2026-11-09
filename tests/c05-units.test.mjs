import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrate, convertLength, distance3, sigma, virtualPixelDistance } from '../core.mjs';

test('C05 distance3 and virtualPixelDistance stay authoritative', () => {
  assert.equal(distance3([0, 0, 0], [1, 2, 2]), 3);
  assert.equal(virtualPixelDistance({ x: 0, y: 0 }, { x: 100, y: 0 }, 500, 5), 1);
});

test('C05 calibrate is an operator estimate and rejects measured 0 or non-finite', () => {
  const result = calibrate(1, 1.02);
  assert.equal(result.calibrationScale, 1 / 1.02);
  assert.equal(result.knownM, 1);
  assert.equal(result.measuredM, 1.02);
  assert.equal(result.label, 'operator-estimate');
  assert.equal(result.authoritative, false);
  assert.throws(() => calibrate(1, 0), /measured/i);
  assert.throws(() => calibrate(1, NaN), /measured/i);
  assert.throws(() => calibrate(1, Infinity), /measured/i);
  assert.throws(() => calibrate(1, -1), /measured/i);
  assert.throws(() => calibrate(0, 1), /known/i);
});

test('C05 sigma is pointSigma * sqrt(2) * calibrationScale', () => {
  const scale = 1 / 1.02;
  const result = sigma(0.02, scale);
  assert.ok(Math.abs(result.meters - (0.02 * Math.sqrt(2) * scale)) < 1e-12);
  assert.equal(result.pointSigma, 0.02);
  assert.equal(result.calibrationScale, scale);
  assert.equal(result.label, 'operator-estimate');
  assert.equal(result.authoritative, false);
  assert.throws(() => sigma(0.02, 0), /scale/i);
  assert.throws(() => sigma(NaN, 1), /sigma/i);
});

test('C05 length units convert meters to cm, mm, ft, and in', () => {
  assert.equal(convertLength(1, 'm', 'm'), 1);
  assert.equal(convertLength(1, 'm', 'cm'), 100);
  assert.equal(convertLength(1, 'm', 'mm'), 1000);
  assert.equal(convertLength(1, 'm', 'ft'), 1 / 0.3048);
  assert.equal(convertLength(1, 'm', 'in'), 1 / 0.0254);
  assert.equal(convertLength(0.3048, 'm', 'ft'), 1);
  assert.equal(convertLength(0.0254, 'm', 'in'), 1);
  assert.throws(() => convertLength(1, 'm', 'parsec'), /unit/i);
});

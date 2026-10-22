import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyCommissionCents, calculateOrderCommissionDeltaCents } from './commission-tiers.js';

test('progressive brackets apply only to turnover portions', () => {
  assert.equal(calculateMonthlyCommissionCents(0), 0);
  assert.equal(calculateMonthlyCommissionCents(49900), 2495);
  assert.equal(calculateMonthlyCommissionCents(50000), 2500);
  assert.equal(calculateMonthlyCommissionCents(100000), 5500);
  assert.equal(calculateMonthlyCommissionCents(200000), 11500);
  assert.equal(calculateMonthlyCommissionCents(1000000), 77500);
  assert.equal(calculateMonthlyCommissionCents(2000000), 187500);
  assert.equal(calculateMonthlyCommissionCents(5000000), 577500);
  assert.equal(calculateMonthlyCommissionCents(6000000), 727500);
});

test('order fee is incremental and monthly turnover resets by caller', () => {
  assert.equal(calculateOrderCommissionDeltaCents(0, 50000), 2500);
  assert.equal(calculateOrderCommissionDeltaCents(50000, 50000), 3000);
  assert.equal(calculateOrderCommissionDeltaCents(0, 50000), 2500);
});

test('rejects negative and fractional cent values', () => {
  assert.throws(() => calculateMonthlyCommissionCents(-1), RangeError);
  assert.throws(() => calculateMonthlyCommissionCents(10.5), RangeError);
});

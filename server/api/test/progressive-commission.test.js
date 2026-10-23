import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionForMonthlySales, incrementalCommission, commissionMonthKey, berlinCommissionMonth } from '../src/progressive-commission.js';

test('3% below first threshold', () => {
  assert.equal(commissionForMonthlySales(10000), 300);
  assert.equal(commissionForMonthlySales(49900), 1497);
});
test('marginal tiers not flat rates', () => {
  assert.equal(commissionForMonthlySales(50000), 1500);
  assert.equal(commissionForMonthlySales(60000), 2000);
  assert.equal(commissionForMonthlySales(200000), 9000);
});
test('incremental fees sum to same total', () => {
  let previous = 0, sum = 0;
  for (const amount of [19999, 30001, 149999, 300001, 500000, 1000000, 3000000, 100000]) {
    sum += incrementalCommission(previous, amount);
    previous += amount;
  }
  assert.equal(sum, commissionForMonthlySales(previous));
});
test('zero sales and validation', () => {
  assert.equal(commissionForMonthlySales(0), 0);
  assert.throws(() => commissionForMonthlySales(-1), RangeError);
  assert.throws(() => incrementalCommission(0, 1.5), RangeError);
  assert.equal(commissionMonthKey(2026, 10), '2026-10');
  assert.throws(() => commissionMonthKey(2026, 13), RangeError);
});

test('month boundary follows Berlin time, not UTC', () => {
  assert.equal(berlinCommissionMonth('2026-10-31T22:59:59Z'), '2026-10');
  assert.equal(berlinCommissionMonth('2026-10-31T23:00:00Z'), '2026-11');
  assert.equal(berlinCommissionMonth('2026-03-31T21:59:59Z'), '2026-03');
  assert.equal(berlinCommissionMonth('2026-03-31T22:00:00Z'), '2026-04');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionRateBps, commissionAmountCents, monthlyCommissionSnapshot } from '../commission-tiers.js';

test('new merchants and zero revenue start at 3%', () => {
  assert.equal(commissionRateBps(0), 300);
  assert.equal(monthlyCommissionSnapshot('2026-10').rateBps, 300);
});
test('monthly tiers are inclusive at upper bounds', () => {
  for (const [revenue, rate] of [[50000,300],[50001,500],[200000,500],[200001,700],[500000,700],[500001,800],[1000000,800],[1000001,1000]]) {
    assert.equal(commissionRateBps(revenue), rate);
  }
});
test('rate applies to entire current month sale, not marginal tiers', () => {
  assert.equal(commissionAmountCents(10000,500), 500);
  assert.equal(commissionAmountCents(10000,300), 300);
});
test('calendar-year rollover', () => {
  assert.deepEqual(monthlyCommissionSnapshot('2027-01',40000), {
    monthKey:'2027-01',basedOnMonthKey:'2026-12',previousMonthRevenueCents:40000,rateBps:300
  });
});
test('invalid negative revenue rejected', () => {
  assert.throws(() => commissionRateBps(-1), RangeError);
});

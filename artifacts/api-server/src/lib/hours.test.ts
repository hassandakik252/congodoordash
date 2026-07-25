import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenByHours, type BusinessHours } from "./hours";

// Sunday 2026-01-04 (getDay()===0), noon.
const sunNoon = new Date("2026-01-04T12:00:00");
const sunEarly = new Date("2026-01-04T06:00:00");
const sunLate = new Date("2026-01-04T23:30:00");

const daily8to22: BusinessHours = Array(7).fill({ open: "08:00", close: "22:00" });

test("no schedule → always open", () => {
  assert.equal(isOpenByHours(null, sunNoon), true);
  assert.equal(isOpenByHours(undefined, sunNoon), true);
  assert.equal(isOpenByHours([], sunNoon), true);
});

test("within / outside daily hours", () => {
  assert.equal(isOpenByHours(daily8to22, sunNoon), true);
  assert.equal(isOpenByHours(daily8to22, sunEarly), false);
  assert.equal(isOpenByHours(daily8to22, sunLate), false);
});

test("closed day (null) → closed", () => {
  const closedSunday: BusinessHours = [null, ...Array(6).fill({ open: "08:00", close: "22:00" })];
  assert.equal(isOpenByHours(closedSunday, sunNoon), false);
});

test("overnight range spanning midnight", () => {
  // Sunday 20:00 → Monday 02:00
  const overnight: BusinessHours = Array(7).fill({ open: "20:00", close: "02:00" });
  assert.equal(isOpenByHours(overnight, new Date("2026-01-04T21:00:00")), true, "Sun 21:00 open");
  assert.equal(isOpenByHours(overnight, new Date("2026-01-05T01:00:00")), true, "Mon 01:00 still open (spill)");
  assert.equal(isOpenByHours(overnight, new Date("2026-01-05T03:00:00")), false, "Mon 03:00 closed");
});

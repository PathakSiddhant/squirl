import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatDuration,
  formatHeight,
  formatVolume,
  formatWeight,
  parseDuration,
  parseEnergy,
  parseHeight,
  parseLength,
  parseMacro,
  parseQuantity,
  parseVolume,
  parseWeight,
  scaleDecimal,
} from './units';

test('a decimal written as text scales without floating-point drift', () => {
  // The whole reason this function exists: 72.5 * 1000 is not 72500 in floats
  // once it has been through a parse and a multiply.
  assert.equal(scaleDecimal('72.5', 1000), 72500);
  assert.equal(scaleDecimal('68.5', 1000), 68500);
  assert.equal(scaleDecimal('0.1', 1000), 100);
  assert.equal(scaleDecimal('2.7', 1000), 2700);
  assert.equal(scaleDecimal('1.65', 1000), 1650);
  assert.equal(scaleDecimal('104', 1000), 104000);
});

test('precision the unit cannot hold is dropped rather than rounded', () => {
  // Inventing a rounding rule for digits the unit cannot store would be
  // inventing precision.
  assert.equal(scaleDecimal('1.2345', 1000), 1234);
  assert.equal(scaleDecimal('.5', 1000), 500);
});

test('weight is read in every form a person actually writes it', () => {
  assert.deepEqual(parseWeight('104'), { value: 104000, unit: 'kg', assumed: true });
  assert.deepEqual(parseWeight('104 kg'), { value: 104000, unit: 'kg', assumed: false });
  assert.deepEqual(parseWeight('72.5kg'), { value: 72500, unit: 'kg', assumed: false });
  assert.deepEqual(parseWeight('72,5 kg'), { value: 72500, unit: 'kg', assumed: false });
  assert.equal(parseWeight('160 lb')?.unit, 'lb');
  assert.equal(parseWeight('160 lb')?.value, 72575);
  assert.equal(parseWeight('160lbs')?.value, 72575);
});

test('a bare weight takes the unit the reader prefers, and says it assumed', () => {
  const metric = parseWeight('154', 'kg');
  const imperial = parseWeight('154', 'lb');
  assert.equal(metric?.value, 154000);
  assert.equal(imperial?.value, 69853);
  assert.equal(metric?.assumed, true);
  assert.equal(imperial?.assumed, true);
});

test('stones and pounds parse, because a reading it cannot take is worse', () => {
  assert.equal(parseWeight('11 st 4')?.value, 71668);
  assert.equal(parseWeight('11st')?.value, 69853);
});

test('a weight outside any human range is refused rather than stored', () => {
  // Catches the misplaced decimal point, which is the realistic typo.
  assert.equal(parseWeight('7.2'), null);
  assert.equal(parseWeight('1040'), null);
  assert.equal(parseWeight('abc'), null);
  assert.equal(parseWeight(''), null);
});

test('height reads feet and inches in every ordinary spelling', () => {
  assert.equal(parseHeight("5'4")?.value, 1626);
  assert.equal(parseHeight(`5' 4"`)?.value, 1626);
  assert.equal(parseHeight('5ft4')?.value, 1626);
  assert.equal(parseHeight('5 ft 4 in')?.value, 1626);
  assert.equal(parseHeight('5 feet 4 inches')?.value, 1626);
  // The unicode prime a phone keyboard actually produces.
  assert.equal(parseHeight('5′4')?.value, 1626);
});

test('height in metric reads centimetres or metres by magnitude', () => {
  assert.equal(parseHeight('165 cm')?.value, 1650);
  assert.equal(parseHeight('163cm')?.value, 1630);
  assert.equal(parseHeight('1.65m')?.value, 1650);
  // No unit written: 165 is centimetres and 1.65 is metres, because the two
  // readings are three orders of magnitude apart and only one is a person.
  assert.equal(parseHeight('165')?.value, 1650);
  assert.equal(parseHeight('1.65')?.value, 1650);
});

test('height rounds back to feet and inches without producing 5 foot 12', () => {
  assert.equal(formatHeight(1626, 'ft'), `5'4"`);
  assert.equal(formatHeight(1650, 'cm'), '165 cm');
  // 1828 mm is 71.97 inches, which rounds to 72 — six feet exactly, not 5'12".
  assert.equal(formatHeight(1828, 'ft'), `6'0"`);
});

test('volume reads litres and millilitres without a dropdown', () => {
  assert.equal(parseVolume('2.5L')?.value, 2500);
  assert.equal(parseVolume('2.7 litres')?.value, 2700);
  assert.equal(parseVolume('2500ml')?.value, 2500);
  assert.equal(parseVolume('250 ml')?.value, 250);
  // A bare number: small means litres, large means millilitres.
  assert.equal(parseVolume('2.5')?.value, 2500);
  assert.equal(parseVolume('2500')?.value, 2500);
});

test('a food quantity keeps its own unit and its own precision', () => {
  assert.deepEqual(parseQuantity('68.5g'), { value: 68500, unit: 'g', assumed: false });
  assert.deepEqual(parseQuantity('68.5', 'g'), { value: 68500, unit: 'g', assumed: true });
  assert.deepEqual(parseQuantity('300ml'), { value: 300000, unit: 'ml', assumed: false });
  assert.deepEqual(parseQuantity('1 piece'), { value: 1000, unit: 'piece', assumed: false });
  assert.equal(parseQuantity('1kg')?.value, 1000000);
  assert.equal(parseQuantity('0'), null);
});

test('energy and macros parse to their fine units', () => {
  assert.equal(parseEnergy('393'), 393000);
  assert.equal(parseEnergy('393 kcal'), 393000);
  assert.equal(parseEnergy('1,800'), 1800000);
  assert.equal(parseMacro('25'), 25000);
  assert.equal(parseMacro('25.5g'), 25500);
  assert.equal(parseMacro('500mg'), 500);
});

test('sleep is read from a clock, a phrase, or a bare number', () => {
  assert.equal(parseDuration('7:12'), 432);
  assert.equal(parseDuration('7h 12m'), 432);
  assert.equal(parseDuration('7h'), 420);
  assert.equal(parseDuration('7.5h'), 450);
  assert.equal(parseDuration('450m'), 450);
  // Bare: under 24 is hours, above it is minutes. Nobody sleeps seven minutes.
  assert.equal(parseDuration('7'), 420);
  assert.equal(parseDuration('450'), 450);
  assert.equal(parseDuration('0'), null);
});

test('values round-trip back into the way they were written', () => {
  assert.equal(formatWeight(71800, 'kg'), '71.8 kg');
  assert.equal(formatWeight(72575, 'lb'), '160.0 lb');
  assert.equal(formatVolume(2100), '2.1 L');
  assert.equal(formatVolume(250), '250 ml');
  assert.equal(formatDuration(432), '7h 12m');
  assert.equal(formatDuration(420), '7h');
});

test('a tape measurement reads in centimetres or inches', () => {
  assert.equal(parseLength('84'), 840);
  assert.equal(parseLength('84 cm'), 840);
  assert.equal(parseLength('33 in'), 838);
  assert.equal(parseLength('840mm'), 840);
});

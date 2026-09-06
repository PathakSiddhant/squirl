/**
 * Three months of plausible Form history, for looking at the interface with
 * something in it.
 *
 * This is a development aid, not a fixture the application depends on. It
 * writes only to `form_*` tables — Ledger and Signal are never touched — and
 * everything it writes carries ordinary ids, so it can be undone by deleting
 * the rows it made (`node scripts/seed-form-demo.mjs --clear`).
 *
 * The numbers are generated rather than copied from anybody: a cut that loses
 * roughly half a kilo a week with real day-to-day water noise, food logged on
 * most days and not on others, a fortnight in the middle where nothing was
 * written down at all, and a handful of days marked explicitly unknown. That
 * mixture is the point — a screen that only ever looks good against perfect
 * data is a screen that has not been designed.
 */

import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:data/squirl.db' });
const clearOnly = process.argv.includes('--clear');

// ------------------------------------------------------------------ helpers

const DAY = 86_400_000;
const IST_OFFSET = 5.5 * 3600 * 1000;

/** IST day string, matching lib/date.ts. */
function dayString(ms) {
  return new Date(ms + IST_OFFSET).toISOString().slice(0, 10);
}

/** Deterministic noise, so re-running produces the same history. */
let noiseState = 20260906;
function rand() {
  noiseState = (noiseState * 1103515245 + 12345) & 0x7fffffff;
  return noiseState / 0x7fffffff;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const id = (prefix) => `${prefix}_seed${Math.floor(rand() * 1e9).toString(36)}`;

const now = Date.now();
const todayMs = now;
const TODAY = dayString(todayMs);

// ------------------------------------------------------------------- wipe

async function clear() {
  for (const table of [
    'form_food_logs',
    'form_entries',
    'form_weights',
    'form_measurements',
    'form_days',
    'form_notes',
    'form_target_history',
    'form_phase_metrics',
    'form_phases',
    'form_foods',
  ]) {
    await db.execute(`DELETE FROM ${table}`);
  }
  console.log('cleared every form_* table');
}

// ------------------------------------------------------------------- foods

/*
  A kitchen, not a catalogue. Fifteen things somebody actually cooks, which is
  what a real library looks like after three months of use.
*/
const KITCHEN = [
  ['Chapati', 1000, 'piece', 110, 3.5, 22, 2.5, 2.5],
  ['Cooked rice', 100000, 'g', 130, 2.7, 28, 0.3, 0.4],
  ['Dal tadka', 100000, 'g', 120, 6, 15, 4, 4],
  ['Paneer', 100000, 'g', 265, 18, 1.2, 21, 0],
  ['Curd', 100000, 'g', 60, 3.1, 4.7, 3.3, 0],
  ['Toned milk', 100000, 'ml', 58, 3.1, 4.7, 3, 0],
  ['Rolled oats', 100000, 'g', 389, 16.9, 66, 6.9, 10.6],
  ['Banana', 1000, 'piece', 105, 1.3, 27, 0.4, 3.1],
  ['Apple', 1000, 'piece', 95, 0.5, 25, 0.3, 4.4],
  ['Whey protein', 1000, 'serving', 120, 24, 3, 1.5, 0],
  ['Peanut butter', 100000, 'g', 588, 25, 20, 50, 6],
  ['Mixed veg sabzi', 100000, 'g', 110, 3, 12, 6, 3],
  ['Rajma masala', 100000, 'g', 175, 8, 24, 5, 6],
  ['Almonds', 100000, 'g', 579, 21, 22, 50, 12.5],
  ['Chai', 100000, 'ml', 40, 1, 5, 1.5, 0],
];

/** A day's eating, as amounts of the things above. */
const MEALS = {
  breakfast: [
    [['Rolled oats', 60], ['Toned milk', 200], ['Banana', 1]],
    [['Chapati', 2], ['Curd', 150], ['Chai', 150]],
    [['Rolled oats', 50], ['Peanut butter', 15], ['Apple', 1]],
  ],
  lunch: [
    [['Chapati', 3], ['Dal tadka', 200], ['Mixed veg sabzi', 150]],
    [['Cooked rice', 200], ['Rajma masala', 200], ['Curd', 100]],
    [['Chapati', 2], ['Paneer', 100], ['Mixed veg sabzi', 120]],
  ],
  dinner: [
    [['Chapati', 2], ['Dal tadka', 180], ['Curd', 100]],
    [['Cooked rice', 150], ['Mixed veg sabzi', 200]],
    [['Paneer', 120], ['Chapati', 2]],
  ],
  extras: [
    [['Whey protein', 1]],
    [['Almonds', 25]],
    [['Chai', 150], ['Almonds', 15]],
    [],
  ],
};

// ------------------------------------------------------------------- main

async function seed() {
  await clear();

  // --- profile -----------------------------------------------------------
  await db.execute({
    sql: `INSERT INTO form_profile (id, height_mm, birth_year, sex, activity, weight_unit,
            height_unit, volume_unit, weigh_cadence, weigh_every_days, created_at, updated_at)
          VALUES ('me', 1700, 1998, 'male', 'light', 'kg', 'cm', 'ml', 'daily', 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET height_mm = 1700, updated_at = excluded.updated_at`,
    args: [now, now],
  });

  // --- foods -------------------------------------------------------------
  const foodIds = new Map();
  for (const [name, refQty, unit, kcal, p, c, f, fib] of KITCHEN) {
    const fid = id('ffd');
    foodIds.set(name, fid);
    await db.execute({
      sql: `INSERT INTO form_foods (id, name, ref_quantity, ref_unit, energy_mcal, protein_mg,
              carbs_mg, fat_mg, fiber_mg, confidence, use_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'known', 0, ?, ?)`,
      args: [
        fid, name, refQty, unit,
        Math.round(kcal * 1000), Math.round(p * 1000), Math.round(c * 1000),
        Math.round(f * 1000), Math.round(fib * 1000), now, now,
      ],
    });
  }
  const reference = new Map(KITCHEN.map((row) => [row[0], row]));

  // --- phases ------------------------------------------------------------
  // A finished maintenance block, then the cut that is running now, so the
  // history page has something in it and the graph spans a real stretch.
  const cutStart = dayString(todayMs - 89 * DAY);
  const cutTarget = dayString(todayMs + 93 * DAY);
  const oldStart = dayString(todayMs - 180 * DAY);
  const oldEnd = dayString(todayMs - 90 * DAY);

  const oldId = id('fph');
  await db.execute({
    sql: `INSERT INTO form_phases (id, name, kind, status, start_day, target_day, ended_day,
            start_weight_g, target_weight_g, final_weight_g, note, created_at, updated_at)
          VALUES (?, 'Maintenance', 'maintenance', 'completed', ?, ?, ?, 76200, 76000, 76400,
            'Held steady through the wedding season. Worth repeating.', ?, ?)`,
    args: [oldId, oldStart, oldEnd, oldEnd, now, now],
  });

  const phaseId = id('fph');
  await db.execute({
    sql: `INSERT INTO form_phases (id, name, kind, status, start_day, target_day,
            start_weight_g, target_weight_g, created_at, updated_at)
          VALUES (?, 'Cut', 'cut', 'active', ?, ?, 76400, 68000, ?, ?)`,
    args: [phaseId, cutStart, cutTarget, now, now],
  });

  const METRICS = [
    ['weight', 1, 'around', 68000],
    ['energy', 1, 'at-most', 2080000],
    ['protein', 1, 'at-least', 135000],
    ['carbs', 0, 'around', null],
    ['fat', 0, 'around', null],
    ['fiber', 0, 'at-least', null],
    ['water', 1, 'at-least', 2500],
    ['creatine', 1, 'at-least', 1],
    ['movement', 1, 'at-least', 8000],
    ['sleep', 1, 'at-least', 450],
    ['mood', 0, 'around', null],
  ];
  for (const [metric, enabled, direction, target] of METRICS) {
    await db.execute({
      sql: `INSERT INTO form_phase_metrics (id, phase_id, metric, enabled, direction, target,
              recommended, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id('fpm'), phaseId, metric, enabled, direction, target, target, now, now],
    });
  }

  // --- the days ----------------------------------------------------------
  let weight = 76400;
  let logged = 0;
  let foodRows = 0;

  for (let back = 89; back >= 0; back -= 1) {
    const ms = todayMs - back * DAY;
    const day = dayString(ms);
    const elapsed = 89 - back;

    /*
      Three stretches, because a real three months is not uniform:
        weeks 1-5   keen, almost everything logged
        weeks 6-7   a fortnight where nothing was written down at all
        weeks 8-13  back to it, a little looser
    */
    const gap = elapsed >= 35 && elapsed < 49;
    const keen = elapsed < 35;

    // Weight: a steady loss with real scale noise on top, and a plateau in
    // the middle where the trend flattens the way they actually do.
    const drift = elapsed < 45 ? 62 : elapsed < 60 ? 18 : 55;
    weight -= drift + Math.round((rand() - 0.5) * 240);
    const weighed = keen ? rand() > 0.08 : gap ? rand() > 0.75 : rand() > 0.25;

    if (weighed) {
      await db.execute({
        sql: `INSERT INTO form_weights (id, day, grams, created_at) VALUES (?, ?, ?, ?)`,
        args: [id('fwt'), day, weight, ms],
      });
    }

    const untracked = !gap && rand() > 0.94;
    const eats = !gap && !untracked && (keen ? rand() > 0.05 : rand() > 0.2);

    await db.execute({
      sql: `INSERT INTO form_days (day, phase_id, nutrition_untracked, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [day, phaseId, untracked ? 1 : 0, ms, ms],
    });

    if (eats) {
      logged += 1;
      const plate = [
        ...pick(MEALS.breakfast),
        ...pick(MEALS.lunch),
        ...pick(MEALS.dinner),
        ...pick(MEALS.extras),
      ];

      for (const [name, amount] of plate) {
        const [, refQty, unit, kcal, p, c, f, fib] = reference.get(name);
        // Fine units: the amount as typed, scaled the way the app scales it.
        const quantity = unit === 'g' || unit === 'ml' ? amount * 1000 : amount * 1000;
        const share = quantity / refQty;
        await db.execute({
          sql: `INSERT INTO form_food_logs (id, day, food_id, name, quantity, unit, energy_mcal,
                  protein_mg, carbs_mg, fat_mg, fiber_mg, confidence, logged_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'known', ?)`,
          args: [
            id('ffl'), day, foodIds.get(name), name, quantity, unit,
            Math.round(kcal * 1000 * share), Math.round(p * 1000 * share),
            Math.round(c * 1000 * share), Math.round(f * 1000 * share),
            Math.round(fib * 1000 * share), ms,
          ],
        });
        foodRows += 1;
      }

      await db.execute({
        sql: `UPDATE form_foods SET use_count = use_count + 1, last_used_at = ?
              WHERE id IN (${plate.map(() => '?').join(',')})`,
        args: [ms, ...plate.map(([name]) => foodIds.get(name))],
      });
    }

    // The rest of the day's metrics.
    const entries = [];
    if (!gap) {
      const water = keen ? 2200 + Math.round(rand() * 900) : 1500 + Math.round(rand() * 1400);
      entries.push(['water', water, 0]);
      entries.push(['creatine', rand() > (keen ? 0.12 : 0.35) ? 1 : 0, 0]);
      entries.push([
        'movement',
        Math.round(4000 + rand() * 8000),
        0,
      ]);
      if (rand() > 0.15) entries.push(['sleep', Math.round(380 + rand() * 130), 0]);
    } else if (rand() > 0.6) {
      entries.push(['creatine', 1, 0]);
    }

    for (const [metric, value, untrackedFlag] of entries) {
      await db.execute({
        sql: `INSERT INTO form_entries (id, day, metric, value, untracked, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id('fen'), day, metric, value, untrackedFlag, ms, ms],
      });
    }
  }

  // --- the tape ----------------------------------------------------------
  const tape = { Waist: 890, Chest: 1010, Arm: 335, Thigh: 570 };
  for (let week = 12; week >= 0; week -= 2) {
    const ms = todayMs - week * 7 * DAY;
    for (const [site, base] of Object.entries(tape)) {
      const shrink = site === 'Waist' ? (12 - week) * 4 : (12 - week) * 1.2;
      await db.execute({
        sql: `INSERT INTO form_measurements (id, day, site, value_mm, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [id('fms'), dayString(ms), site, Math.round(base - shrink), ms],
      });
    }
  }

  // --- notes -------------------------------------------------------------
  const NOTES = [
    [78, phaseId, 1, 'Dropping below 1,900 makes the evenings unbearable. 2,080 is the floor that actually works.'],
    [64, phaseId, 0, 'Weighing before chai and after the bathroom, every morning. Anything else adds half a kilo of noise.'],
    [51, phaseId, 1, 'Protein is the whole game. On the days I hit 135 I am not hungry at nine at night.'],
    [40, phaseId, 0, 'Two weeks off tracking over the trip. The scale barely moved — worth remembering next time I panic.'],
    [22, phaseId, 0, 'Paneer 100 g + 3 chapati is the lunch I never get bored of.'],
    [9, phaseId, 0, 'Plateau at 73 for nine days and then it broke on its own. Do not touch the calories next time.'],
    [120, oldId, 0, 'Maintenance was easier than expected. Holding is a skill worth having before cutting again.'],
  ];
  for (const [back, forPhase, pinned, body] of NOTES) {
    const ms = todayMs - back * DAY;
    await db.execute({
      sql: `INSERT INTO form_notes (id, phase_id, body, pinned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id('fnt'), forPhase, body, pinned, ms, ms],
    });
  }

  console.log(`seeded 90 days · ${logged} days of food · ${foodRows} food rows`);
  console.log(`cut runs ${cutStart} → ${cutTarget}, now at ${(weight / 1000).toFixed(1)} kg`);
  console.log(`today is ${TODAY}`);
}

if (clearOnly) await clear();
else await seed();

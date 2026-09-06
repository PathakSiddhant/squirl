/**
 * What kind of thing a food is, worked out from its name.
 *
 * Used for two things and no others: which icon stands in until a photograph
 * arrives, and which tint the tile behind it takes. It is a guess and it is
 * allowed to be wrong — nothing is stored from it, nothing is calculated from
 * it, and a wrong guess costs a slightly odd icon on one row.
 *
 * There is deliberately no exhaustive list of foods anywhere in this file. An
 * earlier version shipped a two-hundred-item catalogue on shelves you browsed,
 * and it was the wrong shape: the library is meant to be the twenty things
 * somebody actually eats, and a list to scroll is a worse way to add one than
 * typing its name.
 */

export type FoodKind =
  | 'grain'
  | 'pulse'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'nut'
  | 'sweet'
  | 'drink'
  | 'oil'
  | 'other';

/*
  Order matters: the first rule that matches wins, so the narrow categories run
  before the broad ones. "Buttermilk" has to reach the drink rule before the
  dairy rule sees "butter" inside it.
*/
const RULES: Array<[FoodKind, string[]]> = [
  [
    'drink',
    [
      'tea', 'chai', 'coffee', 'juice', 'shake', 'smoothie', 'water', 'cola', 'soda',
      'lassi', 'buttermilk',
    ],
  ],
  ['nut', ['almond', 'cashew', 'walnut', 'pista', 'peanut', 'seed', 'sesame']],
  [
    'dairy',
    [
      'milk', 'curd', 'dahi', 'yoghurt', 'yogurt', 'paneer', 'cheese', 'cream', 'khoya',
      'whey', 'butter',
    ],
  ],
  [
    'grain',
    [
      'roti', 'chapati', 'phulka', 'paratha', 'naan', 'kulcha', 'puri', 'bread', 'toast',
      'pav', 'rice', 'pulao', 'biryani', 'khichdi', 'poha', 'upma', 'idli', 'dosa', 'oats',
      'muesli', 'pasta', 'noodle', 'flour', 'atta', 'maida', 'rava', 'suji', 'quinoa',
      'daliya', 'cereal',
    ],
  ],
  [
    'pulse',
    [
      'dal', 'daal', 'lentil', 'rajma', 'chole', 'chana', 'chickpea', 'bean', 'soya',
      'tofu', 'sprout', 'sambar', 'peas',
    ],
  ],
  [
    'sweet',
    [
      'sugar', 'jaggery', 'honey', 'chocolate', 'cake', 'biscuit', 'cookie', 'halwa',
      'kheer', 'ladoo', 'barfi', 'rasgulla', 'jalebi', 'ice cream', 'sweet', 'dessert',
      'muffin',
    ],
  ],
  [
    'fruit',
    [
      'apple', 'banana', 'mango', 'orange', 'grape', 'melon', 'papaya', 'guava', 'pear',
      'kiwi', 'berry', 'pineapple', 'pomegranate', 'date', 'raisin', 'coconut', 'avocado',
      'fruit', 'lemon',
    ],
  ],
  ['oil', ['oil', 'ghee', 'mayonnaise', 'sauce', 'ketchup', 'pickle', 'chutney', 'dressing']],
  [
    'vegetable',
    [
      'potato', 'aloo', 'tomato', 'onion', 'spinach', 'palak', 'methi', 'gobi',
      'cauliflower', 'cabbage', 'carrot', 'capsicum', 'brinjal', 'baingan', 'gourd',
      'lauki', 'bhindi', 'okra', 'cucumber', 'pumpkin', 'mushroom', 'broccoli', 'beet',
      'radish', 'corn', 'salad', 'sabzi', 'vegetable', 'saag', 'curry',
    ],
  ],
];

export function kindOf(name: string): FoodKind {
  const text = name.toLowerCase();
  for (const [kind, words] of RULES) {
    if (words.some((word) => text.includes(word))) return kind;
  }
  return 'other';
}

/**
 * One tint per kind, written as bare OKLCH components.
 *
 * Bare rather than complete colours so a single token can serve as the wash
 * behind an icon, the line around it and the icon itself at three different
 * alphas, without needing three variables for every kind.
 */
export const KIND_TINT: Record<FoodKind, string> = {
  grain: '0.62 0.11 76',
  pulse: '0.55 0.12 52',
  vegetable: '0.52 0.11 148',
  fruit: '0.58 0.15 24',
  dairy: '0.55 0.07 238',
  nut: '0.5 0.08 62',
  sweet: '0.57 0.13 348',
  drink: '0.54 0.09 206',
  oil: '0.58 0.11 92',
  other: '0.52 0.04 40',
};

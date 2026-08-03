import type { AccountKind, CategoryFlow } from './schema';

/**
 * The starting shape of a new ledger.
 *
 * Categories are chosen for the person in PRODUCT.md, not for a generic
 * budgeting app: chai and snacks is its own line because it is where a hundred
 * small UPI taps actually go, and "sent to parents" is deliberately absent from
 * the expense list because it is a transfer, not a spend.
 */

export interface SeedAccount {
  key: string;
  name: string;
  kind: AccountKind;
  note: string;
  sortOrder: number;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { key: 'bank', name: 'Bank', kind: 'bank', note: 'Where the stipend lands', sortOrder: 0 },
  { key: 'cash', name: 'Cash', kind: 'cash', note: 'Notes in your pocket', sortOrder: 1 },
  { key: 'wallet', name: 'Wallet', kind: 'wallet', note: 'Paytm, PhonePe and the rest', sortOrder: 2 },
  {
    key: 'parents',
    name: 'Parents',
    kind: 'parked',
    note: 'Money you sent home. Still yours, deliberately out of reach.',
    sortOrder: 3,
  },
];

export interface SeedCategory {
  key: string;
  name: string;
  flow: CategoryFlow;
  icon: string;
  keywords: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { key: 'chai', name: 'Chai and snacks', flow: 'out', icon: 'Coffee', keywords: 'chai,tea,coffee,snack,samosa,maggi,biscuit,cigarette,sutta' },
  { key: 'food', name: 'Food delivery', flow: 'out', icon: 'ForkKnife', keywords: 'zomato,swiggy,order,dominos,pizza,burger,biryani,khana' },
  { key: 'eatout', name: 'Eating out', flow: 'out', icon: 'BowlFood', keywords: 'restaurant,cafe,dinner,lunch,mess,canteen,dhaba' },
  { key: 'groceries', name: 'Groceries', flow: 'out', icon: 'Basket', keywords: 'grocery,groceries,blinkit,zepto,instamart,bigbasket,sabzi,milk,vegetables' },
  { key: 'travel', name: 'Travel', flow: 'out', icon: 'Bus', keywords: 'auto,uber,ola,rapido,metro,bus,train,cab,petrol,fuel,ticket' },
  { key: 'rent', name: 'Rent and bills', flow: 'out', icon: 'House', keywords: 'rent,pg,electricity,water,maintenance,wifi,broadband' },
  { key: 'phone', name: 'Phone and internet', flow: 'out', icon: 'DeviceMobile', keywords: 'recharge,jio,airtel,vi,data,mobile' },
  { key: 'subs', name: 'Subscriptions', flow: 'out', icon: 'Repeat', keywords: 'netflix,spotify,prime,youtube,subscription,hotstar,chatgpt' },
  { key: 'shopping', name: 'Shopping', flow: 'out', icon: 'ShoppingBag', keywords: 'amazon,flipkart,myntra,clothes,shoes,shirt,shopping' },
  { key: 'health', name: 'Health', flow: 'out', icon: 'Heartbeat', keywords: 'medicine,pharmacy,doctor,gym,hospital,chemist' },
  { key: 'fun', name: 'Going out', flow: 'out', icon: 'FilmSlate', keywords: 'movie,cinema,pvr,party,outing,concert,game' },
  { key: 'gifts', name: 'Gifts and giving', flow: 'out', icon: 'Gift', keywords: 'gift,birthday,donation,tip' },
  { key: 'fees', name: 'Fees and charges', flow: 'out', icon: 'Receipt', keywords: 'fee,charge,penalty,fine,gst,convenience' },
  { key: 'misc', name: 'Everything else', flow: 'out', icon: 'DotsThree', keywords: 'misc,other,random' },

  { key: 'stipend', name: 'Stipend', flow: 'in', icon: 'Briefcase', keywords: 'stipend,salary,intern,internship' },
  { key: 'side', name: 'Side income', flow: 'in', icon: 'Lightning', keywords: 'freelance,gig,project,client,commission' },
  { key: 'fromhome', name: 'From family', flow: 'in', icon: 'HandHeart', keywords: 'papa,mummy,mom,dad,parents,home,family' },
  { key: 'refund', name: 'Refunds and cashback', flow: 'in', icon: 'ArrowUDownLeft', keywords: 'refund,cashback,reversal,returned money' },
  { key: 'other-in', name: 'Other income', flow: 'in', icon: 'Coins', keywords: 'prize,scholarship,bonus,sold' },
];

export const SEED_SETTINGS: Record<string, string> = {
  /** Days ahead a promise counts against today. */
  horizonDays: '30',
  /** Untouchable floor, in paise. 500 rupees by default. */
  buffer: '50000',
  /** Trailing window for the burn rate, in days. */
  burnWindowDays: '7',
  theme: 'system',
  onboarded: 'false',
};

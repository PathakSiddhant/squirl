import { FoodLibrary } from '@/components/form/food-library';
import { listFoods } from '@/lib/form/foods';

export const metadata = { title: 'Food · Form' };
export const dynamic = 'force-dynamic';

/** The personal food library. Nothing public, nothing synced, nothing scanned. */
export default async function FormFood() {
  return <FoodLibrary foods={await listFoods()} />;
}

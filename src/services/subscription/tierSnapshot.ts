// A plain, module-level copy of the signed-in account's tier, for code that is not a React component
// (for example the service that saves a customer automatically when a sale names a new one) and so
// cannot read the context. The Dashboard keeps it up to date; it starts as "business" (no limits) so
// nothing is ever blocked before the real tier is known.
import type { Tier } from './entitlements';

let current: Tier = 'business';

export function setTierSnapshot(tier: Tier): void {
  current = tier;
}

export function getTierSnapshot(): Tier {
  return current;
}

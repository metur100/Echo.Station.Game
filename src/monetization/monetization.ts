/**
 * Monetization boundary. Version 1.0 has no purchases and no ads, and the full campaign is free.
 * No purchase or ad UI is shown anywhere, because nothing here is operational.
 *
 * Planned, optional and never pay-to-win:
 *   - cosmetic ship liveries
 *   - a premium campaign expansion
 *   - rewarded ads for cosmetic rewards only, and a one-time ad removal
 *
 * Wiring a real store (e.g. RevenueCat or expo-iap) needs store accounts, product setup in Play
 * Console / App Store Connect, a development build and updated privacy disclosures. Implement
 * MonetizationProvider and register it; the game checks `isAvailable()` before showing anything.
 */
export interface Product {
  id: string;
  kind: 'cosmetic' | 'expansion' | 'remove_ads';
  title: string;
  price: string;
}

export interface MonetizationProvider {
  isAvailable(): boolean;
  products(): Promise<Product[]>;
  purchase(productId: string): Promise<{ ok: boolean; error?: string }>;
  restore(): Promise<string[]>;
}

export const disabledProvider: MonetizationProvider = {
  isAvailable: () => false,
  products: async () => [],
  purchase: async () => ({ ok: false, error: 'not_available' }),
  restore: async () => [],
};

let provider: MonetizationProvider = disabledProvider;

export function setMonetizationProvider(p: MonetizationProvider) {
  provider = p;
}

export function monetization(): MonetizationProvider {
  return provider;
}

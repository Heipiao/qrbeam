import type { SubscriptionProduct } from '../native/QRBeamNative';

export function isSubscriptionProductUnavailable(
  productsLoading: boolean,
  products: ReadonlyArray<SubscriptionProduct>,
  productId: string,
): boolean {
  return productsLoading || !products.some(product => product.id === productId);
}

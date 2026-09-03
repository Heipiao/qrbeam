import { isSubscriptionProductUnavailable } from '../src/membership/products';
import {
  SUBSCRIPTION_PRODUCT_IDS,
  type SubscriptionProduct,
} from '../src/native/QRBeamNative';

const monthlyProduct: SubscriptionProduct = {
  id: SUBSCRIPTION_PRODUCT_IDS.monthly,
  displayName: 'Monthly',
  description: 'Monthly Pro',
  displayPrice: '$0.99',
};

describe('subscription product availability', () => {
  test('keeps every plan disabled while StoreKit is loading', () => {
    expect(
      isSubscriptionProductUnavailable(
        true,
        [monthlyProduct],
        SUBSCRIPTION_PRODUCT_IDS.monthly,
      ),
    ).toBe(true);
  });

  test('enables a product returned by StoreKit', () => {
    expect(
      isSubscriptionProductUnavailable(
        false,
        [monthlyProduct],
        SUBSCRIPTION_PRODUCT_IDS.monthly,
      ),
    ).toBe(false);
  });

  test('keeps a missing product disabled when StoreKit returns a partial list', () => {
    expect(
      isSubscriptionProductUnavailable(
        false,
        [monthlyProduct],
        SUBSCRIPTION_PRODUCT_IDS.yearly,
      ),
    ).toBe(true);
  });
});

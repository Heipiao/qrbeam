import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  addMembershipStatusListener,
  getMembershipStatus,
  getSubscriptionProducts,
  purchaseSubscription,
  restorePurchases,
  type MembershipStatus,
  type PurchaseResult,
  type SubscriptionProduct,
} from '../native/QRBeamNative';

export interface MembershipController {
  status?: MembershipStatus;
  products: SubscriptionProduct[];
  loading: boolean;
  productsLoading: boolean;
  actionProductId?: string;
  restoring: boolean;
  refresh(): Promise<MembershipStatus | undefined>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<MembershipStatus>;
  updateStatus(status: MembershipStatus): void;
}

export function useMembership(): MembershipController {
  const [status, setStatus] = useState<MembershipStatus>();
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [actionProductId, setActionProductId] = useState<string>();
  const [restoring, setRestoring] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getMembershipStatus();
      setStatus(next);
      return next;
    } catch (error) {
      console.info('[QRBeam] membership refresh failed', error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      setProducts(await getSubscriptionProducts());
    } catch (error) {
      console.info('[QRBeam] subscription products unavailable', error);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    refreshProducts().catch(() => undefined);
    const removeMembershipListener = addMembershipStatusListener(setStatus);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh().catch(() => undefined);
        refreshProducts().catch(() => undefined);
      }
    });
    return () => {
      subscription.remove();
      removeMembershipListener();
    };
  }, [refresh, refreshProducts]);

  const purchase = useCallback(async (productId: string) => {
    setActionProductId(productId);
    try {
      const result = await purchaseSubscription(productId);
      setStatus(result.membership);
      return result;
    } finally {
      setActionProductId(undefined);
    }
  }, []);

  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const next = await restorePurchases();
      setStatus(next);
      return next;
    } finally {
      setRestoring(false);
    }
  }, []);

  return {
    status,
    products,
    loading,
    productsLoading,
    actionProductId,
    restoring,
    refresh,
    purchase,
    restore,
    updateStatus: setStatus,
  };
}

import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type NativeModule,
} from 'react-native';

export const SUBSCRIPTION_PRODUCT_IDS = {
  monthly: 'com.leoliu.qrbeamreceiver.pro.monthly',
  yearly: 'com.leoliu.qrbeamreceiver.pro.yearly',
} as const;

export const FREE_MAX_FILE_SIZE = 1 * 1024 * 1024;
export const PRO_MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface MembershipStatus {
  isPro: boolean;
  productId?: string;
  expirationDate?: string;
  freeSendsUsed: number;
  freeSendsRemaining: number;
  freeMaxBytes: number;
  proMaxBytes: number;
}

export interface SubscriptionProduct {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
  periodUnit?: 'day' | 'week' | 'month' | 'year' | 'unknown';
  periodValue?: number;
}

export interface PurchaseResult {
  outcome: 'purchased' | 'pending' | 'cancelled' | 'unknown';
  membership: MembershipStatus;
}

export interface SendAuthorization {
  allowed: boolean;
  reason:
    | 'pro'
    | 'free'
    | 'file_too_large'
    | 'free_file_too_large'
    | 'free_daily_limit';
  membership?: MembershipStatus;
}

export interface PendingSharedFile {
  id: string;
  fileName: string;
  mime: string;
  fileSize: number;
  filePath: string;
}

interface QRBeamNativeModule extends NativeModule {
  getPendingSharedFile(): Promise<PendingSharedFile | null>;
  clearPendingSharedFile(id: string): Promise<boolean>;
  setIdleTimerDisabled(enabled: boolean): void;
  getMembershipStatus(): Promise<MembershipStatus>;
  getSubscriptionProducts(): Promise<SubscriptionProduct[]>;
  purchaseSubscription(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<MembershipStatus>;
  authorizeSend(fileSize: number): Promise<SendAuthorization>;
}

const nativeModule = NativeModules.QRBeamNative as QRBeamNativeModule | undefined;
const membershipChangedEvent = 'QRBeamMembershipChanged';

export function addMembershipStatusListener(
  listener: (status: MembershipStatus) => void,
): () => void {
  if (Platform.OS !== 'ios' || nativeModule == null) return () => undefined;
  const subscription = new NativeEventEmitter(nativeModule).addListener(
    membershipChangedEvent,
    listener,
  );
  return () => subscription.remove();
}

export async function getPendingSharedFile(): Promise<PendingSharedFile | null> {
  if (Platform.OS !== 'ios' || nativeModule == null) return null;
  return nativeModule.getPendingSharedFile();
}

export async function clearPendingSharedFile(id: string): Promise<void> {
  if (Platform.OS === 'ios' && nativeModule != null) {
    await nativeModule.clearPendingSharedFile(id);
  }
}

export function setIdleTimerDisabled(enabled: boolean): void {
  if (Platform.OS === 'ios' && nativeModule != null) {
    nativeModule.setIdleTimerDisabled(enabled);
  }
}

function requireNativeModule(): QRBeamNativeModule {
  if (Platform.OS !== 'ios' || nativeModule == null) {
    throw new Error('QRBeam subscriptions are available only in the iOS app.');
  }
  return nativeModule;
}

export function getMembershipStatus(): Promise<MembershipStatus> {
  return requireNativeModule().getMembershipStatus();
}

export function getSubscriptionProducts(): Promise<SubscriptionProduct[]> {
  return requireNativeModule().getSubscriptionProducts();
}

export function purchaseSubscription(productId: string): Promise<PurchaseResult> {
  return requireNativeModule().purchaseSubscription(productId);
}

export function restorePurchases(): Promise<MembershipStatus> {
  return requireNativeModule().restorePurchases();
}

export function authorizeSend(fileSize: number): Promise<SendAuthorization> {
  return requireNativeModule().authorizeSend(fileSize);
}

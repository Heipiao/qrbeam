import {NativeModules, Platform} from 'react-native';

export interface PendingSharedFile {
  id: string;
  fileName: string;
  mime: string;
  fileSize: number;
  filePath: string;
}

interface QRBeamNativeModule {
  getPendingSharedFile(): Promise<PendingSharedFile | null>;
  clearPendingSharedFile(id: string): Promise<boolean>;
  setIdleTimerDisabled(enabled: boolean): void;
}

const nativeModule = NativeModules.QRBeamNative as QRBeamNativeModule | undefined;

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

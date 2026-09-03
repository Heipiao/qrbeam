import {
  FREE_MAX_FILE_SIZE,
  PRO_MAX_FILE_SIZE,
  type MembershipStatus,
} from '../native/QRBeamNative';

export type SendRestriction =
  | 'file_too_large'
  | 'free_file_too_large'
  | 'free_daily_limit';

export function getSendRestriction(
  status: MembershipStatus | undefined,
  fileSize: number,
): SendRestriction | undefined {
  if (fileSize > PRO_MAX_FILE_SIZE) return 'file_too_large';
  if (status == null || status.isPro) return undefined;
  if (fileSize > FREE_MAX_FILE_SIZE) return 'free_file_too_large';
  if (status.freeSendsRemaining <= 0) return 'free_daily_limit';
  return undefined;
}

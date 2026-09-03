import { getSendRestriction } from '../src/membership/policy';
import {
  FREE_MAX_FILE_SIZE,
  PRO_MAX_FILE_SIZE,
  type MembershipStatus,
} from '../src/native/QRBeamNative';

function status(overrides: Partial<MembershipStatus> = {}): MembershipStatus {
  return {
    isPro: false,
    freeSendsUsed: 0,
    freeSendsRemaining: 1,
    freeMaxBytes: FREE_MAX_FILE_SIZE,
    proMaxBytes: PRO_MAX_FILE_SIZE,
    ...overrides,
  };
}

describe('membership send policy', () => {
  test('allows one free send up to 1 MiB', () => {
    expect(getSendRestriction(status(), FREE_MAX_FILE_SIZE)).toBeUndefined();
  });

  test('blocks free files larger than 1 MiB', () => {
    expect(getSendRestriction(status(), FREE_MAX_FILE_SIZE + 1)).toBe(
      'free_file_too_large',
    );
  });

  test('blocks a second free send on the same day', () => {
    expect(
      getSendRestriction(
        status({ freeSendsUsed: 1, freeSendsRemaining: 0 }),
        1024,
      ),
    ).toBe('free_daily_limit');
  });

  test('allows Pro sends up to the protocol limit', () => {
    expect(
      getSendRestriction(
        status({ isPro: true, freeSendsRemaining: 0 }),
        PRO_MAX_FILE_SIZE,
      ),
    ).toBeUndefined();
  });

  test('keeps the 5 MiB protocol limit for every user', () => {
    expect(
      getSendRestriction(status({ isPro: true }), PRO_MAX_FILE_SIZE + 1),
    ).toBe('file_too_large');
  });
});

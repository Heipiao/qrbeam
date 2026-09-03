import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppButton } from '../components/AppButton';
import {
  QRB1SenderSession,
  TRANSFER_PROFILES,
  type ProfileName,
} from '../protocol/qrb1';
import {
  authorizeSend,
  FREE_MAX_FILE_SIZE,
  setIdleTimerDisabled,
  type MembershipStatus,
} from '../native/QRBeamNative';
import { getSendRestriction, type SendRestriction } from '../membership/policy';
import {
  chooseFile,
  FileSelectionCancelled,
  type PreparedFile,
} from '../transfer/fileSource';
import {
  SenderPlayback,
  type SenderPlaybackSnapshot,
} from '../transfer/SenderPlayback';
import { colors, radii, spacing } from '../ui/theme';
import { t, userFacingError } from '../i18n';

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function monotonicNow(): number {
  const clock = (globalThis as unknown as { performance?: { now(): number } })
    .performance;
  return clock?.now() ?? Date.now();
}

export function SendScreen({
  incomingFile,
  onPlayingChange,
  membership,
  onMembershipChanged,
  onUpgrade,
}: {
  incomingFile?: PreparedFile;
  onPlayingChange: (playing: boolean) => void;
  membership?: MembershipStatus;
  onMembershipChanged: (status: MembershipStatus) => void;
  onUpgrade: () => void;
}): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const [file, setFile] = useState<PreparedFile>();
  const [profile, setProfile] = useState<ProfileName>('safe');
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [session, setSession] = useState<QRB1SenderSession>();
  const playback = useRef<SenderPlayback | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextDeadline = useRef(0);
  const [snapshot, setSnapshot] = useState<SenderPlaybackSnapshot>();
  const [qrError, setQrError] = useState<string>();

  useEffect(() => {
    if (incomingFile != null) {
      setFile(incomingFile);
      setSession(undefined);
      setSnapshot(undefined);
    }
  }, [incomingFile]);

  const stopTimer = useCallback(() => {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const pause = useCallback(() => {
    stopTimer();
    if (playback.current != null)
      setSnapshot(playback.current.pause(monotonicNow()));
    setIdleTimerDisabled(false);
  }, [stopTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  useEffect(
    () => () => {
      stopTimer();
      setIdleTimerDisabled(false);
    },
    [stopTimer],
  );

  const scheduleTicks = useCallback((sender: QRB1SenderSession) => {
    const interval = 1000 / sender.profile.fps;
    const tick = () => {
      if (playback.current == null) return;
      const now = monotonicNow();
      const next = playback.current.advance(now);
      setSnapshot(next);
      if (!next.isPlaying) {
        timer.current = undefined;
        return;
      }
      nextDeadline.current += interval;
      timer.current = setTimeout(
        tick,
        Math.max(0, nextDeadline.current - monotonicNow()),
      );
    };
    nextDeadline.current = monotonicNow() + interval;
    timer.current = setTimeout(tick, interval);
  }, []);

  const showMembershipLimit = useCallback(
    (reason: SendRestriction) => {
      if (reason === 'file_too_large') {
        Alert.alert(t('send.fileTooLargeTitle'), t('send.fileTooLargeMessage'));
        return;
      }
      Alert.alert(
        reason === 'free_file_too_large'
          ? t('membership.freeSizeTitle')
          : t('membership.dailyUsedTitle'),
        reason === 'free_file_too_large'
          ? t('send.freeSizeMessage')
          : t('send.freeDailyMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.viewPro'), onPress: onUpgrade },
        ],
      );
    },
    [onUpgrade],
  );

  const selectFile = useCallback(async () => {
    setLoading(true);
    try {
      const selected = await chooseFile();
      setFile(selected);
      setSession(undefined);
      setSnapshot(undefined);
      const restriction = getSendRestriction(membership, selected.fileSize);
      if (restriction === 'free_file_too_large') {
        showMembershipLimit(restriction);
      }
    } catch (error) {
      if (!(error instanceof FileSelectionCancelled))
        Alert.alert(t('send.readFailed'), userFacingError(error));
    } finally {
      setLoading(false);
    }
  }, [membership, showMembershipLimit]);

  const start = useCallback(async () => {
    if (file == null) return;
    setAuthorizing(true);
    try {
      const sender = new QRB1SenderSession(file, profile);
      const authorization = await authorizeSend(file.fileSize);
      if (authorization.membership != null) {
        onMembershipChanged(authorization.membership);
      }
      if (!authorization.allowed) {
        showMembershipLimit(authorization.reason as SendRestriction);
        return;
      }
      const controller = new SenderPlayback(sender);
      playback.current = controller;
      setSession(sender);
      setSnapshot(controller.start(monotonicNow()));
      setQrError(undefined);
      setIdleTimerDisabled(true);
      scheduleTicks(sender);
      console.info(
        `[QRBeam] send session=${sender.sessionId} bytes=${file.fileSize} profile=${profile}`,
      );
    } catch (error) {
      Alert.alert(t('send.startFailed'), userFacingError(error));
    } finally {
      setAuthorizing(false);
    }
  }, [file, onMembershipChanged, profile, scheduleTicks, showMembershipLimit]);

  const resume = useCallback(() => {
    if (session == null || playback.current == null) return;
    setSnapshot(playback.current.start(monotonicNow()));
    setIdleTimerDisabled(true);
    scheduleTicks(session);
  }, [scheduleTicks, session]);

  const restart = useCallback(() => {
    if (session == null || playback.current == null) return;
    stopTimer();
    setSnapshot(playback.current.restart(monotonicNow()));
    setIdleTimerDisabled(true);
    scheduleTicks(session);
  }, [scheduleTicks, session, stopTimer]);

  const exitPlayback = useCallback(() => {
    stopTimer();
    setIdleTimerDisabled(false);
    playback.current = undefined;
    setSession(undefined);
    setSnapshot(undefined);
    setQrError(undefined);
  }, [stopTimer]);

  const isPlayingScreen = session != null && snapshot != null;
  useEffect(
    () => onPlayingChange(isPlayingScreen),
    [isPlayingScreen, onPlayingChange],
  );
  const restriction = file == null
    ? undefined
    : getSendRestriction(membership, file.fileSize);

  if (session != null && snapshot != null) {
    const qrSize = Math.min(width - 32, height * 0.55, 430);
    return (
      <SafeAreaView style={styles.playbackPage}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.playbackHeader}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('send.exitA11y')}
            onPress={exitPlayback}
          >
            <Text style={styles.darkAction}>{t('send.exit')}</Text>
          </TouchableOpacity>
          <View style={styles.playbackIdentity}>
            <Text numberOfLines={1} style={styles.playbackName}>
              {session.manifest.fileName}
            </Text>
            <Text style={styles.playbackMeta}>
              {formatBytes(session.manifest.fileSize)} ·{' '}
              {session.profile.name.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('send.restartA11y')}
            onPress={restart}
          >
            <Text style={styles.darkAction}>{t('send.replay')}</Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.playbackStatus,
            !snapshot.isPlaying && styles.playbackStatusPaused,
          ]}
        >
          <View
            style={[
              styles.playbackStatusDot,
              !snapshot.isPlaying && styles.playbackStatusDotPaused,
            ]}
          />
          <Text style={styles.playbackStatusText}>
            {snapshot.isPlaying ? t('send.sending') : t('send.paused')}
          </Text>
        </View>
        <View style={styles.qrSurface}>
          <QRCode
            value={snapshot.frame}
            size={qrSize}
            quietZone={10}
            ecl={session.profile.errorCorrection}
            backgroundColor="white"
            color="black"
            onError={(error: unknown) => setQrError(String(error))}
          />
        </View>
        <View style={styles.playbackStats}>
          <View>
            <Text style={styles.darkValue}>
              {snapshot.framePosition + 1}/{snapshot.cycleLength}
            </Text>
            <Text style={styles.darkLabel}>{t('send.currentFrame')}</Text>
          </View>
          <View>
            <Text style={styles.darkValue}>{snapshot.loopCount}</Text>
            <Text style={styles.darkLabel}>{t('send.loops')}</Text>
          </View>
          <View>
            <Text style={styles.darkValue}>
              {snapshot.actualFps.toFixed(1)}
            </Text>
            <Text style={styles.darkLabel}>{t('send.actualFps')}</Text>
          </View>
        </View>
        {qrError != null && <Text style={styles.playbackError}>{qrError}</Text>}
        <Text style={styles.brightnessHint}>{t('send.brightnessHint')}</Text>
        <AppButton
          label={snapshot.isPlaying ? t('send.pause') : t('send.resume')}
          secondary={!snapshot.isPlaying}
          onPress={snapshot.isPlaying ? pause : resume}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{t('send.eyebrow')}</Text>
          <Text style={styles.title}>{t('send.title')}</Text>
          <Text style={styles.subtitle}>{t('send.subtitle')}</Text>
        </View>
        <View style={styles.card}>
          {file == null ? (
            <View style={styles.emptyState}>
              <View style={styles.fileIcon}>
                <View style={styles.fileIconLine} />
              </View>
              <Text style={styles.cardTitle}>{t('send.selectFile')}</Text>
              <Text style={styles.cardBody}>
                {membership?.isPro
                  ? t('send.proSummary')
                  : t('send.freeSummary')}
              </Text>
              <View style={styles.fullWidth}>
                <AppButton
                  label={t('send.pickFile')}
                  onPress={selectFile}
                  loading={loading}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.fileHeader}>
                <View style={styles.fileBadge}>
                  <Text style={styles.fileBadgeText}>FILE</Text>
                </View>
                <View style={styles.fileIdentity}>
                  <Text numberOfLines={1} style={styles.selectedName}>
                    {file.fileName}
                  </Text>
                  <Text numberOfLines={1} style={styles.selectedMeta}>
                    {formatBytes(file.fileSize)} · {file.mime}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.hash}>
                SHA-256 {file.sha256}
              </Text>
              {restriction != null && restriction !== 'file_too_large' && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={onUpgrade}
                  style={styles.limitNotice}
                >
                  <View style={styles.limitNoticeText}>
                    <Text style={styles.limitTitle}>
                      {restriction === 'free_file_too_large'
                        ? t('send.overFreeLimit', {
                            size: formatBytes(FREE_MAX_FILE_SIZE),
                          })
                        : t('send.dailyQuotaUsed')}
                    </Text>
                    <Text style={styles.limitCaption}>
                      {t('send.unlockPro')}
                    </Text>
                  </View>
                  <Text style={styles.limitAction}>{t('common.viewPro')}</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.sectionLabel}>{t('send.mode')}</Text>
              <View style={styles.profileRow}>
                {(['safe', 'fast'] as ProfileName[]).map(name => {
                  const selected = profile === name;
                  const config = TRANSFER_PROFILES[name];
                  return (
                    <TouchableOpacity
                      key={name}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('send.profileA11y', {
                        name:
                          name === 'safe'
                            ? t('send.reliable')
                            : t('send.fast'),
                      })}
                      onPress={() => setProfile(name)}
                      style={[
                        styles.profile,
                        selected && styles.profileSelected,
                      ]}
                    >
                      <View style={styles.profileTitleRow}>
                        <Text
                          style={[
                            styles.profileName,
                            selected && styles.profileNameSelected,
                          ]}
                        >
                          {name === 'safe'
                            ? t('send.reliable')
                            : t('send.fast')}
                        </Text>
                        <View
                          style={[
                            styles.radio,
                            selected && styles.radioSelected,
                          ]}
                        >
                          {selected && <View style={styles.radioCore} />}
                        </View>
                      </View>
                      <Text style={styles.profileDetail}>
                        {config.chunkSize} B · {config.fps} FPS · EC{' '}
                        {config.errorCorrection}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.actions}>
                <AppButton
                  label={t('send.start')}
                  onPress={start}
                  loading={authorizing}
                />
                <AppButton
                  label={t('send.chooseAnother')}
                  secondary
                  onPress={selectFile}
                  loading={loading}
                />
              </View>
            </>
          )}
        </View>
        <Text style={styles.notice}>{t('send.offlineNotice')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.large, paddingBottom: 28 },
  intro: { paddingTop: 28, paddingBottom: 22 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 7,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 22 },
  fileIcon: {
    width: 48,
    height: 58,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  fileIconLine: {
    height: 2,
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  fullWidth: { width: '100%' },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileBadge: {
    width: 46,
    height: 46,
    borderRadius: radii.small,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fileIdentity: { flex: 1 },
  selectedName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  selectedMeta: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  hash: {
    color: colors.textSubtle,
    fontFamily: 'Menlo',
    fontSize: 10,
    marginTop: 14,
  },
  limitNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.small,
    padding: 12,
    marginTop: 14,
    gap: 10,
  },
  limitNoticeText: { flex: 1 },
  limitTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  limitCaption: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  limitAction: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 26,
    marginBottom: 10,
  },
  profileRow: { flexDirection: 'row', gap: 10 },
  profile: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    padding: 14,
  },
  profileSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  profileNameSelected: { color: colors.accent },
  profileDetail: {
    color: colors.textSubtle,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 7,
  },
  radio: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  actions: { gap: 10, marginTop: 22 },
  notice: {
    color: colors.textSubtle,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },
  playbackPage: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  playbackHeader: {
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playbackIdentity: { flex: 1, alignItems: 'center' },
  playbackName: {
    color: '#111318',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 210,
  },
  playbackMeta: {
    color: '#707680',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  darkAction: { color: '#16784A', fontSize: 15, fontWeight: '700', padding: 8 },
  playbackStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F8EF',
    borderRadius: radii.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  playbackStatusPaused: { backgroundColor: '#F0F1F3' },
  playbackStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#218A55',
  },
  playbackStatusDotPaused: { backgroundColor: '#7B828C' },
  playbackStatusText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  qrSurface: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playbackStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#E2E5E9',
    paddingTop: 12,
  },
  darkValue: {
    color: '#111318',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
  darkLabel: {
    color: '#777D86',
    textAlign: 'center',
    fontSize: 10,
    marginTop: 3,
  },
  brightnessHint: {
    color: '#616771',
    textAlign: 'center',
    fontSize: 12,
    marginVertical: 10,
  },
  playbackError: { color: '#B42318', fontSize: 12, textAlign: 'center' },
});

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  isScannedCode,
  type ScannedObject,
  type ScannedObjectType,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
} from 'react-native-vision-camera';
import { AppButton } from '../components/AppButton';
import { colors, radii, spacing } from '../ui/theme';
import { DEBUG_FIXTURE_FRAMES } from '../protocol/debugFixture';
import { parseFrame } from '../protocol/qrb1';
import {
  authorizeSend,
  type MembershipStatus,
  type SendAuthorization,
} from '../native/QRBeamNative';
import {
  TransferAssembler,
  type TransferSnapshot,
} from '../transfer/TransferAssembler';
import { saveReceivedFile, shareLocalFile } from '../transfer/fileStorage';
import { t, userFacingError } from '../i18n';

const QR_TYPES: ScannedObjectType[] = ['qr'];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function PermissionScreen({
  requestPermission,
  canRequest,
}: {
  requestPermission: () => void;
  canRequest: boolean;
}) {
  return (
    <SafeAreaView style={styles.permissionPage}>
      <StatusBar barStyle="light-content" />
      <View style={styles.permissionIcon}>
        <View style={styles.permissionIconCore} />
      </View>
      <Text style={styles.title}>{t('receive.permissionTitle')}</Text>
      <Text style={styles.body}>{t('receive.permissionBody')}</Text>
      <AppButton
        label={
          canRequest ? t('receive.allowCamera') : t('receive.openSettings')
        }
        onPress={
          canRequest
            ? requestPermission
            : () => {
                Linking.openSettings().catch(() => undefined);
              }
        }
      />
    </SafeAreaView>
  );
}

export function ReceiveScreen({
  isActive,
  onMembershipChanged,
  onUpgrade,
}: {
  isActive: boolean;
  onMembershipChanged: (status: MembershipStatus) => void;
  onUpgrade: () => void;
}): React.JSX.Element {
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const assembler = useRef(new TransferAssembler());
  const saving = useRef(false);
  const authorizedSessionId = useRef<string | undefined>(undefined);
  const authorizingSessionId = useRef<string | undefined>(undefined);
  const blockedSessionId = useRef<string | undefined>(undefined);
  const authorizationEpoch = useRef(0);
  const [snapshot, setSnapshot] = useState<TransferSnapshot>(() =>
    assembler.current.snapshot(),
  );
  const [savedPath, setSavedPath] = useState<string>();
  const [cameraError, setCameraError] = useState<string>();
  const [membershipError, setMembershipError] = useState<string>();

  const showMembershipLimit = useCallback(
    (authorization: SendAuthorization) => {
      const sizeLimited = authorization.reason === 'free_file_too_large';
      const message = sizeLimited
        ? t('receive.freeSizeMessage')
        : t('receive.freeDailyMessage');
      setMembershipError(message);
      Alert.alert(
        sizeLimited
          ? t('membership.freeSizeTitle')
          : t('membership.dailyUsedTitle'),
        message,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.viewPro'), onPress: onUpgrade },
        ],
      );
    },
    [onUpgrade],
  );

  const authorizeManifest = useCallback(
    (raw: string, sessionId: string, fileSize: number) => {
      authorizingSessionId.current = sessionId;
      const epoch = authorizationEpoch.current;
      authorizeSend(fileSize)
        .then(authorization => {
          if (
            epoch !== authorizationEpoch.current ||
            authorizingSessionId.current !== sessionId
          )
            return;
          authorizingSessionId.current = undefined;
          if (authorization.membership != null) {
            onMembershipChanged(authorization.membership);
          }
          if (!authorization.allowed) {
            blockedSessionId.current = sessionId;
            showMembershipLimit(authorization);
            return;
          }
          authorizedSessionId.current = sessionId;
          setMembershipError(undefined);
          setSnapshot(assembler.current.accept(raw));
        })
        .catch(error => {
          if (epoch !== authorizationEpoch.current) return;
          authorizingSessionId.current = undefined;
          setMembershipError(t('membership.checkFailed'));
          Alert.alert(t('receive.startFailed'), userFacingError(error));
        });
    },
    [onMembershipChanged, showMembershipLimit],
  );

  const processObjects = useCallback(
    (objects: ScannedObject[]) => {
      let changed = false;
      for (const object of objects) {
        if (!isScannedCode(object) || object.value == null) continue;
        let frame;
        try {
          frame = parseFrame(object.value);
        } catch {
          assembler.current.accept(object.value);
          changed = true;
          continue;
        }
        if (frame.kind === 'manifest') {
          if (authorizedSessionId.current === frame.sessionId) {
            assembler.current.accept(object.value);
            changed = true;
          } else if (
            authorizingSessionId.current !== frame.sessionId &&
            blockedSessionId.current !== frame.sessionId
          ) {
            authorizeManifest(
              object.value,
              frame.sessionId,
              frame.manifest.fileSize,
            );
          }
          continue;
        }
        if (authorizedSessionId.current === frame.sessionId) {
          assembler.current.accept(object.value);
          changed = true;
        }
      }
      if (changed) setSnapshot(assembler.current.snapshot());
    },
    [authorizeManifest],
  );

  const objectOutput = useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: processObjects,
  });
  const outputs = useMemo(() => [objectOutput], [objectOutput]);

  useEffect(() => {
    if (
      snapshot.phase !== 'complete' ||
      snapshot.completedBytes == null ||
      snapshot.manifest == null ||
      saving.current ||
      savedPath != null
    )
      return;
    saving.current = true;
    saveReceivedFile(snapshot.completedBytes, snapshot.manifest.fileName)
      .then(path => {
        setSavedPath(path);
        return shareLocalFile(path, snapshot.manifest?.fileName);
      })
      .catch(error =>
        Alert.alert(t('receive.saveFailed'), userFacingError(error)),
      )
      .finally(() => {
        saving.current = false;
      });
  }, [savedPath, snapshot]);

  const reset = useCallback(() => {
    authorizationEpoch.current += 1;
    authorizedSessionId.current = undefined;
    authorizingSessionId.current = undefined;
    blockedSessionId.current = undefined;
    assembler.current.reset();
    saving.current = false;
    setSavedPath(undefined);
    setCameraError(undefined);
    setMembershipError(undefined);
    setSnapshot(assembler.current.snapshot());
  }, []);

  const runDebugFixture = useCallback(() => {
    assembler.current.reset();
    for (const frame of DEBUG_FIXTURE_FRAMES) assembler.current.accept(frame);
    setSnapshot(assembler.current.snapshot());
  }, []);

  if (!permission.hasPermission) {
    return (
      <PermissionScreen
        canRequest={permission.canRequestPermission}
        requestPermission={() => {
          permission.requestPermission().catch(() => undefined);
        }}
      />
    );
  }

  const total = snapshot.manifest?.totalChunks ?? 0;
  const percentage =
    total === 0 ? 0 : Math.min(100, (snapshot.receivedChunks / total) * 100);
  const isComplete = snapshot.phase === 'complete';

  if (device == null) {
    return (
      <SafeAreaView style={styles.permissionPage}>
        {__DEV__ ? (
          <>
            <Text style={styles.brand}>{t('receive.simulatorMode')}</Text>
            <Text style={styles.title}>
              {isComplete
                ? t('receive.debugReceived')
                : t('receive.noBackCamera')}
            </Text>
            <Text style={styles.body}>
              {isComplete
                ? t('receive.debugComplete')
                : t('receive.debugHint')}
            </Text>
            {savedPath != null ? (
              <>
                <AppButton
                  label={t('receive.shareTestFile')}
                  onPress={() => {
                    shareLocalFile(
                      savedPath,
                      snapshot.manifest?.fileName,
                    ).catch(() => undefined);
                  }}
                />
                <AppButton
                  label={t('receive.resetTest')}
                  secondary
                  onPress={reset}
                />
              </>
            ) : (
              <AppButton
                label={
                  isComplete ? t('receive.saving') : t('receive.runTest')
                }
                onPress={runDebugFixture}
              />
            )}
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.body}>{t('receive.waitingCamera')}</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        outputs={outputs}
        isActive={isActive && !isComplete}
        constraints={[{ fps: 30 }]}
        enableNativeTapToFocusGesture
        onError={error => setCameraError(error.message)}
      />
      <View style={styles.scrim} pointerEvents="none" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{t('receive.brand')}</Text>
            <Text style={styles.headerTitle}>
              {isComplete
                ? t('receive.fileReceived')
                : t('receive.scanAnimatedQr')}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel={t('receive.resetTransfer')}
            accessibilityRole="button"
            onPress={reset}
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>{t('common.reset')}</Text>
          </TouchableOpacity>
        </View>
        {!isComplete && (
          <View style={styles.scanFrame}>
            <View style={styles.scanLine} />
          </View>
        )}
        <View style={styles.panel}>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, isComplete && styles.statusDotComplete]}
            />
            <Text style={styles.statusText}>
              {isComplete
                ? t('receive.complete')
                : snapshot.manifest
                ? t('receive.receiving')
                : t('receive.waiting')}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.fileName}>
            {snapshot.manifest?.fileName ?? t('receive.noFile')}
          </Text>
          <Text style={styles.fileMeta}>
            {snapshot.manifest
              ? t('receive.fileMeta', {
                  size: formatBytes(snapshot.manifest.fileSize),
                  received: snapshot.receivedChunks,
                  total,
                })
              : t('receive.scanHint')}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
          <View style={styles.metrics}>
            <View>
              <Text style={styles.metricValue}>{percentage.toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>{t('receive.receivedMetric')}</Text>
            </View>
            <View>
              <Text style={styles.metricValue}>
                {snapshot.effectiveFps.toFixed(1)}
              </Text>
              <Text style={styles.metricLabel}>{t('receive.effectiveFps')}</Text>
            </View>
            <View>
              <Text style={styles.metricValue}>{snapshot.invalidFrames}</Text>
              <Text style={styles.metricLabel}>{t('receive.invalidFrames')}</Text>
            </View>
          </View>
          {(cameraError || membershipError || snapshot.error) && (
            <Text style={styles.error}>
              {cameraError ?? membershipError ?? snapshot.error}
            </Text>
          )}
          {savedPath != null && (
            <View style={styles.completeActions}>
              <AppButton
                label={t('receive.shareFile')}
                onPress={() => {
                  shareLocalFile(savedPath, snapshot.manifest?.fileName).catch(
                    () => undefined,
                  );
                }}
              />
              <AppButton
                label={t('receive.receiveAnother')}
                secondary
                onPress={reset}
              />
            </View>
          )}
          <Text style={styles.notice}>{t('receive.offlineNotice')}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: { flex: 1, justifyContent: 'space-between' },
  scrim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(4,6,10,0.2)',
  },
  header: {
    paddingHorizontal: spacing.large,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  resetButton: {
    backgroundColor: 'rgba(15,18,23,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radii.round,
  },
  resetText: { color: colors.text, fontWeight: '600' },
  scanFrame: {
    alignSelf: 'center',
    width: '72%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.large,
    overflow: 'hidden',
  },
  scanLine: {
    height: 2,
    backgroundColor: colors.accent,
    marginTop: '50%',
    opacity: 0.72,
  },
  panel: {
    backgroundColor: 'rgba(12,15,19,0.96)',
    margin: 12,
    padding: 18,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textSubtle,
  },
  statusDotComplete: { backgroundColor: colors.accent },
  statusText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  fileName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  fileMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.round,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.round,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
  },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  metricLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  error: { color: colors.danger, marginTop: 14, fontSize: 13, lineHeight: 18 },
  completeActions: { gap: 10, marginTop: 18 },
  notice: {
    color: colors.textSubtle,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 16,
  },
  permissionPage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 18,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.large,
    backgroundColor: colors.accentSurface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIconCore: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 360,
  },
});

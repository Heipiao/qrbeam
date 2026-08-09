import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {AppButton} from '../components/AppButton';
import {
  QRB1SenderSession,
  TRANSFER_PROFILES,
  type ProfileName,
} from '../protocol/qrb1';
import {setIdleTimerDisabled} from '../native/QRBeamNative';
import {chooseFile, FileSelectionCancelled, type PreparedFile} from '../transfer/fileSource';
import {SenderPlayback, type SenderPlaybackSnapshot} from '../transfer/SenderPlayback';

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function monotonicNow(): number {
  const clock = (globalThis as unknown as {performance?: {now(): number}}).performance;
  return clock?.now() ?? Date.now();
}

export function SendScreen({
  incomingFile,
  onPlayingChange,
}: {
  incomingFile?: PreparedFile;
  onPlayingChange: (playing: boolean) => void;
}): React.JSX.Element {
  const {width, height} = useWindowDimensions();
  const [file, setFile] = useState<PreparedFile>();
  const [profile, setProfile] = useState<ProfileName>('safe');
  const [loading, setLoading] = useState(false);
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
    if (playback.current != null) setSnapshot(playback.current.pause(monotonicNow()));
    setIdleTimerDisabled(false);
  }, [stopTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);

  useEffect(() => () => {
    stopTimer();
    setIdleTimerDisabled(false);
  }, [stopTimer]);

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
      timer.current = setTimeout(tick, Math.max(0, nextDeadline.current - monotonicNow()));
    };
    nextDeadline.current = monotonicNow() + interval;
    timer.current = setTimeout(tick, interval);
  }, []);

  const selectFile = useCallback(async () => {
    setLoading(true);
    try {
      const selected = await chooseFile();
      setFile(selected);
      setSession(undefined);
      setSnapshot(undefined);
    } catch (error) {
      if (!(error instanceof FileSelectionCancelled)) Alert.alert('无法读取文件', String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const start = useCallback(() => {
    if (file == null) return;
    try {
      const sender = new QRB1SenderSession(file, profile);
      const controller = new SenderPlayback(sender);
      playback.current = controller;
      setSession(sender);
      setSnapshot(controller.start(monotonicNow()));
      setQrError(undefined);
      setIdleTimerDisabled(true);
      scheduleTicks(sender);
      console.info(`[QRBeam] send session=${sender.sessionId} bytes=${file.fileSize} profile=${profile}`);
    } catch (error) {
      Alert.alert('无法开始发送', String(error));
    }
  }, [file, profile, scheduleTicks]);

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
  useEffect(() => onPlayingChange(isPlayingScreen), [isPlayingScreen, onPlayingChange]);

  if (session != null && snapshot != null) {
    const qrSize = Math.min(width - 32, height * 0.55, 430);
    return (
      <SafeAreaView style={styles.playbackPage}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.playbackHeader}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="退出发送" onPress={exitPlayback}><Text style={styles.darkAction}>退出</Text></TouchableOpacity>
          <View><Text numberOfLines={1} style={styles.playbackName}>{session.manifest.fileName}</Text><Text style={styles.playbackMeta}>{formatBytes(session.manifest.fileSize)} · {session.profile.name.toUpperCase()}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="重新开始" onPress={restart}><Text style={styles.darkAction}>重播</Text></TouchableOpacity>
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
          <View><Text style={styles.darkValue}>{snapshot.framePosition + 1}/{snapshot.cycleLength}</Text><Text style={styles.darkLabel}>当前帧</Text></View>
          <View><Text style={styles.darkValue}>{snapshot.loopCount}</Text><Text style={styles.darkLabel}>循环</Text></View>
          <View><Text style={styles.darkValue}>{snapshot.actualFps.toFixed(1)}</Text><Text style={styles.darkLabel}>实际 FPS</Text></View>
        </View>
        {qrError != null && <Text style={styles.playbackError}>{qrError}</Text>}
        <Text style={styles.brightnessHint}>将屏幕亮度调高，并让接收手机保持稳定</Text>
        <AppButton label={snapshot.isPlaying ? '暂停' : '继续'} secondary={!snapshot.isPlaying} onPress={snapshot.isPlaying ? pause : resume} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>手机传手机</Text>
        <Text style={styles.title}>把文件变成动态二维码</Text>
        <Text style={styles.subtitle}>另一部手机打开“电脑传手机”扫描即可。全程无需网络。</Text>
      </View>
      <View style={styles.card}>
        {file == null ? (
          <View style={styles.emptyState}>
            <Text style={styles.fileIcon}>⇧</Text>
            <Text style={styles.cardTitle}>选择一个文件</Text>
            <Text style={styles.cardBody}>支持任意类型，最大 5 MiB。也可以从其他 App 分享到 QRBeam。</Text>
            <AppButton label="从“文件”选择" onPress={selectFile} disabled={loading} />
            {loading && <ActivityIndicator color="#67E8A5" />}
          </View>
        ) : (
          <>
            <Text numberOfLines={1} style={styles.selectedName}>{file.fileName}</Text>
            <Text style={styles.selectedMeta}>{formatBytes(file.fileSize)} · {file.mime}</Text>
            <Text numberOfLines={1} style={styles.hash}>SHA-256  {file.sha256}</Text>
            <Text style={styles.sectionLabel}>传输档位</Text>
            <View style={styles.profileRow}>
              {(['safe', 'fast'] as ProfileName[]).map(name => {
                const selected = profile === name;
                const config = TRANSFER_PROFILES[name];
                return (
                  <TouchableOpacity key={name} accessibilityRole="button" accessibilityLabel={`${name} profile`} onPress={() => setProfile(name)} style={[styles.profile, selected && styles.profileSelected]}>
                    <Text style={[styles.profileName, selected && styles.profileNameSelected]}>{name.toUpperCase()}</Text>
                    <Text style={styles.profileDetail}>{config.chunkSize} B · {config.fps} FPS · EC {config.errorCorrection}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.actions}>
              <AppButton label="开始发送" onPress={start} />
              <AppButton label="选择其他文件" secondary onPress={selectFile} />
            </View>
          </>
        )}
      </View>
      <Text style={styles.notice}>QRBeam 不上传文件 · 请遵守所在组织的数据安全规定</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#090B10', paddingHorizontal: 20},
  intro: {paddingTop: 28, paddingBottom: 22},
  eyebrow: {color: '#67E8A5', fontSize: 12, fontWeight: '800', letterSpacing: 2.2},
  title: {color: 'white', fontSize: 28, fontWeight: '800', marginTop: 8},
  subtitle: {color: '#9CA5B3', fontSize: 15, lineHeight: 22, marginTop: 9},
  card: {backgroundColor: '#12161D', borderRadius: 24, borderWidth: 1, borderColor: '#252B35', padding: 20},
  emptyState: {alignItems: 'center', gap: 14, paddingVertical: 20},
  fileIcon: {color: '#67E8A5', fontSize: 44, fontWeight: '300'},
  cardTitle: {color: 'white', fontSize: 20, fontWeight: '700'},
  cardBody: {color: '#929CAA', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 4},
  selectedName: {color: 'white', fontSize: 20, fontWeight: '700'},
  selectedMeta: {color: '#9CA5B3', fontSize: 13, marginTop: 6},
  hash: {color: '#65707E', fontFamily: 'Menlo', fontSize: 10, marginTop: 10},
  sectionLabel: {color: '#8B95A3', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 24, marginBottom: 10},
  profileRow: {flexDirection: 'row', gap: 10},
  profile: {flex: 1, backgroundColor: '#1A1F27', borderWidth: 1, borderColor: '#2A313C', borderRadius: 16, padding: 14},
  profileSelected: {borderColor: '#67E8A5', backgroundColor: '#14231C'},
  profileName: {color: '#A4ADBA', fontWeight: '800', fontSize: 14},
  profileNameSelected: {color: '#67E8A5'},
  profileDetail: {color: '#798391', fontSize: 10, lineHeight: 15, marginTop: 5},
  actions: {gap: 10, marginTop: 22},
  notice: {color: '#626C79', fontSize: 11, textAlign: 'center', marginTop: 18},
  playbackPage: {flex: 1, backgroundColor: 'white', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12},
  playbackHeader: {width: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  playbackName: {color: '#111318', fontSize: 14, fontWeight: '700', textAlign: 'center', maxWidth: 210},
  playbackMeta: {color: '#707680', fontSize: 10, textAlign: 'center', marginTop: 2},
  darkAction: {color: '#16784A', fontSize: 15, fontWeight: '700', padding: 8},
  qrSurface: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  playbackStats: {width: '100%', flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderColor: '#E2E5E9', paddingTop: 12},
  darkValue: {color: '#111318', textAlign: 'center', fontWeight: '800', fontSize: 16},
  darkLabel: {color: '#777D86', textAlign: 'center', fontSize: 10, marginTop: 3},
  brightnessHint: {color: '#616771', textAlign: 'center', fontSize: 12, marginVertical: 10},
  playbackError: {color: '#B42318', fontSize: 12, textAlign: 'center'},
});

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {AppButton} from '../components/AppButton';
import {DEBUG_FIXTURE_FRAMES} from '../protocol/debugFixture';
import {TransferAssembler, type TransferSnapshot} from '../transfer/TransferAssembler';
import {saveReceivedFile, shareLocalFile} from '../transfer/fileStorage';

const QR_TYPES: ScannedObjectType[] = ['qr'];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024 / 1024).toFixed(value >= 1024 * 1024 ? 2 : 3)} MB`;
}

function PermissionScreen({requestPermission, canRequest}: {requestPermission: () => void; canRequest: boolean}) {
  return (
    <SafeAreaView style={styles.permissionPage}>
      <StatusBar barStyle="light-content" />
      <View style={styles.permissionIcon}><Text style={styles.permissionIconText}>▦</Text></View>
      <Text style={styles.title}>接收离线文件</Text>
      <Text style={styles.body}>相机只用于扫描电脑或另一部手机显示的 QRBeam，不会上传文件。</Text>
      <AppButton
        label={canRequest ? '允许相机访问' : '打开设置'}
        onPress={canRequest ? requestPermission : () => { Linking.openSettings().catch(() => undefined); }}
      />
    </SafeAreaView>
  );
}

export function ReceiveScreen({isActive}: {isActive: boolean}): React.JSX.Element {
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const assembler = useRef(new TransferAssembler());
  const saving = useRef(false);
  const [snapshot, setSnapshot] = useState<TransferSnapshot>(() => assembler.current.snapshot());
  const [savedPath, setSavedPath] = useState<string>();
  const [cameraError, setCameraError] = useState<string>();

  const processObjects = useCallback((objects: ScannedObject[]) => {
    let changed = false;
    for (const object of objects) {
      if (isScannedCode(object) && object.value != null) {
        assembler.current.accept(object.value);
        changed = true;
      }
    }
    if (changed) setSnapshot(assembler.current.snapshot());
  }, []);

  const objectOutput = useObjectOutput({types: QR_TYPES, onObjectsScanned: processObjects});
  const outputs = useMemo(() => [objectOutput], [objectOutput]);

  useEffect(() => {
    if (
      snapshot.phase !== 'complete' || snapshot.completedBytes == null || snapshot.manifest == null ||
      saving.current || savedPath != null
    ) return;
    saving.current = true;
    saveReceivedFile(snapshot.completedBytes, snapshot.manifest.fileName)
      .then(path => {
        setSavedPath(path);
        return shareLocalFile(path, snapshot.manifest?.fileName);
      })
      .catch(error => Alert.alert('无法保存文件', String(error)))
      .finally(() => { saving.current = false; });
  }, [savedPath, snapshot]);

  const reset = useCallback(() => {
    assembler.current.reset();
    saving.current = false;
    setSavedPath(undefined);
    setCameraError(undefined);
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
        requestPermission={() => { permission.requestPermission().catch(() => undefined); }}
      />
    );
  }

  const total = snapshot.manifest?.totalChunks ?? 0;
  const percentage = total === 0 ? 0 : Math.min(100, snapshot.receivedChunks / total * 100);
  const isComplete = snapshot.phase === 'complete';

  if (device == null) {
    return (
      <SafeAreaView style={styles.permissionPage}>
        {__DEV__ ? (
          <>
            <Text style={styles.brand}>SIMULATOR MODE</Text>
            <Text style={styles.title}>{isComplete ? '测试文件已接收' : '模拟器没有后置相机'}</Text>
            <Text style={styles.body}>{isComplete ? '共享 QRB1 测试向量已恢复并校验。' : '运行固定向量以测试恢复、保存与分享。'}</Text>
            {savedPath != null ? (
              <>
                <AppButton label="分享测试文件" onPress={() => { shareLocalFile(savedPath, snapshot.manifest?.fileName).catch(() => undefined); }} />
                <AppButton label="重置测试" secondary onPress={reset} />
              </>
            ) : (
              <AppButton label={isComplete ? '正在保存…' : '运行协议测试向量'} onPress={runDebugFixture} />
            )}
          </>
        ) : (
          <><ActivityIndicator color="#67E8A5" /><Text style={styles.body}>正在等待后置相机…</Text></>
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
        constraints={[{fps: 30}]}
        enableNativeTapToFocusGesture
        onError={error => setCameraError(error.message)}
      />
      <View style={styles.scrim} pointerEvents="none" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <View><Text style={styles.brand}>电脑传手机</Text><Text style={styles.headerTitle}>{isComplete ? '文件已接收' : '扫描动态二维码'}</Text></View>
          <TouchableOpacity accessibilityLabel="重置传输" accessibilityRole="button" onPress={reset} style={styles.resetButton}>
            <Text style={styles.resetText}>重置</Text>
          </TouchableOpacity>
        </View>
        {!isComplete && <View style={styles.scanFrame}><View style={styles.scanLine} /></View>}
        <View style={styles.panel}>
          <Text numberOfLines={1} style={styles.fileName}>{snapshot.manifest?.fileName ?? '等待 Manifest…'}</Text>
          <Text style={styles.fileMeta}>
            {snapshot.manifest ? `${formatBytes(snapshot.manifest.fileSize)} · ${snapshot.receivedChunks}/${total} 分块` : '可扫描电脑 CLI 或另一部手机显示的 QRBeam。'}
          </Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, {width: `${percentage}%`}]} /></View>
          <View style={styles.metrics}>
            <View><Text style={styles.metricValue}>{percentage.toFixed(1)}%</Text><Text style={styles.metricLabel}>已接收</Text></View>
            <View><Text style={styles.metricValue}>{snapshot.effectiveFps.toFixed(1)}</Text><Text style={styles.metricLabel}>有效 FPS</Text></View>
            <View><Text style={styles.metricValue}>{snapshot.invalidFrames}</Text><Text style={styles.metricLabel}>错误帧</Text></View>
          </View>
          {(cameraError || snapshot.error) && <Text style={styles.error}>{cameraError ?? snapshot.error}</Text>}
          {savedPath != null && (
            <View style={styles.completeActions}>
              <AppButton label="分享文件" onPress={() => { shareLocalFile(savedPath, snapshot.manifest?.fileName).catch(() => undefined); }} />
              <AppButton label="继续接收" secondary onPress={reset} />
            </View>
          )}
          <Text style={styles.notice}>全程离线 · 请确认你有权传输此文件</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#080A0E'},
  overlay: {flex: 1, justifyContent: 'space-between'},
  scrim: {position: 'absolute', inset: 0, backgroundColor: 'rgba(4,6,10,0.2)'},
  header: {paddingHorizontal: 22, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  brand: {color: '#67E8A5', fontSize: 12, fontWeight: '800', letterSpacing: 2.3},
  headerTitle: {color: 'white', fontSize: 21, fontWeight: '700', marginTop: 4},
  resetButton: {backgroundColor: 'rgba(13,17,24,0.78)', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 20},
  resetText: {color: 'white', fontWeight: '600'},
  scanFrame: {alignSelf: 'center', width: '72%', aspectRatio: 1, borderWidth: 2, borderColor: '#67E8A5', borderRadius: 24, overflow: 'hidden'},
  scanLine: {height: 2, backgroundColor: '#67E8A5', marginTop: '50%', opacity: 0.75},
  panel: {backgroundColor: 'rgba(10,13,18,0.94)', margin: 12, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: '#252B35'},
  fileName: {color: 'white', fontSize: 18, fontWeight: '700'},
  fileMeta: {color: '#9CA5B3', fontSize: 13, marginTop: 6, lineHeight: 18},
  progressTrack: {height: 7, backgroundColor: '#272D36', borderRadius: 8, marginTop: 16, overflow: 'hidden'},
  progressFill: {height: '100%', backgroundColor: '#67E8A5', borderRadius: 8},
  metrics: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 17},
  metricValue: {color: 'white', fontSize: 17, fontWeight: '700'},
  metricLabel: {color: '#7E8795', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3},
  error: {color: '#FF8C8C', marginTop: 14, fontSize: 13},
  completeActions: {gap: 10, marginTop: 18},
  notice: {color: '#697281', textAlign: 'center', fontSize: 11, marginTop: 16},
  permissionPage: {flex: 1, backgroundColor: '#090B10', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 18},
  permissionIcon: {width: 78, height: 78, borderRadius: 24, backgroundColor: '#17241E', alignItems: 'center', justifyContent: 'center'},
  permissionIconText: {color: '#67E8A5', fontSize: 42},
  title: {color: 'white', fontSize: 29, fontWeight: '700', textAlign: 'center'},
  body: {color: '#A6AFBC', fontSize: 16, textAlign: 'center', lineHeight: 23, maxWidth: 360},
});

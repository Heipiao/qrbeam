import {fromByteArray} from 'base64-js';
import {TransferAssembler} from '../src/transfer/TransferAssembler';
import {
  crc32Hex,
  encodeDataFrame,
  encodeManifestFrame,
  MANIFEST_INTERVAL,
  parseFrame,
  QRB1SenderSession,
  sanitizeFilename,
  TRANSFER_PROFILES,
  type Manifest,
} from '../src/protocol/qrb1';
import {SenderPlayback} from '../src/transfer/SenderPlayback';
import fixture from '../../protocol/test-vector.json';
import {DEBUG_FIXTURE_FRAMES} from '../src/protocol/debugFixture';

const SESSION = '0123456789abcdef';
const FIXTURE_MANIFEST = fixture.manifestFrame;
const FIXTURE_DATA = fixture.dataFrame;

function base64Url(bytes: Uint8Array): string {
  return fromByteArray(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(new RegExp('=+$'), '');
}

function utf8(value: string): Uint8Array {
  return Uint8Array.from(unescape(encodeURIComponent(value)), character => character.charCodeAt(0));
}

function manifestFrame(manifest: Manifest, sessionId = SESSION): string {
  const payload = utf8(JSON.stringify(manifest));
  return `QRB1|M|${sessionId}|${base64Url(payload)}|${crc32Hex(payload)}`;
}

describe('QRB1 protocol', () => {
  it('parses the deterministic Python fixture', () => {
    expect(DEBUG_FIXTURE_FRAMES).toEqual([fixture.manifestFrame, fixture.dataFrame]);
    const manifest = parseFrame(FIXTURE_MANIFEST);
    const data = parseFrame(FIXTURE_DATA);
    expect(manifest.kind).toBe('manifest');
    if (manifest.kind === 'manifest') {
      expect(manifest.manifest.fileName).toBe(fixture.fileName);
      expect(manifest.manifest.sha256).toBe(fixture.sha256);
    }
    expect(data.kind).toBe('data');
    if (data.kind === 'data') {
      expect(Array.from(data.payload)).toEqual(Array.from(utf8(fixture.sourceUtf8)));
    }
  });

  it('encodes deterministic frames byte-identically with Python', () => {
    const manifest = parseFrame(FIXTURE_MANIFEST);
    expect(manifest.kind).toBe('manifest');
    if (manifest.kind !== 'manifest') return;
    expect(encodeManifestFrame(SESSION, manifest.manifest)).toBe(FIXTURE_MANIFEST);
    expect(encodeDataFrame(SESSION, 0, 1, utf8(fixture.sourceUtf8))).toBe(FIXTURE_DATA);
  });

  it('rejects corrupt frames and sanitizes filenames', () => {
    expect(() => parseFrame(`${FIXTURE_DATA.slice(0, -1)}0`)).toThrow('crc32 mismatch');
    expect(sanitizeFilename('../a:b?.zip')).toBe('a_b_.zip');
    expect(sanitizeFilename('...')).toBe('received-file');
  });
});

describe('QRB1SenderSession', () => {
  it('uses the public profiles and inserts manifests every twenty chunks', () => {
    expect(TRANSFER_PROFILES.safe).toEqual({name: 'safe', chunkSize: 480, fps: 6, errorCorrection: 'M'});
    expect(TRANSFER_PROFILES.fast).toEqual({name: 'fast', chunkSize: 900, fps: 10, errorCorrection: 'L'});
    const bytes = new Uint8Array(TRANSFER_PROFILES.safe.chunkSize * (MANIFEST_INTERVAL + 1));
    const sender = new QRB1SenderSession(
      {bytes, fileName: '测试.zip', mime: 'application/zip'},
      'safe',
      SESSION,
    );
    expect(sender.manifest.totalChunks).toBe(21);
    expect(parseFrame(sender.frameAt(0)).kind).toBe('manifest');
    expect(parseFrame(sender.frameAt(20)).kind).toBe('data');
    expect(parseFrame(sender.frameAt(21)).kind).toBe('manifest');
    expect(parseFrame(sender.frameAt(22)).kind).toBe('data');
    expect(sender.frameAt(sender.cycleLength)).toBe(sender.frameAt(0));
  });

  it('round-trips out of order data and handles empty files', () => {
    const source = Uint8Array.from({length: 1200}, (_, index) => index % 251);
    const sender = new QRB1SenderSession(
      {bytes: source, fileName: '../report.bin', mime: 'application/octet-stream'},
      'safe',
      SESSION,
    );
    const assembler = new TransferAssembler();
    assembler.accept(sender.frameAt(0));
    const dataFrames = Array.from({length: sender.cycleLength - 1}, (_, index) => sender.frameAt(index + 1))
      .filter(frame => parseFrame(frame).kind === 'data')
      .reverse();
    for (const frame of dataFrames) assembler.accept(frame);
    expect(assembler.snapshot().completedBytes).toEqual(source);

    const empty = new QRB1SenderSession(
      {bytes: new Uint8Array(), fileName: 'empty', mime: ''},
      'fast',
      SESSION,
    );
    expect(empty.cycleLength).toBe(1);
    expect(new TransferAssembler().accept(empty.frameAt(0)).phase).toBe('complete');
  });

  it('rejects files larger than five MiB', () => {
    expect(() => new QRB1SenderSession(
      {bytes: new Uint8Array(5 * 1024 * 1024 + 1), fileName: 'large.bin', mime: ''},
      'safe',
      SESSION,
    )).toThrow('file exceeds');
  });
});

describe('SenderPlayback', () => {
  it('pauses, advances, loops, and restarts deterministically', () => {
    const sender = new QRB1SenderSession(
      {bytes: utf8('hello'), fileName: 'hello.txt', mime: 'text/plain'},
      'safe',
      SESSION,
    );
    const playback = new SenderPlayback(sender);
    expect(playback.start(1000).isPlaying).toBe(true);
    expect(playback.advance(1100).framePosition).toBe(1);
    expect(playback.advance(1200).loopCount).toBe(1);
    expect(playback.pause(1300).isPlaying).toBe(false);
    expect(playback.advance(1400).framePosition).toBe(0);
    playback.start(2300);
    expect(playback.advance(2400).actualFps).toBeGreaterThan(0);
    expect(playback.restart(3000).loopCount).toBe(0);
  });
});

describe('TransferAssembler', () => {
  it('ignores data before a manifest, deduplicates, and completes byte-identically', () => {
    const assembler = new TransferAssembler();
    expect(assembler.accept(FIXTURE_DATA, 0).ignoredFrames).toBe(1);
    expect(assembler.accept(FIXTURE_MANIFEST, 1000).phase).toBe('receiving');
    expect(assembler.accept(FIXTURE_MANIFEST, 1100).receivedChunks).toBe(0);
    const complete = assembler.accept(FIXTURE_DATA, 1200);
    expect(complete.phase).toBe('complete');
    expect(Array.from(complete.completedBytes ?? [])).toEqual(Array.from(utf8(fixture.sourceUtf8)));
  });

  it('rejects a completed payload whose SHA-256 does not match', () => {
    const manifest: Manifest = {
      protocol: 'QRB1',
      fileName: 'fixture.txt',
      mime: 'text/plain',
      fileSize: 13,
      chunkSize: 480,
      totalChunks: 1,
      sha256: '0'.repeat(64),
    };
    const assembler = new TransferAssembler();
    assembler.accept(manifestFrame(manifest), 1000);
    expect(assembler.accept(FIXTURE_DATA, 1100).phase).toBe('failed');
    expect(assembler.snapshot().error).toBe('SHA-256 verification failed');
  });

  it('completes an empty file from its manifest', () => {
    const empty: Manifest = {
      protocol: 'QRB1',
      fileName: 'empty.bin',
      mime: 'application/octet-stream',
      fileSize: 0,
      chunkSize: 480,
      totalChunks: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };
    const assembler = new TransferAssembler();
    const snapshot = assembler.accept(manifestFrame(empty));
    expect(snapshot.phase).toBe('complete');
    expect(snapshot.completedBytes).toEqual(new Uint8Array());
  });
});

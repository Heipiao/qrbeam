import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {Manifest} from '../protocol/qrb1';
import {parseFrame} from '../protocol/qrb1';

export type TransferPhase = 'waiting' | 'receiving' | 'complete' | 'failed';

export interface TransferSnapshot {
  phase: TransferPhase;
  sessionId?: string;
  manifest?: Manifest;
  receivedChunks: number;
  duplicates: number;
  invalidFrames: number;
  ignoredFrames: number;
  effectiveFps: number;
  error?: string;
  completedBytes?: Uint8Array;
}

export class TransferAssembler {
  private sessionId?: string;
  private manifest?: Manifest;
  private chunks = new Map<number, Uint8Array>();
  private duplicates = 0;
  private invalidFrames = 0;
  private ignoredFrames = 0;
  private startedAt?: number;
  private phase: TransferPhase = 'waiting';
  private error?: string;
  private completedBytes?: Uint8Array;

  accept(raw: string, now = Date.now()): TransferSnapshot {
    if (this.phase === 'complete' || this.phase === 'failed') {
      this.ignoredFrames += 1;
      return this.snapshot(now);
    }

    let frame;
    try {
      frame = parseFrame(raw);
    } catch {
      this.invalidFrames += 1;
      return this.snapshot(now);
    }

    if (frame.kind === 'manifest') {
      if (this.sessionId != null && frame.sessionId !== this.sessionId) {
        this.ignoredFrames += 1;
        return this.snapshot(now);
      }
      if (this.manifest == null) {
        this.sessionId = frame.sessionId;
        this.manifest = frame.manifest;
        this.startedAt = now;
        this.phase = 'receiving';
        if (frame.manifest.totalChunks === 0) {
          this.finish(new Uint8Array());
        }
      }
      return this.snapshot(now);
    }

    if (this.manifest == null || this.sessionId == null) {
      this.ignoredFrames += 1;
      return this.snapshot(now);
    }
    if (frame.sessionId !== this.sessionId) {
      this.ignoredFrames += 1;
      return this.snapshot(now);
    }
    if (frame.total !== this.manifest.totalChunks) {
      this.invalidFrames += 1;
      return this.snapshot(now);
    }
    const isLast = frame.index === frame.total - 1;
    const expectedLastSize =
      this.manifest.fileSize - this.manifest.chunkSize * (frame.total - 1);
    const expectedSize = isLast ? expectedLastSize : this.manifest.chunkSize;
    if (frame.payload.length !== expectedSize) {
      this.invalidFrames += 1;
      return this.snapshot(now);
    }
    if (this.chunks.has(frame.index)) {
      this.duplicates += 1;
      return this.snapshot(now);
    }

    this.chunks.set(frame.index, frame.payload);
    if (this.chunks.size === this.manifest.totalChunks) {
      const output = new Uint8Array(this.manifest.fileSize);
      let offset = 0;
      for (let index = 0; index < this.manifest.totalChunks; index += 1) {
        const chunk = this.chunks.get(index);
        if (chunk == null) {
          this.fail('A required chunk is missing');
          return this.snapshot(now);
        }
        output.set(chunk, offset);
        offset += chunk.length;
      }
      this.finish(output);
    }
    return this.snapshot(now);
  }

  reset(): TransferSnapshot {
    this.sessionId = undefined;
    this.manifest = undefined;
    this.chunks.clear();
    this.duplicates = 0;
    this.invalidFrames = 0;
    this.ignoredFrames = 0;
    this.startedAt = undefined;
    this.phase = 'waiting';
    this.error = undefined;
    this.completedBytes = undefined;
    return this.snapshot();
  }

  snapshot(now = Date.now()): TransferSnapshot {
    const elapsed = this.startedAt == null ? 0 : Math.max((now - this.startedAt) / 1000, 0.001);
    return {
      phase: this.phase,
      sessionId: this.sessionId,
      manifest: this.manifest,
      receivedChunks: this.chunks.size,
      duplicates: this.duplicates,
      invalidFrames: this.invalidFrames,
      ignoredFrames: this.ignoredFrames,
      effectiveFps: elapsed === 0 ? 0 : this.chunks.size / elapsed,
      error: this.error,
      completedBytes: this.completedBytes,
    };
  }

  private finish(output: Uint8Array): void {
    if (this.manifest == null) {
      this.fail('Manifest is missing');
      return;
    }
    if (bytesToHex(sha256(output)) !== this.manifest.sha256) {
      this.fail('SHA-256 verification failed');
      return;
    }
    this.completedBytes = output;
    this.phase = 'complete';
  }

  private fail(message: string): void {
    this.error = message;
    this.phase = 'failed';
  }
}

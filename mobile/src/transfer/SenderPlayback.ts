import type {QRB1SenderSession} from '../protocol/qrb1';

export interface SenderPlaybackSnapshot {
  frame: string;
  framePosition: number;
  cycleLength: number;
  loopCount: number;
  actualFps: number;
  isPlaying: boolean;
}

export class SenderPlayback {
  private position = 0;
  private loopCount = 0;
  private playing = false;
  private activeStartedAt?: number;
  private activeElapsedMs = 0;
  private framesShown = 0;

  constructor(readonly session: QRB1SenderSession) {}

  start(now: number): SenderPlaybackSnapshot {
    if (!this.playing) {
      this.playing = true;
      this.activeStartedAt = now;
      if (this.framesShown === 0) this.framesShown = 1;
    }
    return this.snapshot(now);
  }

  pause(now: number): SenderPlaybackSnapshot {
    if (this.playing && this.activeStartedAt != null) {
      this.activeElapsedMs += Math.max(0, now - this.activeStartedAt);
    }
    this.playing = false;
    this.activeStartedAt = undefined;
    return this.snapshot(now);
  }

  restart(now: number): SenderPlaybackSnapshot {
    this.position = 0;
    this.loopCount = 0;
    this.activeStartedAt = now;
    this.activeElapsedMs = 0;
    this.framesShown = 1;
    this.playing = true;
    return this.snapshot(now);
  }

  advance(now: number): SenderPlaybackSnapshot {
    if (!this.playing) return this.snapshot(now);
    this.position += 1;
    this.framesShown += 1;
    if (this.position >= this.session.cycleLength) {
      this.position = 0;
      this.loopCount += 1;
    }
    return this.snapshot(now);
  }

  snapshot(now: number): SenderPlaybackSnapshot {
    const currentActiveMs = this.playing && this.activeStartedAt != null
      ? Math.max(0, now - this.activeStartedAt)
      : 0;
    const elapsed = this.framesShown === 0
      ? 0
      : Math.max((this.activeElapsedMs + currentActiveMs) / 1000, 0.001);
    return {
      frame: this.session.frameAt(this.position),
      framePosition: this.position,
      cycleLength: this.session.cycleLength,
      loopCount: this.loopCount,
      actualFps: elapsed === 0 ? 0 : this.framesShown / elapsed,
      isPlaying: this.playing,
    };
  }
}

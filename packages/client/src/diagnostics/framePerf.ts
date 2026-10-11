import Phaser from "phaser";
import type { Room } from "colyseus.js";

/**
 * Opt-in frame profiler. Off by default and costs one boolean check per
 * section when off.
 *
 * Enable: add `?perf` to the URL, or run `__deadtilesPerf(true)` in devtools
 * (persists in localStorage, `__deadtilesPerf(false)` turns it off).
 *
 * Every 2s it logs one `[perf]` summary line. Any frame slower than
 * LONG_FRAME_MS also logs its own `[perf] long frame` breakdown.
 */

const STORAGE_KEY = "deadtilesPerf";
const REPORT_INTERVAL_MS = 2000;
const LONG_FRAME_MS = 50;
const LONG_FRAME_LOG_GAP_MS = 400;

const PROTOCOL_NAMES: Record<number, string> = {
  13: "data",
  14: "state",
  15: "patch",
  16: "dataSchema",
  17: "dataBytes",
};

type Bucket = { ms: number; count: number; max: number };

function readEnabled(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has("perf")) return true;
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function addTo(map: Map<string, Bucket>, key: string, ms: number) {
  const b = map.get(key);
  if (b) {
    b.ms += ms;
    b.count += 1;
    if (ms > b.max) b.max = ms;
  } else {
    map.set(key, { ms, count: 1, max: ms });
  }
}

function topEntries(map: Map<string, Bucket>, n: number): string {
  return [...map.entries()]
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, n)
    .map(([k, b]) => `${k}=${b.ms.toFixed(0)}ms/${b.count} (max ${b.max.toFixed(1)})`)
    .join(", ");
}

class FramePerf {
  on = readEnabled();

  private scene: Phaser.Scene | null = null;
  private lapAt = 0;
  private inFrame = false;
  private frameStart = 0;
  private lastStepAt = 0;
  private renderStart = 0;
  private reportAt = 0;
  private lastLongLogAt = 0;

  private frame = new Map<string, number>();
  private frameNetMs = 0;
  private frameNetTop = "";
  private frameNetTopMs = 0;

  private sections = new Map<string, Bucket>();
  private net = new Map<string, Bucket>();
  private ops = new Map<string, Bucket>();
  private frameOp = "";
  private frameOpMs = 0;
  private frames = 0;
  private worstGap = 0;
  private gapSum = 0;
  private updateSum = 0;
  private renderSum = 0;
  private netSum = 0;
  private longFrames = 0;
  private longTaskMs = 0;
  private longTaskCount = 0;

  private observer: PerformanceObserver | null = null;
  private wiredRooms = new WeakSet<object>();

  attachScene(scene: Phaser.Scene) {
    this.detachScene();
    this.scene = scene;
    const events = scene.game.events;
    events.on(Phaser.Core.Events.PRE_STEP, this.onPreStep, this);
    events.on(Phaser.Core.Events.PRE_RENDER, this.onPreRender, this);
    events.on(Phaser.Core.Events.POST_RENDER, this.onPostRender, this);
    (window as unknown as Record<string, unknown>).__deadtilesPerf = (
      enable?: boolean,
    ) => {
      const next = enable ?? !this.on;
      this.on = next;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* private mode */
      }
      this.reset();
      this.syncObserver();
      console.log(`[perf] ${next ? "enabled" : "disabled"}`);
      return next;
    };
    this.syncObserver();
    if (this.on) console.log("[perf] frame profiler enabled");
  }

  detachScene() {
    const scene = this.scene;
    if (!scene) return;
    const events = scene.game?.events;
    events?.off(Phaser.Core.Events.PRE_STEP, this.onPreStep, this);
    events?.off(Phaser.Core.Events.PRE_RENDER, this.onPreRender, this);
    events?.off(Phaser.Core.Events.POST_RENDER, this.onPostRender, this);
    this.observer?.disconnect();
    this.observer = null;
    this.scene = null;
  }

  /** Time every websocket message and every room.onMessage handler. */
  attachRoom(room: Room) {
    if (this.wiredRooms.has(room)) return;
    this.wiredRooms.add(room);
    const anyRoom = room as unknown as {
      connection?: { transport?: { ws?: WebSocket } };
      dispatchMessage?: (type: unknown, message: unknown) => void;
    };
    const ws = anyRoom.connection?.transport?.ws;
    if (ws && typeof ws.onmessage === "function") {
      const original = ws.onmessage;
      ws.onmessage = (event: MessageEvent) => {
        if (!this.on) return original.call(ws, event);
        const t0 = performance.now();
        try {
          return original.call(ws, event);
        } finally {
          const ms = performance.now() - t0;
          let code = -1;
          if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
            code = new Uint8Array(event.data)[0];
          }
          const name = PROTOCOL_NAMES[code] ?? `code${code}`;
          // "data" is broken down per message type by dispatchMessage below.
          if (name !== "data" && name !== "dataBytes") {
            addTo(this.net, name, ms);
            this.noteFrameNet(name, ms);
          }
        }
      };
    }
    const dispatch = anyRoom.dispatchMessage;
    if (typeof dispatch === "function") {
      anyRoom.dispatchMessage = (type: unknown, message: unknown) => {
        if (!this.on) return dispatch.call(room, type, message);
        const t0 = performance.now();
        try {
          return dispatch.call(room, type, message);
        } finally {
          const ms = performance.now() - t0;
          const name = `msg:${String(type)}`;
          addTo(this.net, name, ms);
          this.noteFrameNet(name, ms);
        }
      };
    }
  }

  /** Call at the top of update(). */
  begin() {
    this.frame.clear();
    this.frameOp = "";
    this.frameOpMs = 0;
    this.lapAt = performance.now();
    this.frameStart = this.lapAt;
    this.inFrame = true;
  }

  /** Charge the time since the previous lap to `name`. */
  lap(name: string) {
    if (!this.inFrame) return;
    const now = performance.now();
    const ms = now - this.lapAt;
    this.lapAt = now;
    this.frame.set(name, (this.frame.get(name) ?? 0) + ms);
    addTo(this.sections, name, ms);
  }

  /** Record one indivisible operation (a single tile, a single bake). */
  op(name: string, ms: number) {
    if (ms < 2) return;
    addTo(this.ops, name, ms);
    if (ms > this.frameOpMs) {
      this.frameOpMs = ms;
      this.frameOp = name;
    }
  }

  /** Call at the end of update(). */
  end() {
    if (!this.inFrame) return;
    this.inFrame = false;
    this.updateSum += performance.now() - this.frameStart;
  }

  private noteFrameNet(name: string, ms: number) {
    this.frameNetMs += ms;
    this.netSum += ms;
    if (ms > this.frameNetTopMs) {
      this.frameNetTopMs = ms;
      this.frameNetTop = name;
    }
  }

  private reset() {
    this.sections.clear();
    this.net.clear();
    this.ops.clear();
    this.frames = 0;
    this.worstGap = 0;
    this.gapSum = 0;
    this.updateSum = 0;
    this.renderSum = 0;
    this.netSum = 0;
    this.longFrames = 0;
    this.longTaskMs = 0;
    this.longTaskCount = 0;
    this.reportAt = performance.now() + REPORT_INTERVAL_MS;
    this.lastStepAt = 0;
  }

  private syncObserver() {
    this.observer?.disconnect();
    this.observer = null;
    if (!this.on || typeof PerformanceObserver === "undefined") return;
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskMs += entry.duration;
          this.longTaskCount += 1;
        }
      });
      this.observer.observe({ type: "longtask", buffered: false });
    } catch {
      this.observer = null;
    }
  }

  private onPreStep() {
    if (!this.on) return;
    const now = performance.now();
    if (this.lastStepAt > 0) {
      const gap = now - this.lastStepAt;
      this.frames += 1;
      this.gapSum += gap;
      if (gap > this.worstGap) this.worstGap = gap;
      if (gap > LONG_FRAME_MS) {
        this.longFrames += 1;
        this.logLongFrame(gap, now);
      }
    }
    this.lastStepAt = now;
    this.frameNetMs = 0;
    this.frameNetTop = "";
    this.frameNetTopMs = 0;
    if (this.reportAt === 0) this.reportAt = now + REPORT_INTERVAL_MS;
    if (now >= this.reportAt) this.report(now);
  }

  private lastRenderMs = 0;

  private onPreRender() {
    if (!this.on) return;
    this.renderStart = performance.now();
  }

  private onPostRender() {
    if (!this.on || this.renderStart === 0) return;
    this.lastRenderMs = performance.now() - this.renderStart;
    this.renderSum += this.lastRenderMs;
    addTo(this.sections, "render", this.lastRenderMs);
    this.renderStart = 0;
  }

  private logLongFrame(gap: number, now: number) {
    if (now - this.lastLongLogAt < LONG_FRAME_LOG_GAP_MS) return;
    this.lastLongLogAt = now;
    const parts = [...this.frame.entries()]
      .filter(([, ms]) => ms >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, ms]) => `${k}=${ms.toFixed(1)}`)
      .join(" ");
    const updateMs = [...this.frame.values()].reduce((a, b) => a + b, 0);
    console.log(
      `[perf] long frame ${gap.toFixed(0)}ms | update=${updateMs.toFixed(1)} ` +
        `render=${this.lastRenderMs.toFixed(1)} net=${this.frameNetMs.toFixed(1)}` +
        (this.frameNetTop ? ` (worst ${this.frameNetTop} ${this.frameNetTopMs.toFixed(1)})` : "") +
        ` | ${parts}` +
        (this.frameOp ? ` | slowest op ${this.frameOp}=${this.frameOpMs.toFixed(1)}` : ""),
    );
  }

  private report(now: number) {
    const scene = this.scene;
    const frames = Math.max(1, this.frames);
    const seconds = REPORT_INTERVAL_MS / 1000;
    let counts = "";
    if (scene?.sys?.isActive()) {
      const tweens = (scene.tweens as unknown as { getTweens?: () => unknown[] })
        .getTweens?.().length ?? -1;
      counts =
        ` | objects=${scene.children.list.length} tweens=${tweens}` +
        ` sounds=${scene.sound.getAllPlaying().length}` +
        ` zoom=${scene.cameras.main.zoom.toFixed(2)}`;
    }
    console.log(
      `[perf] fps=${(this.frames / seconds).toFixed(0)} ` +
        `avgFrame=${(this.gapSum / frames).toFixed(1)} worst=${this.worstGap.toFixed(0)} ` +
        `long=${this.longFrames} | update=${(this.updateSum / frames).toFixed(1)} ` +
        `render=${(this.renderSum / frames).toFixed(1)} net=${(this.netSum / frames).toFixed(1)} ` +
        `longTasks=${this.longTaskCount}/${this.longTaskMs.toFixed(0)}ms` +
        counts,
    );
    if (this.sections.size > 0) {
      console.log(`[perf]   sections: ${topEntries(this.sections, 8)}`);
    }
    if (this.net.size > 0) {
      console.log(`[perf]   network: ${topEntries(this.net, 8)}`);
    }
    if (this.ops.size > 0) {
      console.log(`[perf]   slow ops (>2ms each): ${topEntries(this.ops, 8)}`);
    }
    this.reset();
    this.reportAt = now + REPORT_INTERVAL_MS;
  }
}

export const framePerf = new FramePerf();

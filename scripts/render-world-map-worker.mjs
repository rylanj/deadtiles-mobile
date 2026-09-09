/**
 * Worker thread entry for render-world-map.mjs
 * Own module graph → own worldgen caches (safe to run in parallel).
 */
import { parentPort } from "worker_threads";
import { sampleStrip } from "./lib/world-map-sample.mjs";

if (!parentPort) {
  throw new Error("render-world-map-worker must run as a worker thread");
}

parentPort.on("message", (msg) => {
  if (!msg || msg.type !== "strip") return;

  const result = sampleStrip({
    minX: msg.minX,
    maxX: msg.maxX,
    minY: msg.minY,
    maxY: msg.maxY,
    fast: msg.fast,
    chunk: msg.chunk,
    onProgress: (p) => {
      parentPort.postMessage({
        type: "progress",
        stripId: msg.stripId,
        ...p,
      });
    },
  });

  parentPort.postMessage(
    {
      type: "done",
      stripId: msg.stripId,
      minX: result.minX,
      maxX: result.maxX,
      minY: result.minY,
      maxY: result.maxY,
      sampled: result.sampled,
      settlements: result.settlements,
      kinds: result.kinds,
    },
    [result.kinds.buffer],
  );
});

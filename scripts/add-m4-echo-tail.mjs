/**
 * Add a short outdoor echo tail to M4 gunshot WAVs (M41–M43).
 * Dry crack stays as-is. Delayed, darker copies pad past the original cut.
 * Tail is kept short so 10/s full-auto does not turn into mush.
 */
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../packages/client/public/assets/audio/M4",
);

const FILES = ["M41.wav", "M42.wav", "M43.wav"];
const PAD_MS = 520;
const FADE_MS = 180;
/** Early slaps of the full shot (stay inside the body). */
const BODY_TAPS = [
  { ms: 58, gain: 0.18 },
  { ms: 118, gain: 0.1 },
  { ms: 210, gain: 0.06 },
];
/**
 * Darker copies of the muzzle (first 180ms). Long delays so the crack
 * still rings after the original 0.6s cut, without a second dry bang.
 */
const TAIL_TAPS = [
  { ms: 280, gain: 0.1, lpHz: 2800 },
  { ms: 430, gain: 0.12, lpHz: 2000 },
  { ms: 580, gain: 0.14, lpHz: 1500 },
  { ms: 740, gain: 0.09, lpHz: 1100 },
  { ms: 900, gain: 0.05, lpHz: 800 },
];
const CRACK_MS = 180;
const COMB_MS = 71;
const COMB_FEEDBACK = 0.62;
const COMB_WET = 0.2;
const COMB_LP_HZ = 1800;
const HAAS_MS = 6;
const MAX_24 = 8388607;

function findChunk(buf, id, start) {
  let i = start;
  while (i + 8 <= buf.length) {
    const name = buf.toString("ascii", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    if (name === id) return { offset: i + 8, size };
    i += 8 + size + (size % 2);
  }
  return null;
}

function readS24(buf, i) {
  const v = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16);
  return v & 0x800000 ? v - 0x1000000 : v;
}

function writeS24(buf, i, v) {
  let n = Math.max(-MAX_24 - 1, Math.min(MAX_24, Math.round(v)));
  if (n < 0) n += 0x1000000;
  buf[i] = n & 0xff;
  buf[i + 1] = (n >> 8) & 0xff;
  buf[i + 2] = (n >> 16) & 0xff;
}

function writeWav24(channels, sampleRate, interleaved) {
  const frames = interleaved.length / channels;
  const dataSize = frames * channels * 3;
  const out = Buffer.alloc(44 + dataSize);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * channels * 3, 28);
  out.writeUInt16LE(channels * 3, 32);
  out.writeUInt16LE(24, 34);
  out.write("data", 36);
  out.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < interleaved.length; i++) {
    writeS24(out, 44 + i * 3, interleaved[i]);
  }
  return out;
}

function process(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a WAVE file");
  }
  const fmt = findChunk(buf, "fmt ", 12);
  const data = findChunk(buf, "data", 12);
  if (!fmt || !data) throw new Error("missing fmt/data");
  const audioFormat = buf.readUInt16LE(fmt.offset);
  const channels = buf.readUInt16LE(fmt.offset + 2);
  const sampleRate = buf.readUInt32LE(fmt.offset + 4);
  const bits = buf.readUInt16LE(fmt.offset + 14);
  if (audioFormat !== 1 || bits !== 24) {
    throw new Error(`expected 24-bit PCM, got format=${audioFormat} bits=${bits}`);
  }

  const srcFrame = channels * 3;
  const srcFrames = Math.floor(data.size / srcFrame);
  const dry = Array.from({ length: channels }, () => new Float64Array(srcFrames));
  for (let f = 0; f < srcFrames; f++) {
    for (let c = 0; c < channels; c++) {
      dry[c][f] = readS24(buf, data.offset + f * srcFrame + c * 3);
    }
  }

  const pad = Math.round((PAD_MS / 1000) * sampleRate);
  const outFrames = srcFrames + pad;
  const wet = Array.from({ length: channels }, () => new Float64Array(outFrames));
  const haas = Math.round((HAAS_MS / 1000) * sampleRate);
  const crackFrames = Math.min(srcFrames, Math.round((CRACK_MS / 1000) * sampleRate));

  function lpAlphaHz(hz) {
    return 1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
  }

  for (let c = 0; c < channels; c++) {
    const extra = c === 1 ? haas : 0;
    for (const tap of BODY_TAPS) {
      const delay = Math.round((tap.ms / 1000) * sampleRate) + extra;
      for (let f = 0; f < srcFrames; f++) {
        const t = f + delay;
        if (t < outFrames) wet[c][t] += dry[c][f] * tap.gain;
      }
    }
    for (const tap of TAIL_TAPS) {
      const delay = Math.round((tap.ms / 1000) * sampleRate) + extra;
      const a = lpAlphaHz(tap.lpHz);
      let lp = 0;
      for (let f = 0; f < crackFrames; f++) {
        lp += a * (dry[c][f] - lp);
        const t = f + delay;
        if (t < outFrames) wet[c][t] += lp * tap.gain;
      }
    }
  }

  const combLen = Math.max(1, Math.round((COMB_MS / 1000) * sampleRate));
  const lpAlpha = lpAlphaHz(COMB_LP_HZ);
  for (let c = 0; c < channels; c++) {
    const comb = new Float64Array(combLen);
    let wi = 0;
    let lp = 0;
    const extra = c === 1 ? haas : 0;
    for (let f = 0; f < outFrames; f++) {
      const delayed = comb[wi];
      lp += lpAlpha * (delayed - lp);
      const send = f < srcFrames ? dry[c][f] : 0;
      comb[wi] = send + lp * COMB_FEEDBACK;
      const t = f + extra;
      if (t < outFrames) wet[c][t] += delayed * COMB_WET;
      wi = (wi + 1) % combLen;
    }
  }

  const mixed = new Float64Array(outFrames * channels);
  let dryPeak = 1;
  let mixedPeak = 1;
  for (let f = 0; f < srcFrames; f++) {
    for (let c = 0; c < channels; c++) {
      dryPeak = Math.max(dryPeak, Math.abs(dry[c][f]));
    }
  }
  for (let f = 0; f < outFrames; f++) {
    for (let c = 0; c < channels; c++) {
      const d = f < srcFrames ? dry[c][f] : 0;
      mixedPeak = Math.max(mixedPeak, Math.abs(d + wet[c][f]));
    }
  }
  const wetScale =
    mixedPeak > MAX_24 ? Math.max(0, (MAX_24 - dryPeak) / (mixedPeak - dryPeak + 1e-9)) : 1;

  const fadeStart = outFrames - Math.round((FADE_MS / 1000) * sampleRate);
  for (let f = 0; f < outFrames; f++) {
    const fade = f < fadeStart ? 1 : Math.max(0, 1 - (f - fadeStart) / (outFrames - fadeStart));
    for (let c = 0; c < channels; c++) {
      const d = f < srcFrames ? dry[c][f] : 0;
      mixed[f * channels + c] = (d + wet[c][f] * wetScale) * fade;
    }
  }

  return {
    out: writeWav24(channels, sampleRate, mixed),
    srcMs: (srcFrames / sampleRate) * 1000,
    outMs: (outFrames / sampleRate) * 1000,
    wetScale,
  };
}

for (const name of FILES) {
  const file = path.join(dir, name);
  const bak = `${file}.bak`;
  try {
    await access(bak);
  } catch {
    await copyFile(file, bak);
  }
  const src = await readFile(bak);
  const { out, srcMs, outMs, wetScale } = process(src);
  await writeFile(file, out);
  console.log(
    `${name}  ${srcMs.toFixed(0)}ms -> ${outMs.toFixed(0)}ms  wetScale=${wetScale.toFixed(3)}  ${src.length} -> ${out.length}`,
  );
}

/**
 * Convert 24-bit / 96 kHz WAVs to 16-bit / 48 kHz PCM.
 * Browsers reject 24-bit WAV (Phaser: "Unable to decode audio data").
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const audioRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../packages/client/public/assets/audio",
);

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

function clamp16(v) {
  return Math.max(-32768, Math.min(32767, v | 0));
}

function convert(buf) {
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
  if (audioFormat !== 1) throw new Error(`unsupported format ${audioFormat}`);
  if (bits === 16 && sampleRate <= 48000) return null;

  if (bits !== 24) throw new Error(`unsupported bit depth ${bits}`);

  const srcFrame = channels * 3;
  const srcFrames = Math.floor(data.size / srcFrame);
  const decimate = sampleRate === 96000 ? 2 : 1;
  const outRate = sampleRate / decimate;
  const outFrames = Math.floor(srcFrames / decimate);
  const pcm = Buffer.alloc(outFrames * channels * 2);

  for (let f = 0; f < outFrames; f++) {
    for (let c = 0; c < channels; c++) {
      let acc = 0;
      for (let d = 0; d < decimate; d++) {
        acc += readS24(buf, data.offset + (f * decimate + d) * srcFrame + c * 3);
      }
      const s16 = clamp16(Math.round(acc / decimate / 256));
      pcm.writeInt16LE(s16, (f * channels + c) * 2);
    }
  }

  const dataSize = pcm.length;
  const out = Buffer.alloc(44 + dataSize);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(outRate, 24);
  out.writeUInt32LE(outRate * channels * 2, 28);
  out.writeUInt16LE(channels * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(dataSize, 40);
  pcm.copy(out, 44);
  return out;
}

const files = [];
for (const dirent of await readdir(audioRoot, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(audioRoot, dirent.name);
  for (const name of await readdir(dir)) {
    if (name.toLowerCase().endsWith(".wav")) files.push(path.join(dir, name));
  }
}

let converted = 0;
for (const file of files) {
  const src = await readFile(file);
  const out = convert(src);
  const rel = path.relative(audioRoot, file);
  if (!out) {
    console.log(`skip (already browser-safe) ${rel}`);
    continue;
  }
  await writeFile(file, out);
  converted += 1;
  console.log(`converted ${rel}  ${src.length} -> ${out.length}`);
}
console.log(`done: ${converted}/${files.length} converted`);

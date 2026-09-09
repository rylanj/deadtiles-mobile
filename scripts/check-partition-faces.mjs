// Sanity check for drawInteriorPartitionTile face clipping.
// For every neighbour configuration, every drawn face must be a real outward
// surface of the merged arm solid: solid just behind it, empty just in front.

const HALF_T = 0.16 / 2;
const EPS = 1e-6;
const D = 1e-4; // probe offset

function tileGeometry(hasW, hasE, hasN, hasS) {
  const ox = 0;
  const oy = 0;
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  const runEW = hasW || hasE || (!hasN && !hasS);
  const runNS = hasN || hasS;
  const isCorner = runEW && runNS;

  const ewX0 = isCorner && !hasW ? cx - HALF_T : ox;
  const ewX1 = isCorner && !hasE ? cx + HALF_T : ox + 1;
  const ewY0 = cy - HALF_T;
  const ewY1 = cy + HALF_T;
  const nsX0 = cx - HALF_T;
  const nsX1 = cx + HALF_T;
  const nsY0 = isCorner && !hasN ? cy - HALF_T : oy;
  const nsY1 = isCorner && !hasS ? cy + HALF_T : oy + 1;

  const south = [];
  const east = [];
  const addSouth = (y, x0, x1) => {
    if (x1 - x0 > EPS) south.push({ y, x0, x1 });
  };
  const addEast = (x, y0, y1) => {
    if (y1 - y0 > EPS) east.push({ x, y0, y1 });
  };

  if (runEW) {
    if (runNS && nsY1 > ewY1 + EPS) {
      addSouth(ewY1, ewX0, Math.min(ewX1, nsX0));
      addSouth(ewY1, Math.max(ewX0, nsX1), ewX1);
    } else {
      addSouth(ewY1, ewX0, ewX1);
    }
    addEast(ewX1, ewY0, ewY1);
  }
  if (runNS) {
    addSouth(nsY1, nsX0, nsX1);
    if (runEW && ewX1 > nsX1 + EPS) {
      addEast(nsX1, nsY0, Math.min(nsY1, ewY0));
      addEast(nsX1, Math.max(nsY0, ewY1), nsY1);
    } else {
      addEast(nsX1, nsY0, nsY1);
    }
  }

  const boxes = [];
  if (runEW) boxes.push({ x0: ewX0, y0: ewY0, x1: ewX1, y1: ewY1 });
  if (runNS) boxes.push({ x0: nsX0, y0: nsY0, x1: nsX1, y1: nsY1 });

  return { south, east, boxes, runEW, runNS };
}

const inSolid = (boxes, x, y) =>
  boxes.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1);

let failures = 0;
for (let mask = 0; mask < 16; mask++) {
  const hasW = !!(mask & 1);
  const hasE = !!(mask & 2);
  const hasN = !!(mask & 4);
  const hasS = !!(mask & 8);
  const { south, east, boxes } = tileGeometry(hasW, hasE, hasN, hasS);
  const label = `W:${+hasW} E:${+hasE} N:${+hasN} S:${+hasS}`;

  for (const f of south) {
    for (let i = 1; i < 8; i++) {
      const x = f.x0 + ((f.x1 - f.x0) * i) / 8;
      const behind = inSolid(boxes, x, f.y - D);
      const infront = inSolid(boxes, x, f.y + D);
      // A face is legitimate when solid sits behind it and nothing in front,
      // unless it is a run edge butting the neighbouring tile (y == tile edge).
      const atTileEdge = Math.abs(f.y - 1) < EPS;
      if (!behind || (infront && !atTileEdge)) {
        console.log(
          `FAIL south ${label} y=${f.y.toFixed(3)} x=${x.toFixed(3)} behind=${behind} infront=${infront}`,
        );
        failures++;
      }
    }
  }

  for (const f of east) {
    for (let i = 1; i < 8; i++) {
      const y = f.y0 + ((f.y1 - f.y0) * i) / 8;
      const behind = inSolid(boxes, f.x - D, y);
      const infront = inSolid(boxes, f.x + D, y);
      const atTileEdge = Math.abs(f.x - 1) < EPS;
      if (!behind || (infront && !atTileEdge)) {
        console.log(
          `FAIL east ${label} x=${f.x.toFixed(3)} y=${y.toFixed(3)} behind=${behind} infront=${infront}`,
        );
        failures++;
      }
    }
  }
}

// Coverage: every outward surface of the union must be drawn by some face.
const SAMPLES = 400;
for (let mask = 0; mask < 16; mask++) {
  const hasW = !!(mask & 1);
  const hasE = !!(mask & 2);
  const hasN = !!(mask & 4);
  const hasS = !!(mask & 8);
  const { south, east, boxes } = tileGeometry(hasW, hasE, hasN, hasS);
  const label = `W:${+hasW} E:${+hasE} N:${+hasN} S:${+hasS}`;

  for (let i = 0; i <= SAMPLES; i++) {
    const p = i / SAMPLES;
    // South-facing boundaries along the ray x = p going south.
    for (const b of boxes) {
      if (p <= b.x0 || p >= b.x1) continue;
      const yFace = b.y1;
      if (inSolid(boxes, p, yFace + D)) continue; // interior, correctly hidden
      const covered = south.some(
        (f) => Math.abs(f.y - yFace) < EPS && p > f.x0 - EPS && p < f.x1 + EPS,
      );
      if (!covered) {
        console.log(`HOLE south ${label} y=${yFace.toFixed(3)} x=${p.toFixed(3)}`);
        failures++;
      }
    }
    // East-facing boundaries along the ray y = p going east.
    for (const b of boxes) {
      if (p <= b.y0 || p >= b.y1) continue;
      const xFace = b.x1;
      if (inSolid(boxes, xFace + D, p)) continue;
      const covered = east.some(
        (f) => Math.abs(f.x - xFace) < EPS && p > f.y0 - EPS && p < f.y1 + EPS,
      );
      if (!covered) {
        console.log(`HOLE east ${label} x=${xFace.toFixed(3)} y=${p.toFixed(3)}`);
        failures++;
      }
    }
  }
}

console.log(
  failures === 0
    ? "OK: all drawn faces are outward surfaces, and no outward surface is missing"
    : `${failures} failures`,
);

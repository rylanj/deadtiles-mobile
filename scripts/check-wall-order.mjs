// Painter-order check for interior/structure partition walls.
//
// Models drawInteriorPartitionTile + InteriorView.drawWalls exactly, then for a
// dense grid of screen points compares the *last painted* face against the face
// that is really nearest the camera. In this dimetric projection a world point
// (x, y, h) lands at ((x - y) * halfW, (x + y) * halfH - h), so along a view ray
// both s = x + y and h grow together: the surface with the largest s wins.
//
//   node scripts/check-wall-order.mjs            # current (geometric) order
//   node scripts/check-wall-order.mjs --legacy   # old per-arm corner-bias order

const halfW = 32; // TILE_WIDTH / 2
const halfH = 16; // TILE_HEIGHT / 2
const D = 96 * 0.65; // PARTITION_HEIGHT = WALL_DEPTH * 0.65
const HT = 0.16 / 2; // PARTITION_THICKNESS / 2
const EPS = 1e-6;
/** s-units of slack when judging "the wrong face was painted". */
const TOL = 1e-4;

const LEGACY = process.argv.includes("--legacy");

const key = (x, y) => `${x},${y}`;

function neighbours(wallSet, x, y) {
  const hasW = wallSet.has(key(x - 1, y));
  const hasE = wallSet.has(key(x + 1, y));
  const hasN = wallSet.has(key(x, y - 1));
  const hasS = wallSet.has(key(x, y + 1));
  return {
    hasW,
    hasE,
    hasN,
    hasS,
    runEW: hasW || hasE || (!hasN && !hasS),
    runNS: hasN || hasS,
  };
}

/** Arm footprints — mirrors drawInteriorPartitionTile. */
function armExtents(ox, oy, n) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  const isCorner = n.runEW && n.runNS;
  return {
    ew: {
      x0: isCorner && !n.hasW ? cx - HT : ox,
      x1: isCorner && !n.hasE ? cx + HT : ox + 1,
      y0: cy - HT,
      y1: cy + HT,
    },
    ns: {
      x0: cx - HT,
      x1: cx + HT,
      y0: isCorner && !n.hasN ? cy - HT : oy,
      y1: isCorner && !n.hasS ? cy + HT : oy + 1,
    },
  };
}

/** Drawn faces for one tile, per axis — mirrors drawInteriorPartitionTile. */
function tileFaces(ox, oy, n, axis) {
  const g = armExtents(ox, oy, n);
  const sides = [];
  const tops = [];
  const south = (y, x0, x1, box) => {
    if (x1 - x0 <= EPS) return;
    sides.push({ kind: "south", plane: y, a: x0, b: x1, box, sort: (x0 + x1) / 2 + y });
  };
  const east = (x, y0, y1, box) => {
    if (y1 - y0 <= EPS) return;
    sides.push({ kind: "east", plane: x, a: y0, b: y1, box, sort: x + (y0 + y1) / 2 });
  };
  const top = (box) => {
    tops.push({ kind: "top", box });
  };

  if ((axis === "ew" || axis === "both") && n.runEW) {
    if (n.runNS && g.ns.y1 > g.ew.y1 + EPS) {
      south(g.ew.y1, g.ew.x0, Math.min(g.ew.x1, g.ns.x0), g.ew);
      south(g.ew.y1, Math.max(g.ew.x0, g.ns.x1), g.ew.x1, g.ew);
    } else {
      south(g.ew.y1, g.ew.x0, g.ew.x1, g.ew);
    }
    east(g.ew.x1, g.ew.y0, g.ew.y1, g.ew);
    top(g.ew);
  }
  if ((axis === "ns" || axis === "both") && n.runNS) {
    south(g.ns.y1, g.ns.x0, g.ns.x1, g.ns);
    if (n.runEW && g.ew.x1 > g.ns.x1 + EPS) {
      east(g.ns.x1, g.ns.y0, Math.min(g.ns.y1, g.ew.y0), g.ns);
      east(g.ns.x1, Math.max(g.ns.y0, g.ew.y1), g.ns.y1, g.ns);
    } else {
      east(g.ns.x1, g.ns.y0, g.ns.y1, g.ns);
    }
    top(g.ns);
  }
  return { sides, tops };
}

/** Mirrors interiorWallCornerDepthBias. */
function cornerBias(wallSet, x, y, axis) {
  const n = neighbours(wallSet, x, y);
  if (!n.runNS || !n.runEW) return 0;
  let y0 = y;
  let y1 = y;
  while (wallSet.has(key(x, y0 - 1))) y0--;
  while (wallSet.has(key(x, y1 + 1))) y1++;
  const nsLen = y1 - y0 + 1;
  let x0 = x;
  let x1 = x;
  while (wallSet.has(key(x0 - 1, y))) x0--;
  while (wallSet.has(key(x1 + 1, y))) x1++;
  const ewLen = x1 - x0 + 1;
  if (nsLen < ewLen) return axis === "ns" ? 1 : 0;
  if (ewLen < nsLen) return axis === "ew" ? 1 : 0;
  return axis === "ew" ? 1 : 0;
}

const depthOf = (x, y, bias) => (x + y) * 1024 + y + 4 + bias;

/** Mirrors InteriorView.drawWalls: one Graphics per tile-with-both-arms. */
function buildDrawList(walls) {
  const wallSet = new Set(walls.map((w) => key(w.x, w.y)));
  const sorted = [...walls].sort(
    (a, b) => a.x + a.y - (b.x + b.y) || a.y - b.y || a.x - b.x,
  );

  const objects = [];
  const boxes = [];
  for (const w of sorted) {
    const n = neighbours(wallSet, w.x, w.y);
    const g = armExtents(w.x, w.y, n);
    if (n.runEW) boxes.push(g.ew);
    if (n.runNS) boxes.push(g.ns);

    const segs = [];
    if (n.runNS) segs.push({ axis: "ns", bias: cornerBias(wallSet, w.x, w.y, "ns") });
    if (n.runEW) segs.push({ axis: "ew", bias: cornerBias(wallSet, w.x, w.y, "ew") });
    if (segs.length === 0) continue;
    segs.sort((a, b) => a.bias - b.bias);
    const depth = depthOf(w.x, w.y, segs[segs.length - 1].bias);

    let quads = [];
    if (LEGACY) {
      // Old behaviour: each arm drawn whole, arms ordered by corner bias.
      for (const seg of segs) {
        const f = tileFaces(w.x, w.y, n, seg.axis);
        quads.push(...f.sides, ...f.tops);
      }
    } else {
      const f = tileFaces(w.x, w.y, n, segs.length > 1 ? "both" : segs[0].axis);
      quads = [...f.sides.sort((a, b) => a.sort - b.sort), ...f.tops];
    }
    objects.push({ depth, insert: objects.length, quads, tile: w });
  }

  objects.sort((a, b) => a.depth - b.depth || a.insert - b.insert);
  const painted = [];
  for (const o of objects) for (const q of o.quads) painted.push({ ...q, tile: o.tile });
  return { painted, boxes };
}

/**
 * s (= x + y) where the view ray through (SX, SY) meets a face, or null when it
 * misses. `slack` widens the face extents (used for the drawn-quad hit test so
 * shared edges are not treated as gaps).
 */
function faceHit(face, SX, SY, slack = 0) {
  const u = SX / halfW;
  const b = face.box;
  if (face.kind === "south") {
    const y = face.plane ?? b.y1;
    const s = 2 * y + u;
    const x = y + u;
    const lo = face.a ?? b.x0;
    const hi = face.b ?? b.x1;
    if (x < lo - slack || x > hi + slack) return null;
    const h = s * halfH - SY;
    if (h < -slack || h > D + slack) return null;
    return s;
  }
  if (face.kind === "east") {
    const x = face.plane ?? b.x1;
    const s = 2 * x - u;
    const y = x - u;
    const lo = face.a ?? b.y0;
    const hi = face.b ?? b.y1;
    if (y < lo - slack || y > hi + slack) return null;
    const h = s * halfH - SY;
    if (h < -slack || h > D + slack) return null;
    return s;
  }
  const s = (SY + D) / halfH;
  const x = (s + u) / 2;
  const y = (s - u) / 2;
  if (x < b.x0 - slack || x > b.x1 + slack) return null;
  if (y < b.y0 - slack || y > b.y1 + slack) return null;
  return s;
}

/** Nearest real surface of the box union: max s over every box's S/E/top face. */
function nearestSurface(boxes, SX, SY) {
  let best = null;
  for (const b of boxes) {
    for (const kind of ["south", "east", "top"]) {
      const s = faceHit({ kind, box: b }, SX, SY);
      if (s === null) continue;
      if (!best || s > best.s) best = { s, kind, box: b };
    }
  }
  return best;
}

function checkLayout(name, walls) {
  const { painted, boxes } = buildDrawList(walls);
  if (boxes.length === 0) return { wrong: 0, holes: 0, worst: null };

  let minSX = Infinity;
  let maxSX = -Infinity;
  let minSY = Infinity;
  let maxSY = -Infinity;
  for (const b of boxes) {
    for (const [x, y] of [
      [b.x0, b.y0],
      [b.x1, b.y0],
      [b.x0, b.y1],
      [b.x1, b.y1],
    ]) {
      const sx = (x - y) * halfW;
      const sy = (x + y) * halfH;
      minSX = Math.min(minSX, sx);
      maxSX = Math.max(maxSX, sx);
      minSY = Math.min(minSY, sy - D);
      maxSY = Math.max(maxSY, sy);
    }
  }

  let wrong = 0;
  let holes = 0;
  let worst = null;
  // Irrational-ish offset keeps samples off exact face edges.
  for (let sx = minSX + 0.137; sx <= maxSX; sx += 1) {
    for (let sy = minSY + 0.241; sy <= maxSY; sy += 1) {
      const truth = nearestSurface(boxes, sx, sy);
      if (!truth) continue;

      let top = null;
      for (let i = 0; i < painted.length; i++) {
        const s = faceHit(painted[i], sx, sy, EPS);
        if (s === null) continue;
        top = { s, kind: painted[i].kind, tile: painted[i].tile };
      }
      if (!top) {
        holes++;
        continue;
      }
      const gap = truth.s - top.s;
      if (gap > TOL) {
        wrong++;
        if (!worst || gap > worst.gap) {
          worst = { gap, sx, sy, painted: top.kind, expected: truth.kind, tile: top.tile };
        }
      }
    }
  }

  const status = wrong === 0 && holes === 0 ? "OK  " : "FAIL";
  let line = `${status} ${name}: ${wrong} mis-ordered px, ${holes} holes`;
  if (worst) {
    line +=
      ` — worst: painted ${worst.painted} of tile ${worst.tile.x},${worst.tile.y}` +
      ` over a surface ${worst.gap.toFixed(2)} tiles nearer`;
  }
  console.log(line);
  return { wrong, holes };
}

const rect = (x0, y0, x1, y1) => {
  const out = [];
  for (let x = x0; x <= x1; x++) {
    out.push({ x, y: y0 }, { x, y: y1 });
  }
  for (let y = y0 + 1; y < y1; y++) {
    out.push({ x: x0, y }, { x: x1, y });
  }
  return out;
};

const layouts = [];

// Every neighbour combination around a centre tile at (2,2).
for (let mask = 0; mask < 16; mask++) {
  const walls = [{ x: 2, y: 2 }];
  if (mask & 1) walls.push({ x: 1, y: 2 });
  if (mask & 2) walls.push({ x: 3, y: 2 });
  if (mask & 4) walls.push({ x: 2, y: 1 });
  if (mask & 8) walls.push({ x: 2, y: 3 });
  layouts.push([
    `neighbours W:${+!!(mask & 1)} E:${+!!(mask & 2)} N:${+!!(mask & 4)} S:${+!!(mask & 8)}`,
    walls,
  ]);
}

// Corners with unequal arm lengths — the run-length bias flips here.
layouts.push(["L: long EW + short NS (W corner)", [
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
  { x: 0, y: 2 }, { x: 0, y: 1 },
]]);
layouts.push(["L: short EW + long NS (W corner)", [
  { x: 0, y: 4 }, { x: 1, y: 4 },
  { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 },
]]);
layouts.push(["L: long EW + short NS (E corner)", [
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
  { x: 4, y: 2 }, { x: 4, y: 3 },
]]);
layouts.push(["L: short EW + long NS (E corner)", [
  { x: 3, y: 1 }, { x: 4, y: 1 },
  { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 },
]]);

layouts.push(["hollow rect 5x4", rect(0, 0, 4, 3)]);
layouts.push(["hollow rect 6x6", rect(0, 0, 5, 5)]);
layouts.push(["T junction (south)", [
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
  { x: 2, y: 3 }, { x: 2, y: 4 },
]]);
layouts.push(["T junction (north)", [
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
  { x: 2, y: 2 }, { x: 2, y: 1 },
]]);
layouts.push(["T junction (east)", [
  { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
  { x: 3, y: 2 }, { x: 4, y: 2 },
]]);
layouts.push(["T junction (west)", [
  { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 },
  { x: 2, y: 2 }, { x: 1, y: 2 },
]]);
layouts.push(["cross", [
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
  { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 2, y: 4 },
]]);
layouts.push(["two rooms sharing a wall", [
  ...rect(0, 0, 3, 3),
  ...rect(3, 0, 6, 3),
]]);
layouts.push(["staircase", [
  { x: 0, y: 0 }, { x: 1, y: 0 },
  { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 3, y: 3 }, { x: 4, y: 3 },
]]);

let totalWrong = 0;
let totalHoles = 0;
console.log(`mode: ${LEGACY ? "legacy per-arm bias order" : "geometric per-face order"}\n`);
for (const [name, walls] of layouts) {
  const { wrong, holes } = checkLayout(name, walls);
  totalWrong += wrong;
  totalHoles += holes;
}
console.log(
  `\n${totalWrong === 0 && totalHoles === 0 ? "OK" : "FAILURES"}: ` +
    `${totalWrong} mis-ordered samples, ${totalHoles} uncovered samples`,
);
process.exit(totalWrong === 0 && totalHoles === 0 ? 0 : 1);

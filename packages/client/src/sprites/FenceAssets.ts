import Phaser from "phaser";
import {
  cartesianToIso,
  TILE_WIDTH,
  structureFenceFootprint,
  type FenceFacing,
  type StructureFenceCorner,
  type StructureFenceFacing,
} from "@zombie/shared";

export const FENCE_FACINGS: FenceFacing[] = ["NE", "NW", "SE", "SW"];

/** Two-facing corner pieces (filename suffix = the two sides that meet). */
export type FenceCorner = "NWNE" | "SENE" | "SWSE" | "SWNW";

export const FENCE_CORNERS: FenceCorner[] = ["NWNE", "SENE", "SWSE", "SWNW"];

const FENCE_FILES: Record<FenceFacing, string> = {
  NE: "Fence/WoodenFence_NE.png",
  NW: "Fence/WoodenFence_NW.png",
  SE: "Fence/WoodenFence_SE.png",
  SW: "Fence/WoodenFence_SW.png",
};

const FENCE_CORNER_FILES: Record<FenceCorner, string> = {
  NWNE: "Fence/WoodenFence_NWNE.png",
  SENE: "Fence/WoodenFence_SENE.png",
  SWSE: "Fence/WoodenFence_SWSE.png",
  SWNW: "Fence/WoodenFence_SWNW.png",
};

export function fenceTextureKey(facing: FenceFacing): string {
  return `fence-${facing.toLowerCase()}`;
}

export function fenceCornerTextureKey(corner: FenceCorner): string {
  return `fence-corner-${corner.toLowerCase()}`;
}

/** Map a pair of facings on one tile to a corner asset, or null if not a corner. */
export function fenceCornerFromFacings(
  a: FenceFacing,
  b: FenceFacing,
): FenceCorner | null {
  const has = (f: FenceFacing) => a === f || b === f;
  if (has("NW") && has("NE")) return "NWNE";
  if (has("SE") && has("NE")) return "SENE";
  if (has("SW") && has("SE")) return "SWSE";
  if (has("SW") && has("NW")) return "SWNW";
  return null;
}

export function loadFenceAssets(scene: Phaser.Scene) {
  scene.load.setPath("/assets");
  for (const facing of FENCE_FACINGS) {
    scene.load.image(fenceTextureKey(facing), FENCE_FILES[facing]);
  }
  for (const corner of FENCE_CORNERS) {
    scene.load.image(fenceCornerTextureKey(corner), FENCE_CORNER_FILES[corner]);
  }
  for (const facing of CHAINLINK_FACINGS) {
    scene.load.image(chainLinkFenceTextureKey(facing), CHAINLINK_FILES[facing]);
  }
  for (const facing of CHAINLINK_FACINGS) {
    scene.load.image(bargateTextureKey(facing), BARGATE_FILES[facing]);
    for (let f = 1; f <= 5; f++) {
      scene.load.image(
        bargateActiveTextureKey(facing, f),
        `Fence/Bargate1_Active_${facing}_${String(f).padStart(4, "0")}.png`,
      );
    }
  }
  scene.load.image(
    chainLinkFenceCornerTextureKey("SWSE"),
    "Fence/ChainLinkFenceCorner1_SWSE.png",
  );
  scene.load.image(
    chainLinkFenceCornerTextureKey("SESW"),
    "Fence/ChainLinkFenceCorner1_SESW.png",
  );
}

const CHAINLINK_FACINGS: StructureFenceFacing[] = ["SE", "SW"];

const CHAINLINK_FILES: Record<StructureFenceFacing, string> = {
  SE: "Fence/ChainLinkFence1_SE.png",
  SW: "Fence/ChainLinkFence1_SW.png",
};

const BARGATE_FILES: Record<StructureFenceFacing, string> = {
  SE: "Fence/Bargate1_Idle_SE.png",
  SW: "Fence/Bargate1_Idle_SW.png",
};

/** Opaque content span along the panel run (source px). */
const CHAINLINK_CONTENT_SPAN = 199;
const CHAINLINK_SEAM_BLEED = 1.04;
/** Iso tile edges the panel should cover (matches 3×1 footprint). */
const CHAINLINK_RUN_TILES = 3;
/** Extra uniform scale on top of the 3-tile fit. */
const CHAINLINK_SCALE = 1.2;
/** Bargate: 10% smaller than the shared 3-tile panel fit. */
const BARGATE_SCALE = 0.8;
/** Corner is 10% smaller than the panel fit. */
const CHAINLINK_CORNER_SCALE = 1;
const CHAINLINK_ORIGIN_X = 0.5;
const CHAINLINK_ORIGIN_Y = 0.55;
/** Raise by 25% of display height (negative screen-Y). */
const CHAINLINK_RAISE = 0.25;
/** Bargate: lower by 20% of display height (positive screen-Y). */
const BARGATE_LOWER = 0.2;
/** Corner: extra 30% of display height on top of the panel raise. */
const CHAINLINK_CORNER_RAISE = 0.46;
/** SESW corner: lower by 20% of display height (positive screen-Y). */
const CHAINLINK_CORNER_SESW_LOWER = 0.12;
/** SE panel: shift left by 2.5% of display width (negative screen-X). */
const CHAINLINK_SE_SHIFT_X = -0.03;
/** Corner: shift left by 3% of display width (negative screen-X). */
const CHAINLINK_CORNER_SHIFT_X = -0.01;

export function chainLinkFenceTextureKey(facing: StructureFenceFacing): string {
  return `chainlink-fence-${facing.toLowerCase()}`;
}

export function bargateTextureKey(facing: StructureFenceFacing): string {
  return `bargate-${facing.toLowerCase()}`;
}

export function bargateActiveTextureKey(
  facing: StructureFenceFacing,
  frame: number,
): string {
  const tag = String(Math.max(1, Math.floor(frame))).padStart(4, "0");
  return `bargate-active-${facing.toLowerCase()}-${tag}`;
}

export function structurePanelTextureKey(
  kind: string | undefined,
  facing: StructureFenceFacing,
): string {
  return kind === "bargate"
    ? bargateTextureKey(facing)
    : chainLinkFenceTextureKey(facing);
}

export function chainLinkFenceCornerTextureKey(
  corner: StructureFenceCorner,
): string {
  return `chainlink-fence-corner-${corner.toLowerCase()}`;
}

/** Same scale on both axes so native texture aspect ratio is unchanged. */
function chainLinkFenceUniformScale(): number {
  const runPx = (TILE_WIDTH / 2) * CHAINLINK_RUN_TILES;
  return (runPx / CHAINLINK_CONTENT_SPAN) * CHAINLINK_SEAM_BLEED * CHAINLINK_SCALE;
}

/** Iso position of the 3-tile panel centre. */
export function chainLinkFenceAnchor(
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
): { x: number; y: number } {
  const { w, h } = structureFenceFootprint(facing);
  return cartesianToIso(ox + w / 2, oy + h / 2);
}

export function layoutChainLinkFenceImage(
  image: Phaser.GameObjects.Image,
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
  alpha = 1,
  kind?: string,
): void {
  const pos = chainLinkFenceAnchor(ox, oy, facing);
  const scale =
    chainLinkFenceUniformScale() *
    (kind === "bargate" ? BARGATE_SCALE : 1);
  const nativeW = image.frame.realWidth || image.width;
  const nativeH = image.frame.realHeight || image.height;
  const displayW = nativeW * scale;
  const displayH = nativeH * scale;
  const shiftX = facing === "SE" ? displayW * CHAINLINK_SE_SHIFT_X : 0;
  const raise =
    CHAINLINK_RAISE - (kind === "bargate" ? BARGATE_LOWER : 0);
  image.setPosition(pos.x + shiftX, pos.y - displayH * raise);
  image.setOrigin(CHAINLINK_ORIGIN_X, CHAINLINK_ORIGIN_Y);
  image.setDisplaySize(nativeW * scale, displayH);
  image.setAlpha(alpha);
}

export function layoutChainLinkFenceCornerImage(
  image: Phaser.GameObjects.Image,
  ox: number,
  oy: number,
  corner: StructureFenceCorner = "SWSE",
  alpha = 1,
): void {
  const pos = cartesianToIso(ox + 0.5, oy + 0.5);
  const scale = chainLinkFenceUniformScale() * CHAINLINK_CORNER_SCALE;
  const nativeW = image.frame.realWidth || image.width;
  const nativeH = image.frame.realHeight || image.height;
  const displayW = nativeW * scale;
  const displayH = nativeH * scale;
  const raise =
    CHAINLINK_CORNER_RAISE -
    (corner === "SESW" ? CHAINLINK_CORNER_SESW_LOWER : 0);
  image.setPosition(
    pos.x + displayW * CHAINLINK_CORNER_SHIFT_X,
    pos.y - displayH * raise,
  );
  image.setOrigin(CHAINLINK_ORIGIN_X, CHAINLINK_ORIGIN_Y);
  image.setDisplaySize(nativeW * scale, displayH);
  image.setAlpha(alpha);
}

/** Call once after fence textures have finished loading. */
export function configureFenceTextures(scene: Phaser.Scene) {
  for (const facing of FENCE_FACINGS) {
    const key = fenceTextureKey(facing);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  for (const corner of FENCE_CORNERS) {
    const key = fenceCornerTextureKey(corner);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  for (const facing of CHAINLINK_FACINGS) {
    const key = chainLinkFenceTextureKey(facing);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  for (const facing of CHAINLINK_FACINGS) {
    const key = bargateTextureKey(facing);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (let f = 1; f <= 5; f++) {
      const active = bargateActiveTextureKey(facing, f);
      if (!scene.textures.exists(active)) continue;
      scene.textures.get(active).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  for (const corner of ["SWSE", "SESW"] as const) {
    const key = chainLinkFenceCornerTextureKey(corner);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

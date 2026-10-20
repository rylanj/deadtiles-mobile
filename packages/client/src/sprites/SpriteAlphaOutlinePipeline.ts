import Phaser from "phaser";

export const SPRITE_ALPHA_OUTLINE_PIPELINE = "SpriteAlphaOutline";

const OUTLINE_FRAG = `
#define SHADER_NAME SPRITE_ALPHA_OUTLINE_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec3 uOutlineColor;
uniform vec2 uTextureSize;
uniform float uThickness;
varying vec2 outTexCoord;
void main(void) {
    vec2 px = vec2(uThickness) / uTextureSize;
    float alpha = texture2D(uMainSampler, outTexCoord).a;
    if (alpha >= 0.05) {
        discard;
    }
    float neighbor = 0.0;
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(px.x, 0.0)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(-px.x, 0.0)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(0.0, px.y)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(0.0, -px.y)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(px.x, px.y)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(-px.x, px.y)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(px.x, -px.y)).a);
    neighbor = max(neighbor, texture2D(uMainSampler, outTexCoord + vec2(-px.x, -px.y)).a);
    if (neighbor >= 0.05) {
        gl_FragColor = vec4(uOutlineColor, 1.0);
    } else {
        discard;
    }
}
`;

class SpriteAlphaOutlinePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader: OUTLINE_FRAG,
    });
  }

  onBind(gameObject: Phaser.GameObjects.GameObject) {
    super.onBind(gameObject);
    const sprite = gameObject as Phaser.GameObjects.Sprite;
    const frame = sprite.frame;
    // outTexCoord is normalised over the whole texture page, so the neighbour
    // step must be derived from the page size, not the frame size. These are
    // equal for a standalone texture but differ once frames live in an atlas.
    const pageW = frame.source?.width || frame.width;
    const pageH = frame.source?.height || frame.height;
    this.set2f("uTextureSize", pageW, pageH);
    this.set3fv("uOutlineColor", [1, 1, 1]);
    this.set1f("uThickness", 2);
  }
}

export function registerSpriteAlphaOutlinePipeline(game: Phaser.Game): void {
  if (game.renderer.type !== Phaser.WEBGL) return;
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (renderer.pipelines.has(SPRITE_ALPHA_OUTLINE_PIPELINE)) return;
  renderer.pipelines.add(
    SPRITE_ALPHA_OUTLINE_PIPELINE,
    new SpriteAlphaOutlinePipeline(game),
  );
}

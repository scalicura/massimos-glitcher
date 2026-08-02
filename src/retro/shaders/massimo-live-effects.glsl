/*
 * Massimo's Glitcher live emulator effects.
 * Original single-pass GLSL written for RetroArch's WebGL/GLES-compatible
 * shader format. The preset number is fixed by each local .glslp file.
 */

#if defined(VERTEX)

#if __VERSION__ >= 130
#define COMPAT_ATTRIBUTE in
#define COMPAT_VARYING out
#else
#define COMPAT_ATTRIBUTE attribute
#define COMPAT_VARYING varying
#endif

COMPAT_ATTRIBUTE vec4 VertexCoord;
COMPAT_ATTRIBUTE vec4 COLOR;
COMPAT_ATTRIBUTE vec4 TexCoord;
COMPAT_VARYING vec4 TEX0;
uniform mat4 MVPMatrix;

void main() {
  gl_Position = MVPMatrix * VertexCoord;
  TEX0 = TexCoord;
}

#elif defined(FRAGMENT)

#ifdef GL_ES
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#endif

#if __VERSION__ >= 130
#define COMPAT_VARYING in
#define COMPAT_TEXTURE texture
out vec4 FragColor;
#else
#define COMPAT_VARYING varying
#define COMPAT_TEXTURE texture2D
#define FragColor gl_FragColor
#endif

uniform sampler2D Texture;
uniform vec2 InputSize;
uniform vec2 TextureSize;
uniform vec2 OutputSize;
uniform int FrameCount;
COMPAT_VARYING vec4 TEX0;

#pragma parameter MASSIMO_PRESET "Massimo preset" 0.0 0.0 9.0 1.0

#ifdef PARAMETER_UNIFORM
uniform float MASSIMO_PRESET;
#else
#define MASSIMO_PRESET 0.0
#endif

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

vec2 activeUv() {
  return TEX0.xy * TextureSize / InputSize;
}

vec2 textureUv(vec2 uv) {
  return uv * InputSize / TextureSize;
}

vec4 sourcePixel(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  return COMPAT_TEXTURE(Texture, textureUv(uv));
}

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float hash21(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float framePhase() {
  return mod(float(FrameCount), 4096.0);
}

float scanline(vec2 uv, float strength, float phase) {
  return 1.0 - strength * (0.5 + 0.5 * sin(uv.y * InputSize.y * 3.14159265 + phase));
}

float vignette(vec2 uv, float strength) {
  vec2 centered = uv * 2.0 - 1.0;
  return 1.0 - strength * saturate(dot(centered, centered) * 0.55);
}

vec3 triadMask(float strength) {
  float channel = mod(floor(gl_FragCoord.x), 3.0);
  vec3 mask = vec3(1.0 - strength);
  if (channel < 0.5) mask.r = 1.0;
  else if (channel < 1.5) mask.g = 1.0;
  else mask.b = 1.0;
  return mask;
}

vec2 curvedUv(vec2 uv, float amount) {
  vec2 point = uv * 2.0 - 1.0;
  point *= 1.0 + amount * vec2(point.y * point.y, point.x * point.x);
  return point * 0.5 + 0.5;
}

vec3 cleanPixels(vec2 uv) {
  return sourcePixel(uv).rgb;
}

vec3 consumerCrt(vec2 uv) {
  vec2 curved = curvedUv(uv, 0.035);
  vec3 color = sourcePixel(curved).rgb;
  color *= scanline(curved, 0.12, 0.0);
  color *= triadMask(0.08);
  color *= vignette(curved, 0.24);
  return color;
}

vec3 arcadeMonitor(vec2 uv) {
  vec3 color = sourcePixel(uv).rgb;
  float gray = luminance(color);
  color = mix(vec3(gray), color, 1.16);
  color *= scanline(uv, 0.22, 0.0);
  color *= triadMask(0.14);
  return color * 1.06;
}

vec3 badCompositeCable(vec2 uv, vec2 pixel, float frame) {
  float row = floor(uv.y * InputSize.y / 6.0);
  float jitter = (hash21(vec2(row, floor(frame / 4.0))) - 0.5) * pixel.x * 1.6;
  vec2 shifted = uv + vec2(jitter, 0.0);
  vec3 color;
  color.r = sourcePixel(shifted + vec2(pixel.x * 1.6, 0.0)).r;
  color.g = sourcePixel(shifted).g;
  color.b = sourcePixel(shifted - vec2(pixel.x * 1.6, 0.0)).b;
  vec3 bleed = sourcePixel(shifted - vec2(pixel.x * 3.0, 0.0)).rgb;
  vec3 softness = sourcePixel(shifted + vec2(pixel.x * 3.0, 0.0)).rgb;
  return mix(color, (bleed + color + softness) / 3.0, 0.22);
}

vec3 vhsGameCapture(vec2 uv, vec2 pixel, float frame) {
  float band = floor(uv.y * 18.0);
  float gate = step(0.72, hash21(vec2(band, floor(frame / 5.0))));
  float shift = (hash21(vec2(band + 19.0, floor(frame / 5.0))) - 0.5) * pixel.x * 7.0 * gate;
  vec2 warped = uv + vec2(shift + sin(uv.y * 82.0 + frame * 0.12) * pixel.x * 0.45, 0.0);
  vec3 color;
  color.r = sourcePixel(warped + vec2(pixel.x, 0.0)).r;
  color.g = sourcePixel(warped).g;
  color.b = sourcePixel(warped - vec2(pixel.x, 0.0)).b;
  float noise = hash21(floor(uv * InputSize) + vec2(frame, band)) - 0.5;
  color += noise * 0.045;
  color *= scanline(uv, 0.09, frame * 0.08);
  return color;
}

vec3 monochromeTerminal(vec2 uv, vec2 pixel) {
  vec3 center = sourcePixel(uv).rgb;
  float glow = (
    luminance(sourcePixel(uv + vec2(pixel.x, 0.0)).rgb) +
    luminance(sourcePixel(uv - vec2(pixel.x, 0.0)).rgb)
  ) * 0.5;
  float value = mix(luminance(center), glow, 0.14);
  vec3 green = vec3(value * 0.18, value, value * 0.36);
  return green * scanline(uv, 0.07, 0.0) + vec3(0.0, value * 0.035, 0.0);
}

vec3 handheldLcd(vec2 uv) {
  vec3 color = sourcePixel(uv).rgb;
  float gray = luminance(color);
  color = mix(vec3(gray), color, 0.62);
  float column = mod(floor(gl_FragCoord.x), 3.0);
  float row = mod(floor(gl_FragCoord.y), 3.0);
  float grid = (column < 0.5 || row < 0.5) ? 0.82 : 1.0;
  return color * vec3(0.92, 1.0, 0.88) * grid;
}

vec3 brokenCartridge(vec2 uv, vec2 pixel, float frame) {
  vec2 block = floor(uv * vec2(16.0, 12.0));
  float blockNoise = hash21(block + floor(frame / 9.0));
  float rowNoise = hash21(vec2(block.y, floor(frame / 7.0)));
  float active = step(0.72, blockNoise) * step(0.56, rowNoise);
  float direction = step(0.5, blockNoise) * 2.0 - 1.0;
  vec2 displaced = uv + vec2(direction * active * pixel.x * (4.0 + blockNoise * 12.0), 0.0);
  vec3 color;
  color.r = sourcePixel(displaced + vec2(pixel.x * 2.5, 0.0)).r;
  color.g = sourcePixel(displaced).g;
  color.b = sourcePixel(displaced - vec2(pixel.x * 2.5, 0.0)).b;
  return color * (1.0 - active * 0.12);
}

vec3 corruptedBroadcast(vec2 uv, vec2 pixel, float frame) {
  float region = floor(uv.y * 24.0);
  float corruption = step(0.62, hash21(vec2(region, floor(frame / 6.0))));
  float shift = (hash21(vec2(region + 41.0, floor(frame / 6.0))) - 0.5) * pixel.x * 12.0 * corruption;
  vec2 moved = uv + vec2(shift, 0.0);
  vec3 color;
  color.r = sourcePixel(moved + vec2(pixel.x * 2.0 * corruption, 0.0)).r;
  color.g = sourcePixel(moved).g;
  color.b = sourcePixel(moved - vec2(pixel.x * 2.0 * corruption, 0.0)).b;
  float lineNoise = hash21(vec2(floor(uv.y * InputSize.y), floor(frame / 2.0))) - 0.5;
  color += lineNoise * 0.055;
  return color * scanline(uv, 0.13 + corruption * 0.08, frame * 0.1);
}

vec3 glitchBoss(vec2 uv, vec2 pixel, float frame) {
  float band = floor(uv.y * 30.0);
  float block = floor(uv.x * 20.0);
  float bandNoise = hash21(vec2(band, floor(frame / 4.0)));
  float blockNoise = hash21(vec2(block + band * 3.0, floor(frame / 8.0)));
  float active = step(0.5, bandNoise);
  float shift = (bandNoise - 0.5) * pixel.x * 28.0 * active;
  vec2 moved = uv + vec2(shift, sin(block * 2.1 + frame * 0.08) * pixel.y * step(0.7, blockNoise) * 2.0);
  vec3 center = sourcePixel(moved).rgb;
  vec3 color;
  color.r = sourcePixel(moved + vec2(pixel.x * (3.0 + blockNoise * 4.0), 0.0)).r;
  color.g = mix(center.g, sourcePixel(moved - vec2(pixel.x * 2.0, 0.0)).g, 0.35);
  color.b = sourcePixel(moved - vec2(pixel.x * (3.0 + blockNoise * 4.0), 0.0)).b;
  float noise = hash21(floor(uv * InputSize * 0.5) + vec2(frame, band)) - 0.5;
  color += noise * 0.09;
  color *= scanline(uv, 0.19, frame * 0.15);
  return mix(color, color.bgr, step(0.86, blockNoise) * 0.28);
}

void main() {
  vec2 uv = activeUv();
  vec2 pixel = 1.0 / InputSize;
  float frame = framePhase();
  float preset = floor(MASSIMO_PRESET + 0.5);
  vec3 color;

  if (preset < 0.5) color = cleanPixels(uv);
  else if (preset < 1.5) color = consumerCrt(uv);
  else if (preset < 2.5) color = arcadeMonitor(uv);
  else if (preset < 3.5) color = badCompositeCable(uv, pixel, frame);
  else if (preset < 4.5) color = vhsGameCapture(uv, pixel, frame);
  else if (preset < 5.5) color = monochromeTerminal(uv, pixel);
  else if (preset < 6.5) color = handheldLcd(uv);
  else if (preset < 7.5) color = brokenCartridge(uv, pixel, frame);
  else if (preset < 8.5) color = corruptedBroadcast(uv, pixel, frame);
  else color = glitchBoss(uv, pixel, frame);

  FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}

#endif

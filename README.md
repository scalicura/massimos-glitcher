# Massimo's Glitcher

Massimo's Glitcher is a private, browser-based media playground built with Vite, vanilla JavaScript, CSS, HTML5 Canvas, IndexedDB, WebAssembly-powered emulation, and native browser media APIs. Images, animation projects, soundboard files, and user-supplied ROMs stay on the device. There is no backend, account, paid API, or React dependency.

## Phase 5: Glitch Studio

**Glitch Studio** adds two isolated creation modes without turning the app into a general video editor:

- **Animated Glitch** creates deterministic 2, 3, 5, 8, or 10-second loops at 12, 15, 24, or 30 FPS.
- **Broadcast Maker** combines the same motion pipeline with safe, editable fictional broadcast overlays.

Upload a local JPG, PNG, or WebP, choose a preset or Guided Mode theme, add a few timeline events, and select **Preview**. **Stop Preview** cancels the single active animation loop. Leaving Glitch Studio or hiding the page pauses preview and stops generated cues. Preview frames always redraw the preserved source image before applying time-dependent damage; frames are never progressively corrupted.

### Animated effects and presets

The ten animated effects are **RGB Flicker**, **Signal Tear**, **Macroblock Corruption**, **VHS Tracking**, **Freeze Pulse**, **Static Burst**, **Color Dropout**, **Frame Flash**, **Zoom Jolt**, and **Scanline Drift**. **Effects Off**, **Reset**, and **Randomize** are available in Advanced Mode.

The original presets are:

- Mild: **Security Feed**, **Dream Transmission**, and **Quiet Before the Scare**
- Strange: **Broken Cartoon**, **Haunted VHS**, and **Lost Broadcast**
- Severe: **Abandoned Arcade**, **Corrupted Mascot**, **Damaged Cartridge**, and **Signal Collapse**

Each preset carries an intensity category, description, seed behavior, and recommended duration/frame rate. The same source image, dimensions, duration, frame rate, settings, timeline, and seed reproduce the same visual frame sequence within the same browser rendering pipeline.

### Guided Mode and timeline

Guided Mode follows six short steps: upload an image, choose a theme, choose Mild/Strange/Destroyed intensity, optionally enter warning text, preview, and export. Its eight themes map to coherent preset families rather than unrelated random values. Opening Advanced Mode preserves the generated settings.

The compact timeline has a scrubber, time ruler, playhead, and a limit of 24 event markers. Supported visual markers are **Glitch Burst**, **Freeze**, **Blackout**, **Flash**, and **Text Warning**; local **Audio Cue** markers are also shown. Markers can be dragged, selected, duplicated, deleted, and moved with Arrow keys. Shift + Arrow moves one second. All positions are clamped to the project duration.

### Broadcast Maker

Broadcast Maker includes ten fictional templates: **Signal Lost**, **Emergency Alert**, **Intercepted Transmission**, **Corrupted Children’s Program**, **Security Camera Feed**, **Abandoned Arcade Recording**, **Test Pattern**, **Classified Training Tape**, **Station Interruption**, and **Unknown Entity Detected**.

Headline, subtitle, ticker, timestamp, channel, camera ID, station, alignment, size, theme, opacity, and safe-area guides are editable. Text treatments include Flicker, Character Scramble, Horizontal Tear, Missing Letters, Duplicate Shadow, Terminal Typing, Warning Pulse, Scanline Reveal, Redaction Bars, and Intermittent Dropout. User text is length-limited, stripped of control/angle characters, stored as plain data, and drawn with Canvas `fillText`; it is never inserted as HTML. Reduced-flash protection is on by default, lowers flash opacity, warns when disabled with intense settings, and complements `prefers-reduced-motion` safeguards.

### Audio cues and animation export

Preview-only audio cues include an original warning beep, low alarm, static burst, signal chirp, impact hit, rising tone, and descending power-down tone. They are synthesized locally through Web Audio, capped at 65% cue volume, and routed through a dynamics compressor. Existing local Soundboard pads appear only while present and require explicit selection. Audio never autoplays before Preview, and YouTube audio is never routed, extracted, recorded, or exported.

Primary animation export is silent **WebM** through `canvas.captureStream()` and `MediaRecorder`. A **current-frame PNG** is also available. Output can use original resolution or be bounded to 1080p or 720p while preserving aspect ratio; the UI estimates dimensions and working memory. Exports remain local, show progress, reject duplicate export attempts, sanitize filenames, stop media tracks, and revoke temporary object URLs. GIF, PNG-frame ZIP, MP4, and synchronized audio muxing are intentionally deferred.

### Local projects and privacy

Animated Glitch and Broadcast projects can be created, saved, saved as, loaded, renamed, duplicated, and deleted with confirmation. Optional autosave runs only after a project has an ID. IndexedDB records use a versioned schema and may include the local source-image Blob and a thumbnail. Project JSON uses `.massimo-glitch.json` or `.massimo-broadcast.json`; imports are capped at 1 MB, reject remote URLs and incompatible/malformed schemas, and never contain executable code or embedded media.

All processing and storage remain in the browser. Clearing site data can permanently remove IndexedDB projects. Export Project JSON before clearing browser data if a project configuration matters.

## Checkpoints 4A and 4B: Retro Lab

Retro Lab runs locally supplied NES and SNES ROMs through a version-pinned, self-hosted EmulatorJS runtime:

- EmulatorJS `4.2.3` stable
- FCEUmm core `4.2.3` for `.nes` files
- Snes9x core `4.2.3` for `.sfc` and `.smc` files
- `.bin` and `.rom` files are accepted only with an explicit NES/SNES override

To use it:

1. Open **Retro Lab**.
2. Drop a legally usable local ROM onto the cartridge area or choose **Choose ROM**.
3. Leave system detection on **Auto**, or select NES/SNES to resolve an ambiguous extension.
4. Leave **Enable Effects** off for the lowest-overhead native output, or enable it and choose one fixed visual preset.
5. Select **Load cartridge**, then press **Start Game** inside the EmulatorJS player.
6. To change the active effect, choose another preset and select **Apply**. Confirm the restart warning; recreating the emulator discards unsaved gameplay state but reuses the selected local ROM.
7. Use the visible EmulatorJS toolbar for Pause/Resume, Restart, volume, mute, fullscreen, a clean emulator-only PNG screenshot, session save/load state, and control settings.
8. Select **Unload** to destroy the emulator instance and release the ROM object URL.

### Live visual effects

Checkpoint 4B adds ten fixed presets grouped by expected GPU cost:

- Low cost: **Clean Pixels**, **Consumer CRT**, **Arcade Monitor**, **Monochrome Terminal**, and **Handheld LCD**
- Moderate cost: **Bad Composite Cable**, **VHS Game Capture**, **Broken Cartridge**, and **Corrupted Broadcast**
- High cost: **Glitch Boss**

Broken Cartridge, Corrupted Broadcast, and Glitch Boss are intentionally aggressive and can reduce gameplay visibility. **Reset to Clean Pixels** selects and applies the no-post-processing, nearest-neighbor Clean Pixels preset. To disable the shader chain entirely, turn off **Enable Effects** and select **Apply**.

The effects use EmulatorJS's documented `EJS_shaders` option and Libretro `.glslp` shader format. Each preset is a single native-resolution, source-scaled WebGL fragment-shader pass with nearest-neighbor filtering. The shader is WebGL 1 compatible; EmulatorJS may choose WebGL 2 where supported. A detached 1-by-1 WebGL context compiles and links the local shader once before startup so malformed files fail safely; it never draws, presents, polls, or reads a frame. There is no second presentation canvas, synchronous framebuffer readback, per-frame JavaScript polling, or modification of EmulatorJS internals. If shader validation or the live WebGL context fails, the disposable player retries once with Effects Off.

Only fixed presets are supported. Live outer-UI sliders are not included because EmulatorJS 4.2.3 does not document runtime shader-uniform updates. Retro Lab does not reuse the Image Editor's CPU Canvas effects on emulator frames, and it has no continuous `getImageData()`, `readPixels()`, or canvas-copy path. Its glitch modes are visual shader treatments; true codec-level datamoshing is not part of Retro Lab.

EmulatorJS 4.2.3 does not document an API that captures the post-shader frame. The toolbar therefore continues to produce clean emulator-only PNG screenshots. Effected screenshots, recording, and video export are not included because adding them safely would require a supported post-shader output hook or a separate rendering pipeline.

Default Player 1 keyboard bindings are Arrow keys for the D-pad, `Z`/`X` for A/B, `Enter` for Start, and `V` for Select. SNES additionally uses `A`/`S` for X/Y and `Q`/`E` for L/R. Open **Controls** in the emulator toolbar to remap keyboard input or assign connected gamepads. The EmulatorJS control panel exposes Player 2 mapping for NES and SNES; actual multi-controller behavior can vary by browser, controller, game, and core.

Save states are kept only in the active emulator iframe's memory. They disappear when the ROM is unloaded, the page is refreshed, or the tab closes. Persistent browser databases and EmulatorJS local-storage settings are disabled. Leaving Retro Lab or hiding the page pauses an active emulator; returning does not resume it automatically.

Retro Lab does not hold a screen wake lock. This avoids permission failures in embedded or restricted browsers; normal browser/device sleep settings still apply.

The emulator is isolated in a disposable same-origin iframe. Removing that iframe tears down the associated scripts, WebAssembly module, audio context, event listeners, and animation loop. Only one iframe and one revocable ROM object URL can exist at a time.

Use only ROMs you are legally entitled to run. No ROMs, BIOS files, save files, or test media ship with the project. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for exact package versions, licenses, source links, the Snes9x non-commercial-use restriction, and warranty notices.

## Phase 3 features

### Image Editor

- Non-destructive JPG, PNG, and WebP editing from an immutable decoded source
- Reduced-resolution live previews and full-resolution PNG, JPEG, or WebP export
- Existing RGB shift, slice displacement, pixelation, scanlines, noise, VHS, CRT, retro-game, and data-corruption effects
- Six modular datamosh-inspired still-image effects:
  - **Macroblock Displacement** copies selected rectangular source regions into displaced positions.
  - **Compression Melt** creates directional block and pixel smears.
  - **Frame Tear / Offset** duplicates and offsets horizontal, vertical, or mixed regions.
  - **Regional Color Drift** shifts channels only inside deterministic damaged regions.
  - **Block Echo Trails** repeats selected blocks to suggest motion persistence.
  - **Signal Band Corruption** displaces and colors noisy broadcast-style bands.
- Five deterministic presets: **Datamosh Lite**, **Datamosh Meltdown**, **Broken Codec**, **Frozen Motion**, and **Panic Broadcast**
- Before/after comparison, Undo/Redo, Randomize, Reset, and the original Phase 2 presets

These effects imitate the visual language of datamoshing on a single still image. They do not manipulate codecs, motion vectors, I/P frames, video files, timelines, or YouTube frames.

### Audio Studio: local Soundboard

1. Open **Audio Studio** and drop one or more files onto the Soundboard, or select **Choose sounds**.
2. Use the large pad button to play or restart a sound. Pause, stop, loop, volume, and playback-speed controls are available per pad.
3. Rename a pad or assign one optional `A-Z` or `0-9` shortcut. Duplicate shortcuts are rejected, repeated keydown events are ignored, and shortcuts never fire while focus is in an input, textarea, select, or editable element.
4. Replace, duplicate, or delete individual pads. Master volume, master mute, **Stop All**, and confirmed **Clear All** affect only the local Soundboard.

The Soundboard accepts MP3, WAV, and OGG. M4A is accepted only when the current browser reports MP4-audio support; actual codec support can also depend on the browser, operating system, and encoding used by the file. Unsupported or undecodable media reports a pad-level error without stopping the rest of the board.

Sound pads are session-only in Phase 3 and disappear on refresh. Pads use reusable `HTMLAudioElement` instances and object URLs, which are revoked when a file is replaced, a pad is deleted, the board is cleared, or the app is torn down. The practical limits are 24 pads and 40 MB per audio file.

### Audio Studio: YouTube Player

1. Paste a standard YouTube URL, `youtu.be` URL, playlist URL, combined video-and-playlist URL, valid video ID, or valid playlist ID.
2. Select **Load**. Loading cues the content but never autoplays it.
3. Use the visible official player or the synchronized Play, Pause, Stop, Restart, Previous, Next, Mute, and volume controls.
4. **Open on YouTube** opens the canonical content page. **Clear** removes the current player content.

The integration uses the official YouTube IFrame Player API and loads its script once. The embedded player remains visible while content is loaded, and leaving Audio Studio pauses playback. The app does not extract or download audio/video, hide YouTube branding, bypass ads or playback restrictions, proxy media, route YouTube audio into the Soundboard, process video frames, or include YouTube content in exports. No YouTube Data API key or account is required. The last entered value is remembered only in `sessionStorage` for the current browser tab.

Private, removed, region-restricted, age-restricted, or embedding-disabled content can still be rejected by YouTube. Network filtering, privacy extensions, or a blocked third-party script can prevent the IFrame API from loading; the player reports that failure without affecting the editor or Soundboard.

## Deterministic seeds

Every randomized still-image effect uses the lightweight seeded generator in `src/random/seeded-random.js`; deterministic effect code does not call `Math.random`. Enter a whole-number shared seed from `0` through `4294967295` and press Enter or leave the field to apply it. **New seed** creates one with `crypto.getRandomValues`.

Each datamosh effect also has an optional local seed. A local value of `0` follows the shared seed; a positive local value pins that effect independently. Given the same source image, canvas dimensions, settings, effect order, and seed, the rendered result is reproducible. Randomize creates a new shared seed, and Phase 3 presets carry stored seeds.

## Requirements

- Node.js 20.19+ or 22.12+
- pnpm 11 (recommended and declared in `package.json`)
- A current Chromium, Firefox, or Safari browser with Canvas, Blob URL, IndexedDB, Web Audio, and HTML media support
- `MediaRecorder` plus Canvas `captureStream()` for WebM animation export

## Install and run

From the project root:

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`.

If pnpm is unavailable, enable the Node package-manager shim with `corepack enable`. `npm install` and `npm run dev` also work, but `pnpm-lock.yaml` is the tested lockfile.

To expose the development server on the local network:

```bash
pnpm dev --host
```

## Production build and preview

```bash
pnpm build
pnpm preview
```

Vite writes the optimized static application to `dist/`. No server-side runtime is required.

Run the static validation tests with:

```bash
pnpm test
```

## Project structure

```text
assets/                         Mascot artwork
src/audio/audio-state.js        Audio validation and session state records
src/audio/sound-pad.js          Semantic per-pad UI
src/audio/soundboard.js         Playback, shortcuts, master controls, cleanup
src/effects/                    Phase 3 datamosh-inspired effect modules
src/random/seeded-random.js     Shared deterministic pseudo-random generator
src/studio/model.js             Phase 5 schemas, validation, presets, templates, and pure logic
src/studio/renderer.js          Source-first deterministic animation and broadcast renderer
src/studio/glitch-studio.js     Studio UI, preview lifecycle, timeline, projects, and exports
src/studio/storage.js           Versioned IndexedDB project persistence
src/studio/audio-cues.js        Limited local generated/Soundboard preview cues
src/studio/exporter.js          Silent WebM and current-frame PNG export
src/retro/player.js             Isolated EmulatorJS iframe configuration and session states
src/retro/retro-lab.js          ROM/effect UI, restart/fallback lifecycle, pause, and cleanup
src/retro/rom-validation.js     NES/SNES signature, extension, size, and override validation
src/retro/shader-catalog.js     Fixed preset metadata, cost tiers, and warnings
src/retro/shader-registry.js    EmulatorJS shader registration and selection validation
src/retro/shaders/              Original WebGL-compatible shader and Libretro preset files
src/youtube/youtube-player.js   Official IFrame API lifecycle and controls
src/youtube/youtube-url-parser.js URL and direct-ID validation
src/effects.js                  Ordered Canvas effect pipeline
src/export.js                   Full-resolution multi-format export
src/image-io.js                 Image validation and immutable decoding
src/main.js                     Workspace state, navigation, and UI events
src/presets.js                  Centralized defaults and preset values
src/renderer.js                 Preview sizing and source-first rendering
src/render-worker.js            OffscreenCanvas export worker
src/styles.css                  Responsive retro interface
index.html                      Semantic application markup
retro-player.html               Disposable same-origin emulator entry page
vite.config.js                  Multi-page build and explicit pinned emulator asset map
THIRD_PARTY_LICENSES.md         Emulator/core versions, licenses, and source notices
tests/rom-validation.test.js    Node-based ROM validation regression tests
tests/shader-presets.test.js    Shader catalog, asset, and architecture regression tests
tests/studio-logic.test.js      Phase 5 schema, preset, seed, timeline, and filename tests
```

## Known limitations

- Full-resolution export is limited by available memory and the browser's maximum Canvas dimensions. Previews are capped at a 1600-pixel edge and approximately two million pixels.
- Effect work is deterministic for a given browser rendering pipeline, but tiny color differences are possible between browser engines.
- Complex effect combinations on very large exports take longer; supported browsers use an OffscreenCanvas worker and fall back to the main thread if necessary.
- Soundboard pads are not persisted, waveform editing and recording are not included, and M4A codec coverage varies by platform.
- YouTube availability and playback behavior remain controlled by YouTube and the user's network/browser environment.
- EmulatorJS core startup requires WebAssembly and downloads approximately 1 MB of locally hosted compressed core data when a cartridge starts. Older browsers may fall back to the legacy-WebAssembly build.
- Fullscreen and Gamepad API behavior depends on browser permissions and device support. Mobile browsers may use EmulatorJS's virtual controls.
- WebGL feature support and shader performance depend on the browser, GPU, driver, core, and device. Effects Off is the supported lowest-overhead fallback.
- The live pipeline was verified in a current Chromium/Edge-compatible browser. Its WebGL 1 shader format is intended as the Firefox/Safari compatibility baseline, but this checkpoint did not independently execute those engines or force EmulatorJS's optional WebGL 2 path.
- The 390-pixel mobile layout stacks without horizontal overflow and leaves EmulatorJS controls unobscured. Physical touch controls and sustained mobile-GPU frame rate were not measured; use a low-cost preset or Effects Off if a high-cost effect stutters.
- Changing an active shader requires an explicit emulator restart. There are no live effect sliders or runtime shader hot-swapping.
- Save states are intentionally memory-only and do not survive unload, shader restart, or refresh. Battery-backed SRAM import/export and persistent saves are disabled.
- Snes9x is licensed for personal/non-commercial use; commercial distribution requires permission from its copyright holders.
- Retro Lab supports only NES and SNES. It includes no BIOS or game content.
- Effected screenshots, recording, codec-level corruption, audio corruption, per-game effect automation, and additional console systems are not included.
- Glitch Studio WebM encoding is browser-native, real-time, silent, and codec-dependent. Chromium-family browsers generally provide the broadest `captureStream()`/MediaRecorder support; Safari and Firefox support varies by version and platform.
- GIF, PNG-frame ZIP, MP4, synchronized audio export, arbitrary video input, multitrack editing, and true codec-level datamoshing are not included. Generated and Soundboard cues are preview-only.
- Original-resolution animation export can be memory intensive and is limited by the browser's maximum Canvas size, encoder, device memory, and sustained real-time rendering capacity. Use 720p on mobile or constrained devices.
- Project JSON stores configuration but intentionally does not embed source images or audio. IndexedDB saves may store the source-image Blob subject to browser quota and eviction policies.

## Future roadmap

A focused follow-up can improve export reliability with a worker-driven frame encoder, optional lightweight GIF support after performance evaluation, project schema migrations, and broader Firefox/Safari/mobile device testing. A full video editor, DAW, cloud account system, and copyrighted mascot libraries remain outside the product direction.

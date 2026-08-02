# Massimo's Glitcher

Massimo's Glitcher is a private, browser-based media playground built with Vite, vanilla JavaScript, CSS, HTML5 Canvas, and native browser media APIs. Images and soundboard files stay on the device. There is no backend, account, paid API, or React dependency.

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
- A current Chromium, Firefox, or Safari browser with Canvas, Blob URL, and HTML media support

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

## Project structure

```text
assets/                         Mascot artwork
src/audio/audio-state.js        Audio validation and session state records
src/audio/sound-pad.js          Semantic per-pad UI
src/audio/soundboard.js         Playback, shortcuts, master controls, cleanup
src/effects/                    Phase 3 datamosh-inspired effect modules
src/random/seeded-random.js     Shared deterministic pseudo-random generator
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
```

## Known limitations

- Full-resolution export is limited by available memory and the browser's maximum Canvas dimensions. Previews are capped at a 1600-pixel edge and approximately two million pixels.
- Effect work is deterministic for a given browser rendering pipeline, but tiny color differences are possible between browser engines.
- Complex effect combinations on very large exports take longer; supported browsers use an OffscreenCanvas worker and fall back to the main thread if necessary.
- Soundboard pads are not persisted, waveform editing and recording are not included, and M4A codec coverage varies by platform.
- YouTube availability and playback behavior remain controlled by YouTube and the user's network/browser environment.
- This phase processes still images only. There is no video input, timeline, frame processing, or video export.

## Recommended Phase 4 scope

Keep Phase 4 focused on local workflow improvements: opt-in IndexedDB persistence for Soundboard pad metadata and file handles/blobs, import/export of board configurations, lightweight waveform previews, and reusable custom image-preset saving. Treat any true video editor or codec-level datamosh work as a separate, explicitly scoped project because it has very different performance, storage, and export requirements.

# Massimo’s Glitcher

A private, browser-based image glitch editor built with Vite, vanilla JavaScript, CSS, and the HTML5 Canvas API. Images never leave the browser.

## Features

- Drag-and-drop or file-picker upload for JPG, PNG, and WebP images
- Non-destructive rendering from the original decoded image
- RGB channel separation, horizontal slice displacement, pixelation, scanlines, and static/noise
- Seeded random effects that stay stable between renders
- Reduced-resolution previews for large images
- Full-resolution PNG export
- Responsive desktop and mobile interface

## Requirements

- Node.js 20.19+ or 22.12+
- pnpm 11 (recommended; the version is declared in `package.json`)

## Setup

From the project root, install the locked dependencies:

```bash
pnpm install
```

If pnpm is not installed, enable the Node.js package-manager shim first with `corepack enable`. You can also use `npm install`, but pnpm is recommended because `pnpm-lock.yaml` pins the tested dependency tree.

## Run the development server

```bash
pnpm dev
```

Vite prints the local URL in the terminal, normally `http://localhost:5173/`. Open that URL in a modern browser.

To expose the development server to other devices on your local network:

```bash
pnpm dev --host
```

## Production build

```bash
pnpm build
```

The optimized application is written to `dist/`. Preview that build locally with:

```bash
pnpm preview
```

## Usage

1. Drop a JPG, PNG, or WebP image onto the upload area or preview monitor, or choose **Select an image**.
2. Enable effects and adjust their sliders. Every adjustment is re-rendered from the original image.
3. Select **Randomize** for a new seeded combination, or **Reset** to return to the unaltered image.
4. Select **Export PNG** to render and download the result at the source image’s full dimensions.

The upload limit is 25 MB. Very large source dimensions can still be constrained by the browser’s maximum canvas size or available memory during full-resolution export.

## Project structure

```text
assets/              Mascot artwork
src/main.js          Application state and UI events
src/image-io.js      File validation and immutable source decoding
src/renderer.js      Preview sizing and non-destructive render pipeline
src/effects.js       Modular canvas image effects
src/export.js        Full-resolution PNG export
src/styles.css       Responsive retro interface
index.html           Application markup
pnpm-workspace.yaml  Narrow build-script approval for Vite's esbuild dependency
```

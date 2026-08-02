import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

function packageFile(packageName, relativePath) {
  return path.join(path.dirname(require.resolve(`${packageName}/package.json`)), relativePath);
}

// EmulatorJS loads its runtime and compressed cores by URL. This explicit map
// exposes only the pinned NES/SNES assets in development and emits the same
// paths in production; ROMs are never copied into the build.
const emulatorAssets = new Map([
  ['loader.js', packageFile('@emulatorjs/emulatorjs', 'data/loader.js')],
  ['emulator.css', packageFile('@emulatorjs/emulatorjs', 'data/emulator.css')],
  ['LICENSE', packageFile('@emulatorjs/emulatorjs', 'LICENSE')],
  ...['emulator.js', 'nipplejs.js', 'shaders.js', 'storage.js', 'gamepad.js', 'GameManager.js', 'socket.io.min.js', 'compression.js']
    .map((file) => [`src/${file}`, packageFile('@emulatorjs/emulatorjs', `data/src/${file}`)]),
  ...['extract7z.js', 'extractzip.js', 'libunrar.js', 'libunrar.wasm']
    .map((file) => [`compression/${file}`, packageFile('@emulatorjs/emulatorjs', `data/compression/${file}`)]),
  ['cores/reports/fceumm.json', packageFile('@emulatorjs/core-fceumm', 'reports/fceumm.json')],
  ['cores/reports/snes9x.json', packageFile('@emulatorjs/core-snes9x', 'reports/snes9x.json')],
  ...['fceumm-wasm.data', 'fceumm-legacy-wasm.data']
    .map((file) => [`cores/${file}`, packageFile('@emulatorjs/core-fceumm', file)]),
  ...['snes9x-wasm.data', 'snes9x-legacy-wasm.data']
    .map((file) => [`cores/${file}`, packageFile('@emulatorjs/core-snes9x', file)]),
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.data': 'application/octet-stream',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

function emulatorAssetsPlugin() {
  return {
    name: 'massimo-emulatorjs-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url, 'http://local').pathname;
        if (!pathname.startsWith('/emulatorjs/')) return next();
        const relativePath = decodeURIComponent(pathname.slice('/emulatorjs/'.length));
        const sourcePath = emulatorAssets.get(relativePath);
        if (!sourcePath) {
          response.statusCode = 404;
          response.end('Emulator asset not found');
          return;
        }
        response.setHeader('Content-Type', contentTypes[path.extname(relativePath)] || 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-store');
        response.end(await readFile(sourcePath));
      });
    },
    async generateBundle() {
      for (const [relativePath, sourcePath] of emulatorAssets) {
        this.emitFile({ type: 'asset', fileName: `emulatorjs/${relativePath}`, source: await readFile(sourcePath) });
      }
    },
  };
}

export default defineConfig({
  plugins: [emulatorAssetsPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve('index.html'),
        retroPlayer: path.resolve('retro-player.html'),
      },
    },
  },
});

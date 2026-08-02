# Third-party emulator notices

Massimo's Glitcher Checkpoints 4A and 4B self-host the following unmodified npm releases. The application includes no ROMs, BIOS files, save files, or game assets.

## EmulatorJS 4.2.3

- Package: `@emulatorjs/emulatorjs@4.2.3`
- License: GNU General Public License v3.0
- Source: https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3
- Project: https://emulatorjs.org/
- Full license: emitted at `/emulatorjs/LICENSE` in development and production builds

EmulatorJS is provided without warranty. Its unmodified browser runtime is loaded inside a disposable same-origin iframe. Massimo's Glitcher supplies integration code around that runtime; it does not modify the published EmulatorJS source or core binaries.

## FCEUmm core 4.2.3

- Package: `@emulatorjs/core-fceumm@4.2.3`
- License: GNU General Public License v2.0
- EmulatorJS source mirror: https://github.com/EmulatorJS/libretro-fceumm
- Upstream core documentation: https://docs.libretro.com/library/fceumm/

The core's own license text and build metadata are embedded in the published compressed core data. The production build includes only the WebAssembly and legacy-WebAssembly FCEUmm variants selected by EmulatorJS.

## Snes9x core 4.2.3

- Package: `@emulatorjs/core-snes9x@4.2.3`
- License: Snes9x personal/non-commercial-use license
- EmulatorJS source mirror: https://github.com/EmulatorJS/snes9x
- Upstream source and license: https://github.com/snes9xgit/snes9x

Snes9x permits personal, non-commercial use and requires its copyright/license notices to remain with copies and derived work. Commercial users must obtain permission from the Snes9x copyright holders. The core's license text and build metadata are embedded in the published compressed core data.

## Visual shader assets

The `src/retro/shaders/` effect source and preset files are original Massimo's Glitcher project code. They use EmulatorJS's documented `EJS_shaders` configuration and the documented Libretro GLSL shader-preset format; no third-party shader source or shader binary is included. The pinned EmulatorJS runtime and core binaries remain unmodified.

- EmulatorJS shader configuration: https://emulatorjs.org/docs/options
- Libretro GLSL shader format: https://docs.libretro.com/development/shader/glsl-shaders/

## ROM and trademark notice

Nintendo Entertainment System, Famicom, Super Nintendo Entertainment System, and Super Famicom are trademarks of their respective owners. This project is not affiliated with or endorsed by Nintendo, EmulatorJS, Libretro, FCEUmm, or Snes9x.

Users must supply their own legally usable ROM dumps or authorized homebrew. Nothing in this project grants rights to copyrighted game content.

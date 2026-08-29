import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import * as fs from 'fs';

if (!fs.existsSync('dist/electron')) {
  fs.mkdirSync('dist/electron', { recursive: true });
}


async function run() {
  console.log('1. Building Vite frontend...');
  await viteBuild();
  console.log('✂ Vite frontend built.');

  console.log('2. Bundling server.ts...');
  await esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vite', 'electron', 'fsevents'],
    sourcemap: true,
    outfile: 'dist/server.cjs'
  });
  console.log('✅ Server bundled.');

  console.log('3. Bundling Electron main and preload...');
  await esbuild.build({
    entryPoints: ['electron/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    outfile: 'dist/electron/main.cjs'
  });

  await esbuild.build({
    entryPoints: ['electron/preload.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    outfile: 'dist/electron/preload.cjs'
  });
  console.log('✅ Electron scripts compiled.');
  console.log('🎉 Ready for electron-builder packaging!');
}

run().catch((err) => {
  console.error('Electron build failed:', err);
  process.exit(1);
});

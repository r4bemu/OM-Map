import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';

async function run() {
  try {
    console.log('Building Vite frontend...');
    await viteBuild();
    console.log('✅ Vite frontend build completed.');
  } catch (vErr) {
    console.error('❌ Vite build error:', vErr);
    throw vErr;
  }

  try {
    console.log('Bundling server.ts with esbuild...');
    await esbuild.build({
      entryPoints: ['server.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      sourcemap: true,
      outfile: 'dist/server.cjs'
    });
    console.log('Build completed successfully.');
  } catch (sErr) {
    console.error('❌ Esbuild server build error:', sErr);
    throw sErr;
  }
}

run().catch(err => {
  console.error('Build failed:', err.message || err);
  process.exit(1);
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2023',
  // ponytail: el core queda duplicado dentro del bundle nestjs (~pocos KB). Si molesta,
  // marcar '../core' como external para que nestjs/index requiera el core hermano.
});

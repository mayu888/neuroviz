import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const tsNoDeclaration = typescript({ declaration: false, declarationMap: false });

export default [
  // 主 bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/bundle.umd.js',
        format: 'umd',
        name: 'neuroviz',
        sourcemap: true,
      },
      {
        file: 'dist/neuroviz.esm.js',
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      tsNoDeclaration,
      terser(),
    ]
  },

  // Worker bundles
  ...['gifti', 'mni-obj', 'freesurfer', 'overlay'].map((name) => ({
    input: `src/worker/${name}.worker.ts`,
    output: {
      file: `dist/${name}.worker.js`,
      format: 'iife',
      sourcemap: true,
    },
    plugins: [
      resolve({ preferBuiltins: false }),
      commonjs(),
      typescript({ declaration: false, declarationMap: false }),
      terser(),
    ],
  })),
];

const rollup = require('rollup');
const {babel} = require('@rollup/plugin-babel');
const {nodeResolve} = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');
const commonjs = require('@rollup/plugin-commonjs');
const {terser} = require('rollup-plugin-terser');

const entryFile = 'src/index.js';
let pkg = [
  {
    format: 'cjs',
    file: 'dist/index.js',
    exports: 'default',
  },
  // {
  //   format: 'es',
  //   file: 'dist/index.es.js',
  //   exports: 'auto',
  // },
  {
    format: 'iife',
    file: 'dist/index.global.js',
    globalName: 'createStorage',
    exports: 'default',
  },
];

pkg.forEach(item => {
  rollupFn(item);
});

function rollupFn(item) {

  const plugins = [
    commonjs(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
    }),
    nodeResolve(),
    terser({format: {comments: false}}),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ];
  rollup.rollup({
    input: entryFile,
    plugins,
  }).then(bundle => {
    const {format, globalName, file, exports} = item;
    const output = {
      format,
      file,
      exports,
    };
    if (globalName) {
      output.name = globalName;
    }
    bundle.write(output);
  }).catch(e => {
    console.log(e);
  });
}

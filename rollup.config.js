const typescript = require("@rollup/plugin-typescript");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");

module.exports = {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [
    typescript({ module: "ESNext", sourceMap: true }),
    json(),
    commonjs(),
    nodeResolve({ preferBuiltins: false }),
  ],
};

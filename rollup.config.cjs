const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const sourcemaps = require("rollup-plugin-sourcemaps");
const builtinModules = require("builtin-modules");

module.exports = [
{
   input: "tempBuild/browserApp/Main.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      nodeResolve()
   ]
}, {
   input: "tempBuild/nodeApp/Main.js",
   output: {
      file: "harmsyn.js",
      format: "cjs",
      banner: "#!/usr/bin/env node",
      sourcemap: "inline",
   },
   external: [
      ...builtinModules,
      ],
   plugins: [
      nodeResolve(),
      commonjs(),
      sourcemaps()
   ]
}];

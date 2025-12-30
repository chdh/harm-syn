const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const builtinModules = require("node:module").builtinModules;

module.exports = {
   input: "tempBuild/Main.js",
   output: {
      file: "harmsyn.js",
      format: "es",
      banner: "#!/usr/bin/env node"
   },
   external: [
      ...builtinModules ],
   plugins: [
      nodeResolve(),
      commonjs() ]};

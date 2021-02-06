import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import sourcemaps from 'rollup-plugin-sourcemaps';
import builtinModules from 'builtin-modules';

export default [
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

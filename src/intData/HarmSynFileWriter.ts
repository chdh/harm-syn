// Harmonic synthesizer file generator.

import {HarmSynDefRecord} from "./HarmSynDef";

const eol = "\r\n";

export function createHarmSynFile (harmSynDef: HarmSynDefRecord[], minAmplitudeDb: number) : string {
   let out = "";
   for (let p = 0; p < harmSynDef.length; p++) {
      const r = harmSynDef[p];
      if (!r) {
         continue; }
      const f0 = Math.round(r.f0 * 10) / 10;
      out += r.time.toFixed(6) + " " + buildSinSynComponentsString(f0, r.amplitudes, minAmplitudeDb) + eol; }
   return out; }

function buildSinSynComponentsString (f0: number, amplitudes: Float64Array, minAmplitudeDb: number) : string {
   if (!isFinite(f0) || amplitudes.length < 1) {
      return ""; }
   let s = "";
   for (let i = 1; i <= amplitudes.length; i++) {
      const a = amplitudes[i - 1];
      if (i == 1 || a >= minAmplitudeDb) {
         if (i == 1) {
            s += f0; }
          else {
            s += " *" + i; }
         s += "/" + Math.round(a * 10) / 10; }}
   return s; }

// Harmonic synthesizer file generator.
// Version for old file format.

import {HarmSynRecord} from "./HarmSynDef";

const eol = "\r\n";

export function createHarmSynFile (harmSynDef: HarmSynRecord[], minAmplitudeDb: number) : string {
   let out = "";
   const n = harmSynDef.length;
   for (let p = 0; p < n; p++) {
      const r = harmSynDef[p];
      if (!r) {
         continue; }
      const prevAmplitudes = (p > 0) ? harmSynDef[p].amplitudes : undefined;
      const nextAmplitudes = (p < n - 1) ? harmSynDef[p + 1].amplitudes : undefined;
      out += r.time.toFixed(6) + " " + buildSinSynComponentsString(r.f0, r.amplitudes, prevAmplitudes, nextAmplitudes, minAmplitudeDb) + eol; }
   return out; }

function buildSinSynComponentsString (f0: number, amplitudes: Float64Array, nextAmplitudes: Float64Array | undefined, prevAmplitudes: Float64Array | undefined, minAmplitudeDb: number) : string {
   if (!isFinite(f0) || amplitudes.length < 1) {
      return ""; }
   let s = f0.toFixed(2) + "/" + amplitudes[0].toFixed(2);
   for (let i = 2; i <= amplitudes.length; i++) {
      const a = amplitudes[i - 1];
      if (!isFinite(a)) {
         continue; }
      const prevA = prevAmplitudes?.[i - 1];
      const nextA = nextAmplitudes?.[i - 1];
      if (a < minAmplitudeDb &&
            (prevA === undefined || !isFinite(prevA) || prevA < minAmplitudeDb) &&
            (nextA === undefined || !isFinite(nextA) || nextA < minAmplitudeDb)) {
         continue; }
      s += " *" + i + "/" + a.toFixed(2); }
   return s; }

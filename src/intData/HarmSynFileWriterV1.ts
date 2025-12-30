// Harmonic synthesizer file generator.
// Version for V1 file format.

import {HarmSynRecord} from "./HarmSynIntData.ts";

const eol = "\r\n";

export function createHarmSynFile (harmSynDef: HarmSynRecord[], minRelevantAmplitude: number) : string {
   let out = "";
   const n = harmSynDef.length;
   for (let p = 0; p < n; p++) {
      const r = harmSynDef[p];
      if (!r) {
         continue; }
      const prevAmplitudes = (p > 0    ) ? harmSynDef[p - 1].amplitudes : undefined;
      const nextAmplitudes = (p < n - 1) ? harmSynDef[p + 1].amplitudes : undefined;
      const comp = buildSinSynComponentsString(r.f0, r.amplitudes, prevAmplitudes, nextAmplitudes, minRelevantAmplitude);
      if (!comp) {
         continue; }
      out += r.time.toFixed(6) + " " + comp + eol; }
   return out; }

function buildSinSynComponentsString (f0: number, amplitudes: Float64Array, nextAmplitudes: Float64Array | undefined, prevAmplitudes: Float64Array | undefined, minRelevantAmplitude: number) : string {
   if (!isFinite(f0) || amplitudes.length < 1) {
      return ""; }
   const a0 = amplitudes[0];
   const a0Clipped = Math.max(a0, minRelevantAmplitude);
   const s1 = f0.toFixed(2) + "/" + a0Clipped.toFixed(2);
   let s2 = "";
   for (let i = 2; i <= amplitudes.length; i++) {
      const a = amplitudes[i - 1];
      if (!isFinite(a)) {
         continue; }
      const prevA = prevAmplitudes?.[i - 1];
      const nextA = nextAmplitudes?.[i - 1];
      const prevUndef = prevA === undefined || !isFinite(prevA) || prevA < minRelevantAmplitude;
      const nextUndef = nextA === undefined || !isFinite(nextA) || nextA < minRelevantAmplitude;
      if (prevUndef && nextUndef) {
         continue; }
      const aClipped = Math.max(a, minRelevantAmplitude);
      s2 += " *" + i + "/" + aClipped.toFixed(2); }
   if (!s2 && a0 < minRelevantAmplitude) {
      return ""; }
   return s1 + s2; }

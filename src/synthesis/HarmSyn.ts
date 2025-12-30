// Harmonic synthesis main logic.

import {maxHarmonics, HarmSynDef} from "../intData/HarmSynIntData.ts";
import {decodeNumber} from "../Utils.ts";
import * as HarmSynSub from "./HarmSynSub.ts";

export interface SynParms {                                // synthesizer parameters
   interpolationMethod:      string;                       // Interpolation method ID for synthesis
   f0Multiplier:             number;                       // F0 multiplier. A multiplicative factor for the fundamental frequency.
   freqShift:                number;                       // Frequency shift [Hz]. Frequency shift for synthesizing the harmonics.
   harmonicMod:              ArrayLike<number>;            // dB values to amplify/attenuate harmonics
   outputSampleRate:         number; }                     // Output sample rate [Hz]

export const defaultSynParms: SynParms = {                 // default values for synthesizer parameters
   interpolationMethod:      "akima",
   f0Multiplier:             1,
   freqShift:                0,
   harmonicMod:              new Array(maxHarmonics).fill(0),
   outputSampleRate:         44100 };

// Decodes the harmonicMod string.
// It is used to enable/disable or amplify/attenuate individual harmonics.
// A '*' can be used to include all multiple harmonics.
// A '/' can be used to add an amplification (positive) or attenuation (negative) factor in dB.
// Examples:
// - Enable 2nd and 4th harmonic: "2 4"
// - Enable all even harmonics: "2*"
// - Attenuate 3th harmonic by 5dB: "1* 3/-5"
export function decodeHarmonicModString (s: string) : Float64Array {
   const a = new Float64Array(maxHarmonics);
   if (!s) {
      return a; }
   a.fill(-Infinity);
   let p = 0;
   while (true) {
      skipBlanks();
      if (p >= s.length) {
         break; }
      const harmonic = scanNumber();
      if (!Number.isInteger(harmonic) || harmonic < 1 || harmonic > maxHarmonics) {
         throw new Error("Invalid harmonic number " + harmonic + "."); }
      skipBlanks();
      let multi = false;
      if (s[p] == "*") {
         p++;
         multi = true; }
      skipBlanks();
      let amplitude = 0;
      if (s[p] == "/") {
         p++;
         skipBlanks();
         amplitude = scanNumber(); }
      if (multi) {
         for (let i = harmonic; i <= maxHarmonics; i += harmonic) {
            a[i - 1] = amplitude; }}
       else {
         a[harmonic - 1] = amplitude; }
      skipBlanks();
      if (s[p] == ",") {
         p++; }}
   return a;
   //
   function skipBlanks() {
      while (p < s.length && s[p] == " ") {
         p++; }}
   //
   function scanNumber() : number {
      const p0 = p;
      if (s[p] == "+" || s[p] == "-") {
         p++; }
      while (p < s.length) {
         const c = s[p];
         if (!(c >= "0" && c <= "9" || c == ".")) {
            break; }
         p++; }
      return decodeNumber(s.substring(p0, p)); }}

export function synthesizeHarmonicSignal (harmSynDef: HarmSynDef, synParms: SynParms) : Float64Array {
   const harmSynBase = HarmSynSub.prepare(harmSynDef, synParms.interpolationMethod, synParms.f0Multiplier, synParms.freqShift, synParms.harmonicMod);
   const outputSignal = HarmSynSub.synthesizeFromBase(harmSynBase, synParms.outputSampleRate);
   return outputSignal; }

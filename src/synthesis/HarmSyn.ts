// Harmonic synthesizer.

import {HarmSynRecord} from "../intData/HarmSynDef";
import {createInterpolator, InterpolationMethod} from "commons-math-interpolation";
import * as DspUtils from "dsp-collection/utils/DspUtils";

const PI2 = Math.PI * 2;

// Intermediate base data for the harmonic synthesizer.
export interface HarmSynBase {
   duration:                 number;                       // duration of the signal in seconds
   harmonics:                number;                       // number of harmonics
   f0Min:                    number;                       // minimum F0 value
   f0Max:                    number;                       // maximum F0 value
   f0Function:               (t: number) => number;        // interpolation function for the fundamental frequency
   amplitudeFunctions:       ((t: number) => number)[]; }  // interpolation functions for the harmonic amplitudes (in dB)

// @param harmonicMod
//    Harmonic modulation values in dB. -Infinity to suppress a harmonic. The values are added to the harmonic amplitudes (in dB).
export function prepare (harmSynDef: HarmSynRecord[], interpolationMethod: string, f0Multiplier: number, harmonicMod: number[]) : HarmSynBase {
   const base = <HarmSynBase>{};
   const n = harmSynDef.length;
   if (!n) {
      throw new Error("Empty harmonic synthesizer definition."); }
   base.duration = harmSynDef[n - 1].time;                 // the last time stamp is used as the duration
   const maxEnabledHarmonic = findMaxEnabledHarmonic(harmonicMod);
   base.harmonics = Math.max(...harmSynDef.map(r => Math.min(maxEnabledHarmonic, r.amplitudes.length)));
   const timeVals = new Float64Array(n);
   const f0Vals = new Float64Array(n);
   const amplitudeVals: Float64Array[] = new Array(base.harmonics);
   for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
      if (isFinite(harmonicMod[harmonic - 1])) {
         amplitudeVals[harmonic - 1] = new Float64Array(n); }}
   for (let i = 0; i < n; i++) {
      const r = harmSynDef[i];
      timeVals[i] = r.time;
      f0Vals[i] = r.f0 * f0Multiplier;
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         const mod = harmonicMod[harmonic - 1];
         if (isFinite(mod)) {
            const amplitude = (harmonic <= r.amplitudes.length) ? r.amplitudes[harmonic - 1] + mod : -Infinity;
            amplitudeVals[harmonic - 1][i] = amplitude; }}}
   base.f0Min = Math.min(...f0Vals);
   base.f0Max = Math.max(...f0Vals);
   base.f0Function = createConstrainedInterpolator(interpolationMethod, timeVals, f0Vals);
   base.amplitudeFunctions = Array(base.harmonics);
   for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
      if (isFinite(harmonicMod[harmonic - 1])) {
         base.amplitudeFunctions[harmonic - 1] = createConstrainedInterpolator(interpolationMethod, timeVals, amplitudeVals[harmonic - 1], -Infinity); }}
   return base; }

function findMaxEnabledHarmonic (harmonicMod: number[]) : number {
   let maxEnabledHarmonic = 0;
   for (let i = 0; i < harmonicMod.length; i++) {
      if (isFinite(harmonicMod[i])) {
         maxEnabledHarmonic = i + 1; }}
   return maxEnabledHarmonic; }

function createConstrainedInterpolator (interpolationMethod: string, xvals: Float64Array, yvals: Float64Array, outsideValue?: number) : (x: number) => number {
   const f = createInterpolatorWithFallbackForUndef(<any>interpolationMethod, xvals, yvals);
   const xMin = xvals[0];
   const xMax = xvals[xvals.length - 1];
   if (outsideValue === undefined) {
      return (x: number) => f(Math.max(xMin, Math.min(xMax, x))); }
    else {
      return (x: number) => (x >= xMin && x <= xMax) ? f(x) : outsideValue; }}

function createInterpolatorWithFallbackForUndef (interpolationMethod: InterpolationMethod, xvals: Float64Array, yvals: Float64Array) : (x: number) => number {
   const f = createInterpolator(interpolationMethod, xvals, yvals);
   switch (interpolationMethod) {
      case "akima": case "cubic": {
         const f2 = createInterpolator("linear", xvals, yvals);
         return (x: number) => {
            const y = f(x);
            return isFinite(y) ? y : f2(x); }; }
      default: {
         return f; }}}

export function synthesize (base: HarmSynBase, sampleRate: number) : Float64Array {
   const sampleCount = Math.round(base.duration * sampleRate);
   const samples = new Float64Array(sampleCount);
   let w = 0;                                              // angle of fundamental wave
   for (let position = 0; position < sampleCount; position++) {
      const time = position / sampleRate;
      const f0 = base.f0Function(time);
      let amplitude = 0;
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         const amplitudeFunction = base.amplitudeFunctions[harmonic - 1];
         if (!amplitudeFunction) {
            continue; }
         const harmonicAmplitudeDb = amplitudeFunction(time);
         if (isFinite(harmonicAmplitudeDb)) {
            const harmonicAmplitude = DspUtils.convertDbToAmplitude(harmonicAmplitudeDb);
            amplitude += harmonicAmplitude * Math.sin(w * harmonic); }}
      samples[position] = amplitude;
      const deltaW = PI2 * f0 / sampleRate;
      w += deltaW;
      if (w >= PI2) {
         w -= PI2; }}
   return samples; }

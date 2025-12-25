// Harmonic synthesis subroutines.

import {HarmSynDef, FunctionCurveDef} from "../intData/HarmSynIntData.js";
import {createInterpolator} from "commons-math-interpolation";
import * as DspUtils from "dsp-collection/utils/DspUtils";

const PI2 = Math.PI * 2;

// Intermediate base data for the harmonic synthesizer.
export interface HarmSynBase {
   duration:                 number;                       // duration of the signal in seconds
   harmonics:                number;                       // number of harmonics
   freqShift:                number;                       // final frequency shift for the harmonics [Hz]
   f0Min:                    number;                       // approximate minimum F0 value
   f0Max:                    number;                       // approximate maximum F0 value
   f0Function:               (t: number) => number;        // interpolation function for the fundamental frequency
   amplitudeFunctions:       ((t: number) => number)[]; }  // interpolation functions for the harmonic amplitudes (in dB)

// @param harmonicMod
//    Harmonic modulation values in dB. -Infinity to suppress a harmonic. The values are added to the harmonic amplitudes (in dB).
export function prepare (harmSynDef: HarmSynDef, interpolationMethod: string, f0Multiplier: number, freqShift: number, harmonicMod: ArrayLike<number>) : HarmSynBase {
   const f0Curve = applyF0Multiplier(harmSynDef.f0Curve, f0Multiplier);
   const amplitudeCurves = applyHarmonicMod(harmSynDef.amplitudeCurves, harmonicMod);
   const base = <HarmSynBase>{};
   if (!f0Curve.xVals.length) {
      throw new Error("Empty harmonic synthesizer definition."); }
   base.duration = f0Curve.xVals[f0Curve.xVals.length - 1];          // the last F0 time value is used as the duration
   base.harmonics = amplitudeCurves.length;
   base.freqShift = freqShift;
   base.f0Min = Math.min(...f0Curve.yVals);
   base.f0Max = Math.max(...f0Curve.yVals);
   base.f0Function = createConstrainedInterpolator(<any>interpolationMethod, f0Curve.xVals, f0Curve.yVals);
   base.amplitudeFunctions = new Array(base.harmonics);
   for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
      const ampCurve = amplitudeCurves[harmonic - 1];
      if (ampCurve?.xVals.length) {
         base.amplitudeFunctions[harmonic - 1] = createConstrainedInterpolator(<any>interpolationMethod, ampCurve.xVals, ampCurve.yVals, -Infinity); }}
   return base; }

function applyF0Multiplier (f0Curve0: FunctionCurveDef, f0Multiplier: number) : FunctionCurveDef {
   const yVals = f0Curve0.yVals.map(y => y * f0Multiplier);
   return {xVals: f0Curve0.xVals, yVals}; }

function applyHarmonicMod (amplitudeCurves0: FunctionCurveDef[], harmonicMod: ArrayLike<number>) : FunctionCurveDef[] {
   const maxEnabledHarmonic = findMaxEnabledHarmonic(harmonicMod);
   const harmonics = Math.min(maxEnabledHarmonic, amplitudeCurves0.length);
   const amplitudeCurves2 = new Array(harmonics);
   for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
      const mod = harmonicMod[harmonic - 1];
      const ampCurve0 = amplitudeCurves0[harmonic - 1];
      if (!isFinite(mod) || !ampCurve0) {
         continue; }
      const yVals = ampCurve0.yVals.map(y => y + mod);
      amplitudeCurves2[harmonic - 1] = {xVals: ampCurve0.xVals, yVals}; }
   return amplitudeCurves2; }

function findMaxEnabledHarmonic (harmonicMod: ArrayLike<number>) : number {
   let maxEnabledHarmonic = 0;
   for (let i = 0; i < harmonicMod.length; i++) {
      if (isFinite(harmonicMod[i])) {
         maxEnabledHarmonic = i + 1; }}
   return maxEnabledHarmonic; }

function createConstrainedInterpolator (interpolationMethod: string, xvals: Float64Array, yvals: Float64Array, outsideValue?: number) : (x: number) => number {
   const f = createInterpolator(<any>interpolationMethod, xvals, yvals);
   const xMin = xvals[0];
   const xMax = xvals[xvals.length - 1];
   if (outsideValue === undefined) {
      return (x: number) => f(Math.max(xMin, Math.min(xMax, x))); }
    else {
      return (x: number) => (x >= xMin && x <= xMax) ? f(x) : outsideValue; }}

export function synthesizeFromBase (base: HarmSynBase, sampleRate: number) : Float64Array {
   if (base.freqShift == 0) {
      return synthesizeFromBase_harmonic(base, sampleRate); }
    else {
      return synthesizeFromBase_withFreqShift(base, sampleRate); }}

// This is the normal harmonic case without a frequency shift.
function synthesizeFromBase_harmonic (base: HarmSynBase, sampleRate: number) : Float64Array {
   const sampleCount = Math.round(base.duration * sampleRate);
   const samples = new Float64Array(sampleCount);
   let w = 0;                                              // angle (phase) of fundamental wave
   for (let position = 0; position < sampleCount; position++) {
      const time = position / sampleRate;

      // Calculate amplitude at current position.
      let amplitude = 0;
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         amplitude += synthesizeComponentAmplitude(harmonic, time, w * harmonic, base); }
      samples[position] = amplitude;

      // Advance w.
      const f0 = base.f0Function(time);
      w = advanceW(w, f0, sampleRate); }

   return samples; }

// This is a non-harmonic synthesis with a common frequency shift for all the harmonic components.
function synthesizeFromBase_withFreqShift (base: HarmSynBase, sampleRate: number) : Float64Array {
   const sampleCount = Math.round(base.duration * sampleRate);
   const samples = new Float64Array(sampleCount);
   const wa = new Float64Array(base.harmonics);            // angles (phases) of wave components or -1
   for (let position = 0; position < sampleCount; position++) {
      const time = position / sampleRate;

      // Calculate amplitude at current position.
      let amplitude = 0;
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         amplitude += synthesizeComponentAmplitude(harmonic, time, wa[harmonic - 1], base); }
      samples[position] = amplitude;

      // Advance w for each component.
      const f0 = base.f0Function(time);
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         const f = f0 * harmonic + base.freqShift;
         wa[harmonic - 1] = advanceW(wa[harmonic - 1], f, sampleRate); }}

   return samples; }

function synthesizeComponentAmplitude (harmonic: number, time: number, w: number, base: HarmSynBase) : number {
   if (w <= 0) {                                           // handle special value -1 for mute
      return 0; }
   const amplitudeFunction = base.amplitudeFunctions[harmonic - 1];
   if (!amplitudeFunction) {
      return 0; }
   const harmonicAmplitudeDb = amplitudeFunction(time);
   if (!isFinite(harmonicAmplitudeDb) || harmonicAmplitudeDb < -99) {
      return 0; }
   const harmonicAmplitude = DspUtils.convertDbToAmplitude(harmonicAmplitudeDb);
   if (!isFinite(harmonicAmplitude)) {
      return 0; }
   return harmonicAmplitude * Math.sin(w); }

// Advances the angle (phase) of a sine component.
function advanceW (oldW: number, f: number, sampleRate: number) : number {
   if (f <= 0) {                                           // frequency can become negative when shifted
      return -1; }                                         // special value -1 for mute
   let w = Math.max(oldW, 0);
   const deltaW = PI2 * f / sampleRate;
   w += deltaW;
   if (w >= PI2) {
      w -= PI2; }
   return w; }

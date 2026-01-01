// HarmSyn Analysis main logic

import * as WindowFunctions from "dsp-collection/signal/WindowFunctions";
import * as DspUtils from "dsp-collection/utils/DspUtils";

import {HarmSynRecord} from "../intData/HarmSynIntData.ts";
import * as HarmTrack from "./HarmTrack.ts";
import {HarmonicTrackingInfo} from "./HarmTrack.ts";

const debugLevel = 0;
const fallbackStartFrequency = 250;

export interface AnalParmsPass1 {                          // analysis parameters for pass 1
   // Pass 1 parameters:
   startFrequency:           number | undefined;           // [Hz] Start value for the fundamental frequency F0. If not specified, pitch detection is used.
   startFrequencyMin:        number;                       // [Hz] Minimal value for automatic startFrequency
   startFrequencyMax:        number;                       // [Hz] Maximum value for automatic startFrequency
   trackingStartPos:         number | undefined;           // [s]  Start position for frequency tracking. Automatically determined if not specified. Tracking proceeds from this position in both directions.
   trackingStartLevel:       number;                       // [dB] Minimal signal level for automatically finding the start position for frequency tracking. Only used when trackingStartPos is not specified.
   trackingInterval:         number;                       // [s]  Tracking interval. Step size for the tracking algorithm.
   maxFrequencyDerivative:   number;                       // [/s] Maximum relative frequency derivative per second.
   minTrackingAmplitude:     number;                       // [dB] Minimum tracking amplitude. Harmonics with a lower amplitude are ignored for frequency tracking.
   harmonics:                number;                       //      Number of harmonic frequencies to track.
   fCutoff:                  number;                       // [Hz] Upper frequency limit for the harmonics.
   shiftFactor:              number;                       //      Shift factor, relative to the wavelength of the frequency. Used for measuring the phase delta.
   trackingRelWindowWidth:   number;                       //      Window width for frequency tracking, relative to F0 wavelength.
   trackingWindowFunctionId: string; }                     //      Window function for computing the instantaneous frequencies during tracking.

export interface AnalParms extends AnalParmsPass1 {        // analysis parameters for pass 1 and 2
   // Pass 2 parameters:
   interpolationInterval:    number;                       //      Interpolation interval as an integer multiple of the tracking interval.
   ampRelWindowWidth:        number;                       //      Window width relative to F0 wavelength for computing the harmonic amplitudes.
   ampWindowFunctionId:      string; }                     //      Window function for computing the harmonic amplitudes.

export const defaultAnalParmsPass1: AnalParmsPass1 = {     // default values for analysis parameters for pass 1
   // Pass 1 parameters:
   startFrequency:           undefined,
   startFrequencyMin:        75,
   startFrequencyMax:        900,
   trackingStartPos:         undefined,
   trackingStartLevel:       -22,
   trackingInterval:         0.001,                        // 1ms
   maxFrequencyDerivative:   4,
   minTrackingAmplitude:     -55,
   harmonics:                10,
   fCutoff:                  5500,
   shiftFactor:              0.25,
   trackingRelWindowWidth:   12,
   trackingWindowFunctionId: "flatTop" };

export const defaultAnalParms: AnalParms = {               // default values for analysis parameters
   ...defaultAnalParmsPass1,
   // Pass 2 parameters:
   interpolationInterval:     5,                           // 5 * trackingInterval = 5ms
   ampRelWindowWidth:         12,
   ampWindowFunctionId:       "flatTop" };

function determineStartFrequency (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParmsPass1, trackingStartPos: number) : number {
   if (analParms.startFrequency) {
      return analParms.startFrequency; }
   const f = HarmTrack.findTrackingStartFrequency(inputSignal, inputSampleRate, trackingStartPos, analParms.startFrequencyMin, analParms.startFrequencyMax);
   if (f) {
      if (debugLevel > 0) {
         console.log(`Auto-detected start frequency: ${f.toFixed(1)} Hz`); }
      return f; }
   console.log(`Start frequency could not be determined by pitch detection. Using ${fallbackStartFrequency} Hz.`);
   return fallbackStartFrequency; }

/**
* The first pass tracks the course of the fundamental frequency (F0) in the signal.
* It uses a small step width (`analParms.trackingInterval`, typically 1ms) and processes only the `analParms.harmonics` lowest harmonics.
* It returns an array of the F0 trace with additional info that can be used for debugging or understanding the tracking process.
**/
export function analyzeHarmonicSignal_pass1 (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParmsPass1) : HarmonicTrackingInfo[] {
   const trackingStartPos1 = HarmTrack.findTrackingStartPosition(inputSignal, inputSampleRate, analParms.trackingStartPos, analParms.trackingStartLevel,
         analParms.startFrequency, analParms.startFrequencyMin, analParms.trackingRelWindowWidth);
   const trackingStartPos = Math.ceil(trackingStartPos1 / analParms.trackingInterval - 1E-3) * analParms.trackingInterval;
   if (debugLevel >= 5) {
      console.log(`Tracking start position: ${trackingStartPos.toFixed(3)} s`); }
   const startFrequency = determineStartFrequency(inputSignal, inputSampleRate, analParms, trackingStartPos);
   const trackingIntervalInSamples = analParms.trackingInterval * inputSampleRate;
   const trackingPositions = Math.floor(inputSignal.length / trackingIntervalInSamples);
   const trackingstartPosInt = Math.round(trackingStartPos / analParms.trackingInterval);
   const trackingWindowFunction = WindowFunctions.getFunctionbyId(analParms.trackingWindowFunctionId, {tableCacheCostLimit: 1});
   const trackingInfos = HarmTrack.trackHarmonics(inputSignal, trackingIntervalInSamples, trackingPositions, trackingstartPosInt, startFrequency / inputSampleRate,
         analParms.maxFrequencyDerivative / inputSampleRate, DspUtils.convertDbToAmplitude(analParms.minTrackingAmplitude), analParms.harmonics,
         analParms.fCutoff / inputSampleRate, analParms.shiftFactor, analParms.trackingRelWindowWidth, trackingWindowFunction);
   return trackingInfos; }

/**
* The second pass uses the F0 trace from the first pass and computes the detailed varying amplitudes of the harmonics of the signal.
* It uses a larger step width than the first pass (`analParms.interpolationInterval', typicalla 5ms).
**/
export function analyzeHarmonicSignal_pass2 (inputSignal: Float64Array | Float32Array, inputSampleRate: number, trackingInfos: HarmonicTrackingInfo[], analParms: AnalParms) : HarmSynRecord[] {
   const ampWindowFunction = WindowFunctions.getFunctionbyId(analParms.ampWindowFunctionId, {tableCacheCostLimit: 1});
   const trackingIntervalInSamples = analParms.trackingInterval * inputSampleRate;
      // `analParms.trackingInterval` is a pass 1 parameter.
   const recs = HarmTrack.genHarmSynRecords(inputSignal, inputSampleRate, trackingInfos, trackingIntervalInSamples, analParms.interpolationInterval,
         analParms.fCutoff / inputSampleRate, analParms.ampRelWindowWidth, ampWindowFunction);
   return recs; }

/**
* This is the main function of this module. It returns the components of the harmonic signal into which it has been decomposed.
**/
export function analyzeHarmonicSignal (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParms) : HarmSynRecord[] {
   const trackingInfos = analyzeHarmonicSignal_pass1(inputSignal, inputSampleRate, analParms);
   const recs = analyzeHarmonicSignal_pass2(inputSignal, inputSampleRate, trackingInfos, analParms);
   return recs; }

/**
* This is a convenience function that can be used when only the fundamental frequency trace is required.
*
* @param f0ExtractionInterval
*    F0 extraction interval as an integer multiple of the tracking interval.
*    This parameter is essentially the same as `AnalParms.interpolationInterval`.
*    If e.g. the tracking interval is 1ms and the step width for F0 in the resulting array should be 5ms, this parameter would be 5.
* @return
*    An array of F0 values in Hz.
*    The value at array position `i` represents the frequency at time position `i * f0ExtractionInterval * trackingInterval`.
*/
export function getF0Trace (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParmsPass1, f0ExtractionInterval: number) : Float64Array {
   if (!Number.isSafeInteger(f0ExtractionInterval)) {
      throw new Error("f0ExtractionInterval is not an integer."); }
   const trackingInfos = analyzeHarmonicSignal_pass1(inputSignal, inputSampleRate, analParms);
   const n = Math.floor(trackingInfos.length / f0ExtractionInterval);
   const f0Vals = new Float64Array(n);
   for (let i = 0; i < n; i++) {
      const f0Norm = trackingInfos[i * f0ExtractionInterval].f0;
         // Here we could use an FIR LP filter instead of just picking up the center value.
      f0Vals[i] = f0Norm * inputSampleRate; }
   return f0Vals; }

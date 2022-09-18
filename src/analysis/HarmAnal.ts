// HarmSyn Analysis main logic

import {HarmSynRecord} from "../intData/HarmSynIntData.js";
import * as HarmTrack from "./HarmTrack.js";
import {debugLevel} from "../Utils.js";
import * as WindowFunctions from "dsp-collection/signal/WindowFunctions";
import * as DspUtils from "dsp-collection/utils/DspUtils";

const fallbackStartFrequency = 250;

export interface AnalParms {                               // analysis parameters
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
   trackingWindowFunctionId: string;                       //      Window function for computing the instantaneous frequencies during tracking.
   interpolationInterval:    number;                       //      Interpolation interval as a multiple of the tracking interval.
   ampRelWindowWidth:        number;                       //      Window width relative to F0 wavelength for computing the harmonic amplitudes.
   ampWindowFunctionId:      string; }                     //      Window function for computing the harmonic amplitudes.

export const defaultAnalParms: AnalParms = {               // default values for analysis parameters
   startFrequency:           undefined,
   startFrequencyMin:        75,
   startFrequencyMax:        900,
   trackingStartPos:         undefined,
   trackingStartLevel:       -22,
   trackingInterval:         0.001,
   maxFrequencyDerivative:   4,
   minTrackingAmplitude:     -55,
   harmonics:                10,
   fCutoff:                  5500,
   shiftFactor:              0.25,
   trackingRelWindowWidth:   12,
   trackingWindowFunctionId: "flatTop",
   interpolationInterval:     5,
   ampRelWindowWidth:         12,
   ampWindowFunctionId:       "flatTop" };

function determineStartFrequency (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParms, trackingStartPos: number) : number {
   if (analParms.startFrequency) {
      return analParms.startFrequency; }
   const f = HarmTrack.findTrackingStartFrequency(inputSignal, inputSampleRate, trackingStartPos, analParms.startFrequencyMin, analParms.startFrequencyMax);
   if (f) {
      if (debugLevel > 0) {
         console.log(`Auto-detected start frequency: ${f.toFixed(1)} Hz`); }
      return f; }
   console.log(`Start frequency could not be determined by pitch detection. Using ${fallbackStartFrequency} Hz.`);
   return fallbackStartFrequency; }

export function analyzeInputFile (inputSignal: Float64Array | Float32Array, inputSampleRate: number, analParms: AnalParms) : HarmSynRecord[] {
   const trackingStartPos1 = HarmTrack.findTrackingStartPosition(inputSignal, inputSampleRate, analParms.trackingStartPos, analParms.trackingStartLevel,
         analParms.startFrequency, analParms.startFrequencyMin, analParms.trackingRelWindowWidth);
   const trackingStartPos = Math.ceil(trackingStartPos1 / analParms.trackingInterval - 1E-3) * analParms.trackingInterval;
   if (debugLevel >= 5) {
      console.log(`Tracking start position: ${trackingStartPos.toFixed(3)} s`); }
   const startFrequency = determineStartFrequency(inputSignal, inputSampleRate, analParms, trackingStartPos);
   const trackingIntervalSamples = analParms.trackingInterval * inputSampleRate;
   const trackingPositions = Math.floor(inputSignal.length / trackingIntervalSamples);
   const trackingstartPosInt = Math.round(trackingStartPos / analParms.trackingInterval);
   const trackingWindowFunction = WindowFunctions.getFunctionbyId(analParms.trackingWindowFunctionId, {tableCacheCostLimit: 1});
   const trackingInfos = HarmTrack.trackHarmonics(inputSignal, trackingIntervalSamples, trackingPositions, trackingstartPosInt, startFrequency / inputSampleRate,
         analParms.maxFrequencyDerivative / inputSampleRate, DspUtils.convertDbToAmplitude(analParms.minTrackingAmplitude), analParms.harmonics,
         analParms.fCutoff / inputSampleRate, analParms.shiftFactor, analParms.trackingRelWindowWidth, trackingWindowFunction);
   const ampWindowFunction = WindowFunctions.getFunctionbyId(analParms.ampWindowFunctionId, {tableCacheCostLimit: 1});
   const harmSynDef = HarmTrack.genHarmSynRecords(inputSignal, inputSampleRate, trackingInfos, trackingIntervalSamples, analParms.interpolationInterval,
         analParms.fCutoff / inputSampleRate, analParms.ampRelWindowWidth, ampWindowFunction);
   return harmSynDef; }

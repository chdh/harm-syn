// Harmonic frequency tracking

import * as WindowFunctions from "dsp-collection/signal/WindowFunctions";
import * as AdaptiveStft from "dsp-collection/signal/AdaptiveStft";
import * as InstFreq from "dsp-collection/signal/InstFreq";
import * as PitchDetectionHarm from "dsp-collection/signal/PitchDetectionHarm";
import * as EnvelopeDetection from "dsp-collection/signal/EnvelopeDetection";
import * as DspUtils from "dsp-collection/utils/DspUtils";
import * as ArrayUtils from "dsp-collection/utils/ArrayUtils";

import {HarmSynRecord} from "../intData/HarmSynIntData.ts";
import * as Utils from "../Utils.ts";

export interface HarmonicTrackingInfo {                    // harmonic tracking info for a specific time position
   f0:                       number;                       // fundamental frequency [normalized]
   instF0:                   number;                       // instantaneous fundamental frequency [normalized]
   amplitudes:               Float64Array;                 // amplitudes of the harmonic frequency components [linear]
   overallAmplitude:         number; }                     // sum of the amplitudes of the harmonics [linear]

/**
* Tracks the F0 variations within a signal by following the instantaneous frequencies of the harmonics.
*
* @param samples
*    Signal samples.
* @param trackingInterval
*    Tracking interval [samples]. Step size for the tracking algorithm.
* @param trackingPositions
*    Number of positions at which the tracking is to be performed [trackingIntervals].
* @param trackingStartPos
*    Tracking start position [trackingIntervals].
*    Tracking proceeds from this position in both directions.
* @param f0Start
*    Start value for the fundamental frequency F0 [normalized].
* @param maxFrequencyDerivative
*    Maximum relative frequency derivative [normalized].
* @param minTrackingAmplitude
*    Minimum tracking amplitude [linear].
*    Harmonics with a lower amplitude are ignored.
* @param harmonics
*    Number of harmonic frequencies to track.
* @param fCutoff
*    Upper frequency limit for the harmonics [normalized].
* @param shiftFactor
*    Shift factor, relative to the wavelength of the frequency. Used for measuring the phase delta.
* @param trackingRelWindowWidth
*    Window width relative to F0 wavelength.
* @param trackingWindowFunction
*    Window function for computing the instantaneous frequencies.
* @return
*    Tracked F0 values and additional info.
*/
export function trackHarmonics (samples: Float64Array | Float32Array, trackingInterval: number, trackingPositions: number,
      trackingStartPos: number, f0Start: number, maxFrequencyDerivative: number, minTrackingAmplitude: number, harmonics: number, fCutoff: number,
      shiftFactor: number, trackingRelWindowWidth: number, trackingWindowFunction: WindowFunctions.WindowFunction | undefined) : HarmonicTrackingInfo[] {
   const buf: HarmonicTrackingInfo[] = new Array(trackingPositions);
   for (let pass = 1; pass <= 2; pass++) {
      const direction = (pass == 1) ? 1 : -1;                                  // pass 1 is forward, pass 2 is backward
      let f0Current = f0Start;
      let p = trackingStartPos;                                                // position `trackingStartPos` is computed twice (once per pass)
      while (p >= 0 && p < trackingPositions) {
         const position = p * trackingInterval;
         const maxDiff = maxFrequencyDerivative * trackingInterval * f0Current;
         const tInfo = <HarmonicTrackingInfo>{};
         tInfo.amplitudes = new Float64Array(harmonics);
         tInfo.amplitudes.fill(NaN);
         let amplitudeSum = 0;
         let weightedInstF0Sum = 0;
         let weightedCorrSum = 0;
         for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
            const harmonicFrequency = f0Current * harmonic;
            if (harmonicFrequency >= fCutoff) {
               continue; }
            const r = InstFreq.instFreqSingle_relWindow(samples, position, harmonicFrequency, shiftFactor, trackingRelWindowWidth * harmonic, trackingWindowFunction);
            if (!r) {
               continue; }
            tInfo.amplitudes[harmonic - 1] = r.amplitude;
            if (r.amplitude < minTrackingAmplitude) {
               continue; }
            const diff = (r.instFrequency - harmonicFrequency) / harmonic;
            const corr = Math.max(-maxDiff, Math.min(maxDiff, diff));
            amplitudeSum += r.amplitude;
            weightedInstF0Sum += r.instFrequency / harmonic * r.amplitude;
            weightedCorrSum += corr * r.amplitude; }
         const corrSum = amplitudeSum ? weightedCorrSum / amplitudeSum : 0;
         f0Current += corrSum;
         tInfo.f0 = f0Current;
         tInfo.instF0 = amplitudeSum ? weightedInstF0Sum / amplitudeSum : NaN;
         tInfo.overallAmplitude = amplitudeSum ? amplitudeSum : NaN;
         buf[p] = tInfo;
         p += direction; }}
   return buf; }

/**
* Uses the F0 values determined by the harmonic tracking to measure the amplitudes of the harmonics
* at each position. Generates the input data for the HarmSyn synthesizer.
*
* @param samples
*    Signal samples.
* @param sampleRate
*    Sample rate [Hz].
* @param trackingInfos
*    Output of harmonic tracking.
* @param trackingInterval
*    Interval used for harmonic tracking [samples].
* @param interpolationInterval
*    Interpolation interval as a multiple of the tracking interval.
* @param fCutoff
*    Upper frequency limit for the harmonics [normalized].
* @param relWindowWidth
*    Window width relative to F0 wavelength for computing the harmonic amplitudes.
* @param windowFunction
*    Window function for computing the harmonic amplitudes.
*/
export function genHarmSynRecords (samples: Float64Array | Float32Array, sampleRate: number, trackingInfos: HarmonicTrackingInfo[], trackingInterval: number,
      interpolationInterval: number, fCutoff: number, relWindowWidth: number, windowFunction: WindowFunctions.WindowFunction | undefined) : HarmSynRecord[] {
   if (!Number.isSafeInteger(interpolationInterval)) {
      throw new Error("interpolationInterval is not an integer."); }
   const n = Math.floor(trackingInfos.length / interpolationInterval);
   const buf: HarmSynRecord[] = new Array(n);
   let bufP = 0;
   for (let p = 0; p < n; p++) {
      const position = p * interpolationInterval * trackingInterval;
      const tInfo = trackingInfos[p * interpolationInterval];
      if (!isFinite(tInfo.f0) || !tInfo.overallAmplitude) {
         continue; }
      const f0 = tInfo.f0;                                 // only f0 is used from the trackingInfos array
      const harmonics = Math.floor(fCutoff / f0);
      const amplitudes = AdaptiveStft.getHarmonicAmplitudes(samples, position, f0, harmonics, relWindowWidth, windowFunction);
      if (!amplitudes) {
         continue; }
      buf[bufP++] = {time: position / sampleRate, f0: f0 * sampleRate, amplitudes: Utils.convertAmplitudesToDb(amplitudes)}; }
   buf.length = bufP;
   return buf; }

/**
* Determines the start position for frequency tracking.
*
* @param samples
*    Signal samples.
* @param sampleRate
*    Sample rate [Hz].
* @param trackingStartPosSpec
*    Optional specified start position for frequency tracking [s].
*    May be adjusted.
* @param trackingStartLevel
*    Minimal signal level for automatically finding the start position for frequency tracking [dB].
*    Only used when `trackingStartPos` is undefined.
* @param startFrequencySpec
*    Optional specified start value for the fundamental frequency F0 [Hz].
* @param startFrequencyMin
*    Minimal value for automatic startFrequency [Hz].
* @param trackingRelWindowWidth
*    Window width for frequency tracking, relative to F0 wavelength.
* @returns
*    Start position for frequency tracking [s].
*/
export function findTrackingStartPosition (samples: ArrayLike<number>, sampleRate: number, trackingStartPosSpec: number | undefined, trackingStartLevel: number,
      startFrequencySpec: number | undefined, startFrequencyMin: number, trackingRelWindowWidth: number) : number {
   const signalLength = samples.length / sampleRate;                           // [s]

   let pitchMargin: number;                                                    // margin needed for pitch detection [s]
   if (startFrequencySpec === undefined) {
      const pitchParms = PitchDetectionHarm.getDefaultHarmonicSumParms();
      const pitchWindowWidth = (pitchParms.relWindowWidth + 0.1) / startFrequencyMin; // [s]
      pitchMargin = pitchWindowWidth / 2; }                                    // [s]
    else {
      pitchMargin = 0; }

   const minTrackingStartFreq = startFrequencySpec ?? startFrequencyMin;
   const trackingWindowWidth = (trackingRelWindowWidth + 0.1) / minTrackingStartFreq; // [s]
   const trackingMargin = trackingWindowWidth / 2;                             // margin needed for frequency tracking with instantaneous frequency computation [s]

   const margin = Math.max(pitchMargin, trackingMargin);                       // [s]
   if (2.1 * margin > signalLength) {
      return signalLength / 2; }                                               // signal is too short

   if (trackingStartPosSpec !== undefined) {
      return clip(trackingStartPosSpec); }

   const windowWidthDc = 0.250;                                                // [s]
   const windowWidthEnvelope = 0.075;                                          // [s]
   const envelope = EnvelopeDetection.generateSignalEnvelope(samples, Math.round(windowWidthDc * sampleRate), Math.round(windowWidthEnvelope * sampleRate));
      // It's not optimal to calculate the envelope over the whole signal, just to find the tracking start position, but the algorithm is fast.
   const minAmplitude = DspUtils.convertDbToAmplitude(trackingStartLevel);
   const pLevel = ArrayUtils.argGte(envelope, minAmplitude);
   if (isNaN(pLevel)) {
      const pMax = ArrayUtils.argMax(envelope);
      return clip(pMax / sampleRate); }

   return clip(pLevel / sampleRate + margin);

   function clip (p: number) {
      return Math.max(margin, Math.min(signalLength - margin, p)); }}

/**
* Tries to find a suitable start value for the fundamental frequency (F0) for the harmonic tracking.
*
* @param samples
*    Signal samples.
* @param sampleRate
*    Sample rate [Hz].
* @param probePos
*    Probe position [s].
* @param startFrequencyMin
*    Minimum F0 value [Hz].
* @param startFrequencyMax
*    Maximum F0 value [Hz].
* @returns
*    Frequency in Hz or NaN.
*/
export function findTrackingStartFrequency (samples: Float64Array | Float32Array, sampleRate: number, probePos: number, startFrequencyMin: number, startFrequencyMax: number) : number {
   return PitchDetectionHarm.estimatePitch_harmonicSum(samples, sampleRate, probePos, startFrequencyMin, startFrequencyMax); }

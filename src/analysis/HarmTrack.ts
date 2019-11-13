// Harmonic frequency tracking

import {HarmSynDefRecord} from "../intData/HarmSynDef";
import * as Utils from "../Utils";
import * as WindowFunctions from "dsp-collection/signal/WindowFunctions";
import * as AdaptiveStft from "dsp-collection/signal/AdaptiveStft";
import * as InstFreq from "dsp-collection/signal/InstFreq";
import * as PitchDetectionHarm from "dsp-collection/signal/PitchDetectionHarm";
import * as EnvelopeDetection from "dsp-collection/signal/EnvelopeDetection";
import * as DspUtils from "dsp-collection/utils/DspUtils";
import * as ArrayUtils from "dsp-collection/utils/ArrayUtils";

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
* @param startPosition
*    Position within the signal to start the tracking [samples].
* @param trackingInterval
*    Tracking interval [samples]. Step size for the tracking algorithm.
* @param trackingPositions
*    Number of positions at which the tracking is to be performed.
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
* @param relWindowWidth
*    Window width relative to F0 wavelength.
* @param windowFunction
*    Window function for computing the instantaneous frequencies.
* @return
*    Tracked F0 values and additional info.
*/
export function trackHarmonics (samples: Float64Array, startPosition: number, trackingInterval: number, trackingPositions: number,
      f0Start: number, maxFrequencyDerivative: number, minTrackingAmplitude: number, harmonics: number, fCutoff: number,
      shiftFactor: number, relWindowWidth: number, windowFunction: WindowFunctions.WindowFunction | undefined) : HarmonicTrackingInfo[] {
   const buf: HarmonicTrackingInfo[] = new Array(trackingPositions);
   let f0Current = f0Start;
   for (let p = 0; p < trackingPositions; p++) {
      const position = startPosition + p * trackingInterval;
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
         const r = InstFreq.instFreqSingle_relWindow(samples, position, harmonicFrequency, shiftFactor, relWindowWidth * harmonic, windowFunction);
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
      buf[p] = tInfo; }
   return buf; }

/**
* Tries to find a suitable start value for the fundamental frequency (F0) for the harmonic tracking.
*
* @param samples
*    Signal samples.
* @param sampleRate
*    Sample rate in Hz.
* @param segmentStart
*    First possible position to detect frequency [s].
* @param segmentEnd
*    Last possible position to detect frequency [s].
* @returns
*    Frequency in Hz or NaN.
*/
export function findTrackingStartFrequency (samples: Float64Array, sampleRate: number, segmentStart: number, segmentEnd: number) : number {
   const f0Min = 75;
   const f0Max = 900;
   const minPitchAmplitudeDb = -30;
   const minPitchAmplitude = DspUtils.convertDbToAmplitude(minPitchAmplitudeDb);
   const pitchParms = PitchDetectionHarm.getDefaultHarmonicSumParms();
   const pitchWindowWidth = (pitchParms.relWindowWidth + 0.1) / f0Min;
   const envStartPos = findEnvelopeStart(samples, sampleRate, segmentStart - pitchWindowWidth / 2, segmentEnd - pitchWindowWidth / 2, minPitchAmplitude);
   if (isNaN(envStartPos)) {
      return NaN; }
   const pitchPos = envStartPos + pitchWindowWidth / 2;
   return PitchDetectionHarm.estimatePitch_harmonicSum(samples, sampleRate, pitchPos, f0Min, f0Max); }

function findEnvelopeStart (samples: Float64Array, sampleRate: number, segmentStart: number, segmentEnd: number, minAmplitude: number) : number {
   const windowWidthDc = 0.200;
   const windowWidthEnvelope = 0.050;
   const envelope = EnvelopeDetection.generateSignalEnvelope(samples, Math.round(windowWidthDc * sampleRate), Math.round(windowWidthEnvelope * sampleRate));
      // It's not optimal to calculate the envelope over the whole signal, but the algorithm is fast.
   const segStartPos = Math.max(0, Math.ceil(segmentStart * sampleRate));
   const segEndPos = Math.min(samples.length * sampleRate, Math.floor(segmentEnd * sampleRate));
   const envelopeSeg = envelope.subarray(segStartPos, segEndPos);
   return (segStartPos + ArrayUtils.argGte(envelopeSeg, minAmplitude)) / sampleRate; }

/**
* Uses the F0 values determined by the harmonic tracking to measure the harmonics
* at each position. Generates the input data for the HarmSyn synthesizer.
*
* @param samples
*    Signal samples.
* @param sampleRate
*    Sample rate [Hz].
* @param trackingInfos
*    Output of harmonic tracking.
* @param startPosition
*    Start position of harmonic tracking [samples].
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
export function genHarmSynDefRecords (samples: Float64Array, sampleRate: number, trackingInfos: HarmonicTrackingInfo[], startPosition: number, trackingInterval: number,
      interpolationInterval: number, fCutoff: number, relWindowWidth: number, windowFunction: WindowFunctions.WindowFunction | undefined) : HarmSynDefRecord[] {
   const n = Math.floor(trackingInfos.length / interpolationInterval);
   const buf: HarmSynDefRecord[] = new Array(n);
   let bufP = 0;
   for (let p = 0; p < n; p++) {
      const position = startPosition + p * interpolationInterval * trackingInterval;
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

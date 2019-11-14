// Commandline parameters

import {SimpleError} from "../Utils";
import {maxHarmonics} from "../intData/HarmSynDef";
import * as Commander from "commander";

// Analysis parameters:
export var inputFileName:              string;
export var startFrequency:             number | undefined; // [Hz]
export var trackingInterval:           number;             // [ms]
export var maxFrequencyDerivative:     number;             // [/s]
export var minTrackingAmplitude:       number;             // [dB]
export var harmonics:                  number;
export var fCutoff:                    number;             // [Hz]
export var shiftFactor:                number;
export var relWindowWidth1:            number;
export var windowFunctionId1:          string;
export var interpolationInterval:      number;
export var relWindowWidth2:            number;
export var windowFunctionId2:          string;

// Synthesis parameters:
export var outputFileName:             string;
export var interpolationMethod:        string;
export var outputSampleRate:           number;
export var f0Multiplier:               number;
export var harmonicMod:                number[];

// General parameters:
export var debugLevel:          number;

function decodeNumber (s: string) : number {
  const x = Number(s);
  if (!isFinite(x) || !s) {
     throw new SimpleError("Invalid numeric argument value \"" + s + "\"."); }
  return x; }

function decodeInt (s: string) : number {
   const v = decodeNumber(s);
   if (!Number.isInteger(v)) {
     throw new SimpleError("Invalid integer argument value \"" + s + "\"."); }
   return v; }

function postProcessHelp (s0: string) : string {
   let s = s0;
   s = s.replace("Options:", "Analysis options:\n");
   s = s.replace("  --sampleRate", "\nSyntesis options:\n\n  --sampleRate");
   s = s.replace("  -d,", "\nGeneral options:\n\n  -d,");
   return s; }

export function init() {
   const cmd = new Commander.Command();
   const usage = "<inputFileName> <outputFileName>";
   const argsDescr = {
      inputFileName:
         "Name of the input file.\n" +
         "This can be a WAV audio file (*.wav) which will be analyzed, or a text file (*.txt) with HarmSyn intermediate data.",
      outputFileName:
         "Name of the output file.\n" +
         "This can be a WAV audio file (*.wav) into which the synthesized sound is written or a text file (*.txt) into which HarmSyn intermediate data is written." };
   const progDescr =
      "HarmSyn - Harmonic Synthesizer\n" +
      "An analysis and synthesis algorithm for quasi-periodic signals, e.g. vowels.\n" +
      "Online demo: http://www.source-code.biz/harmSyn\n" +
      "Source code: https://github.com/chdh/harm-syn";
   cmd.name("node harmsyn.js");
   cmd.description(progDescr, argsDescr);
   // Positional parameters:
   cmd.arguments(usage).action(
      (arg1: string, arg2: string, _command, extraArgs?: string[]) => {
         inputFileName = arg1;
         outputFileName = arg2;
         if (extraArgs) {
            throw new SimpleError("Extra parameters on command line: " + extraArgs.join(" ")); }});
   // Analysis options:
   cmd.option("--startFrequency <n>", "Start value for the fundamental frequency F0 [Hz]. If not specified, pitch detection is used.", decodeNumber);
   cmd.option("--trackingInterval <n>", "Tracking interval [ms]. Step size for the tracking algorithm.", decodeNumber, 1);
   cmd.option("--maxFrequencyDerivative <n>", "Maximum relative frequency derivative per second.", decodeNumber, 4);
   cmd.option("--minTrackingAmplitude <n>", "Minimum tracking amplitude [dB]. Harmonics with a lower amplitude are ignored.", decodeNumber, -55);
   cmd.option("--harmonics <n>", "Number of harmonic frequencies to track.", decodeInt, 10);
   cmd.option("--fCutoff <n>", "Upper frequency limit for the harmonics [Hz]", decodeNumber, 5500);
   cmd.option("--shiftFactor <n>", "Shift factor, relative to the wavelength of the frequency. Used for measuring the phase delta.", decodeNumber, 0.25);
   cmd.option("--relWindowWidth1 <n>", "Window width for tracking, relative to F0 wavelength.", decodeNumber, 12);
   cmd.option("--windowFunction1 <s>", "Window function for computing the instantaneous frequencies during tracking.", "flatTop");
   cmd.option("--interpolationInterval <n>", "Interpolation interval as a multiple of the tracking interval.", decodeInt, 5);
   cmd.option("--relWindowWidth2 <n>", "Window width relative to F0 wavelength for computing the harmonic amplitudes.", decodeNumber, 12);
   cmd.option("--windowFunction2 <s>", "Window function for computing the harmonic amplitudes.", "flatTop");
   // Synthesis options:
   cmd.option("--sampleRate <n>", "Output sample rate [Hz].", decodeNumber, 44100);
   cmd.option("--interpolationMethod <n>", "Interpolation method ID for synthesis.", "akima");
   cmd.option("--f0Multiplier <n>", "F0 multiplier. A multiplicative factor for the fundamental frequency.", decodeNumber, 1);
   cmd.option("--harmonicMod <s>",
      "Enable/disable or amplify/attenuate individual harmonics.\n" +
      "A '*' can be used to include all multiple harmonics.\n" +
      "A '/' can be used to add an amplification (positive) or attenuation (negative) factor in dB.\n" +
      "Examples:\n" +
      "Enable 2nd and 4th harmonic: \"2 4\"\n" +
      "Enable all even harmonics: \"2*\"\n" +
      "Attenuate 3th harmonic by 5dB: \"1* 3/-5\"");
   // General options:
   cmd.option("-d, --debugLevel <n>", "Debug level (0 to 9)", decodeNumber, 0);
   cmd.helpOption("-h, --help", "Displays this help.");
   //
   if (process.argv.length <= 2) {
      cmd.outputHelp(postProcessHelp);
      process.exit(1); }
   cmd.parse(process.argv);
   // Analysis options:
   startFrequency         = cmd.startFrequency;
   trackingInterval       = cmd.trackingInterval;
   maxFrequencyDerivative = cmd.maxFrequencyDerivative;
   minTrackingAmplitude   = cmd.minTrackingAmplitude;
   harmonics              = cmd.harmonics;
   fCutoff                = cmd.fCutoff;
   shiftFactor            = cmd.shiftFactor;
   relWindowWidth1        = cmd.relWindowWidth1;
   windowFunctionId1      = cmd.windowFunction1;
   interpolationInterval  = cmd.interpolationInterval;
   relWindowWidth2        = cmd.relWindowWidth2;
   windowFunctionId2      = cmd.windowFunction2;
   // Synthesis options:
   outputSampleRate       = cmd.sampleRate;
   interpolationMethod    = cmd.interpolationMethod;
   f0Multiplier           = cmd.f0Multiplier;
   harmonicMod            = decodeHarmonicModString(cmd.harmonicMod);
   // General options:
   debugLevel             = cmd.debugLevel; }

function decodeHarmonicModString (s: string) : number[] {
   const a = new Array(maxHarmonics);
   if (!s) {
      a.fill(0);
      return a; }
   a.fill(-Infinity);
   let p = 0;
   while (true) {
      skipBlanks();
      if (p >= s.length) {
         break; }
      const harmonic = scanNumber();
      if (!Number.isInteger(harmonic) || harmonic < 1 || harmonic > maxHarmonics) {
         throw new SimpleError("Invalid harmonic number " + harmonic + "."); }
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

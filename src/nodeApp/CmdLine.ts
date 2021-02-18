// Commandline parameters

import {SimpleError} from "../Utils";
import {maxHarmonics} from "../intData/HarmSynDef";
import * as Commander from "commander";

// Analysis parameters:
export var inputFileName:              string;
export var startFrequency:             number | undefined; // [Hz]
export var startFrequencyMin:          number;             // [Hz]
export var startFrequencyMax:          number;             // [Hz]
export var trackingStartPos:           number | undefined; // [s]
export var trackingStartLevel:         number;             // [dB]
export var trackingInterval:           number;             // [s]
export var maxFrequencyDerivative:     number;             // [/s]
export var minTrackingAmplitude:       number;             // [dB]
export var minRelevantAmplitude:       number;             // [dB]
export var harmonics:                  number;
export var fCutoff:                    number;             // [Hz]
export var shiftFactor:                number;
export var trackingRelWindowWidth:     number;
export var trackingWindowFunctionId:   string;
export var interpolationInterval:      number;
export var ampRelWindowWidth:          number;
export var ampWindowFunctionId:        string;

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

function displayHelp (cmd: Commander.Command) {
   const s = cmd.helpInformation();
   const s2 = postProcessHelp(s);
   process.stdout.write(s2); }

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
      (arg1: string, arg2: string) => {
         inputFileName = arg1;
         outputFileName = arg2; });
   cmd.allowExcessArguments(false);
   // Analysis options:
   cmd.option("--startFrequency <n>", "Start value for the fundamental frequency F0 [Hz]. If not specified, pitch detection is used.", decodeNumber);
   cmd.option("--startFrequencyMin <n>", "Minimal value for automatic startFrequency [Hz].", decodeNumber, 75);
   cmd.option("--startFrequencyMax <n>", "Maximum value for automatic startFrequency [Hz].", decodeNumber, 900);
   cmd.option("--trackingStartPos <n>", "Start position for frequency tracking [s]. Automatically determined if not specified. Tracking proceeds from this position in both directions.", decodeNumber);
   cmd.option("--trackingStartLevel <n>", "Minimal signal level for automatically finding the start position for frequency tracking [dB]. Only used when trackingStartPos is not specified.", decodeNumber, -22);
   cmd.option("--trackingInterval <n>", "Tracking interval [ms]. Step size for the tracking algorithm.", decodeNumber, 1);
   cmd.option("--maxFrequencyDerivative <n>", "Maximum relative frequency derivative per second.", decodeNumber, 4);
   cmd.option("--minTrackingAmplitude <n>", "Minimum tracking amplitude [dB]. Harmonics with a lower amplitude are ignored for frequency tracking.", decodeNumber, -55);
   cmd.option("--minRelevantAmplitude <n>", "Minimum relevant amplitude [dB]. Lower amplitude values are omitted in the text output file.", decodeNumber, -55);
   cmd.option("--harmonics <n>", "Number of harmonic frequencies to track.", decodeInt, 10);
   cmd.option("--fCutoff <n>", "Upper frequency limit for the harmonics [Hz]", decodeNumber, 5500);
   cmd.option("--shiftFactor <n>", "Shift factor, relative to the wavelength of the frequency. Used for measuring the phase delta.", decodeNumber, 0.25);
   cmd.option("--trackingRelWindowWidth <n>", "Window width for frequency tracking, relative to F0 wavelength.", decodeNumber, 12);
   cmd.option("--trackingWindowFunction <s>", "Window function for computing the instantaneous frequencies during tracking.", "flatTop");
   cmd.option("--interpolationInterval <n>", "Interpolation interval as a multiple of the tracking interval.", decodeInt, 5);
   cmd.option("--ampRelWindowWidth <n>", "Window width relative to F0 wavelength for computing the harmonic amplitudes.", decodeNumber, 12);
   cmd.option("--ampWindowFunction <s>", "Window function for computing the harmonic amplitudes.", "flatTop");
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
   cmd.option("-h, --help", "Displays this help.");
   cmd.helpOption(false);
   //
   const args = process.argv;
   if (args.length <= 2 || args[2] == "-h" || args[2] == "--help") {
      displayHelp(cmd);
      process.exit(1); }
   cmd.parse(args);
   const opts = cmd.opts();
   // Analysis options:
   startFrequency            = opts.startFrequency;
   startFrequencyMin         = opts.startFrequencyMin;
   startFrequencyMax         = opts.startFrequencyMax;
   trackingStartPos          = opts.trackingStartPos;
   trackingStartLevel        = opts.trackingStartLevel;
   trackingInterval          = opts.trackingInterval / 1000;
   maxFrequencyDerivative    = opts.maxFrequencyDerivative;
   minTrackingAmplitude      = opts.minTrackingAmplitude;
   minRelevantAmplitude      = opts.minRelevantAmplitude;
   harmonics                 = opts.harmonics;
   fCutoff                   = opts.fCutoff;
   shiftFactor               = opts.shiftFactor;
   trackingRelWindowWidth    = opts.trackingRelWindowWidth;
   trackingWindowFunctionId  = opts.trackingWindowFunction;
   interpolationInterval     = opts.interpolationInterval;
   ampRelWindowWidth         = opts.ampRelWindowWidth;
   ampWindowFunctionId       = opts.ampWindowFunction;
   // Synthesis options:
   outputSampleRate          = opts.sampleRate;
   interpolationMethod       = opts.interpolationMethod;
   f0Multiplier              = opts.f0Multiplier;
   harmonicMod               = decodeHarmonicModString(opts.harmonicMod);
   // General options:
   debugLevel                = opts.debugLevel; }

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

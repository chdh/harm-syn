// Commandline parameters

import * as Commander from "commander";

import * as HarmSyn from "harm-syn";
import {defaultAnalParms, defaultSynParms} from "harm-syn";

import {decodeNumber, decodeInt} from "./Utils.ts";

// Input file parameters:
export var inputFileName:              string;

// Output file parameters:
export var outputFileName:             string;
export var minRelevantAmplitude:       number;             // [dB]

// Analysis parameters:
export var analParms:                  HarmSyn.AnalParms;

// Synthesis parameters:
export var synParms:                   HarmSyn.SynParms;

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
   // Output file options:
   cmd.option("--minRelevantAmplitude <n>", "Minimum relevant amplitude [dB]. Lower amplitude values are omitted in the text output file.", decodeNumber, -70);
   // Analysis options:
   cmd.option("--startFrequency <n>", "Start value for the fundamental frequency F0 [Hz]. If not specified, pitch detection is used.", decodeNumber);
   cmd.option("--startFrequencyMin <n>", "Minimal value for automatic startFrequency [Hz].", decodeNumber, defaultAnalParms.startFrequencyMin);
   cmd.option("--startFrequencyMax <n>", "Maximum value for automatic startFrequency [Hz].", decodeNumber, defaultAnalParms.startFrequencyMax);
   cmd.option("--trackingStartPos <n>", "Start position for frequency tracking [s]. Automatically determined if not specified. Tracking proceeds from this position in both directions.", decodeNumber);
   cmd.option("--trackingStartLevel <n>", "Minimal signal level for automatically finding the start position for frequency tracking [dB]. Only used when trackingStartPos is not specified.", decodeNumber, defaultAnalParms.trackingStartLevel);
   cmd.option("--trackingInterval <n>", "Tracking interval [ms]. Step size for the tracking algorithm.", decodeNumber, defaultAnalParms.trackingInterval * 1000);
   cmd.option("--maxFrequencyDerivative <n>", "Maximum relative frequency derivative per second.", decodeNumber, defaultAnalParms.maxFrequencyDerivative);
   cmd.option("--minTrackingAmplitude <n>", "Minimum tracking amplitude [dB]. Harmonics with a lower amplitude are ignored for frequency tracking.", decodeNumber, defaultAnalParms.minTrackingAmplitude);
   cmd.option("--harmonics <n>", "Number of harmonic frequencies to track.", decodeInt, defaultAnalParms.harmonics);
   cmd.option("--fCutoff <n>", "Upper frequency limit for the harmonics [Hz]", decodeNumber, defaultAnalParms.fCutoff);
   cmd.option("--shiftFactor <n>", "Shift factor, relative to the wavelength of the frequency. Used for measuring the phase delta.", decodeNumber, defaultAnalParms.shiftFactor);
   cmd.option("--trackingRelWindowWidth <n>", "Window width for frequency tracking, relative to F0 wavelength.", decodeNumber, defaultAnalParms.trackingRelWindowWidth);
   cmd.option("--trackingWindowFunction <s>", "Window function for computing the instantaneous frequencies during tracking.", defaultAnalParms.trackingWindowFunctionId);
   cmd.option("--interpolationInterval <n>", "Interpolation interval as a multiple of the tracking interval.", decodeInt, defaultAnalParms.interpolationInterval);
   cmd.option("--ampRelWindowWidth <n>", "Window width relative to F0 wavelength for computing the harmonic amplitudes.", decodeNumber, defaultAnalParms.ampRelWindowWidth);
   cmd.option("--ampWindowFunction <s>", "Window function for computing the harmonic amplitudes.", defaultAnalParms.ampWindowFunctionId);
   // Synthesis options:
   cmd.option("--interpolationMethod <n>", "Interpolation method ID for synthesis.", defaultSynParms.interpolationMethod);
   cmd.option("--f0Multiplier <n>", "F0 multiplier. A multiplicative factor for the fundamental frequency.", decodeNumber, defaultSynParms.f0Multiplier);
   cmd.option("--freqShift <n>", "frequency shift [Hz]. Frequency shift for synthesizing the harmonics.", decodeNumber, defaultSynParms.freqShift);
   cmd.option("--harmonicMod <s>",
      "Enable/disable or amplify/attenuate individual harmonics.\n" +
      "A '*' can be used to include all multiple harmonics.\n" +
      "A '/' can be used to add an amplification (positive) or attenuation (negative) factor in dB.\n" +
      "Examples:\n" +
      "Enable 2nd and 4th harmonic: \"2 4\"\n" +
      "Enable all even harmonics: \"2*\"\n" +
      "Attenuate 3th harmonic by 5dB: \"1* 3/-5\"");
   cmd.option("--sampleRate <n>", "Output sample rate [Hz].", decodeNumber, defaultSynParms.outputSampleRate);
   // General options:
   cmd.option("-h, --help", "Displays this help.");
   cmd.helpOption(false);
   //
   const args = process.argv;
   if (args.length <= 2 || args[2] == "-h" || args[2] == "--help") {
      displayHelp(cmd);
      process.exit(1); }
   cmd.parse(args);
   const opts = cmd.opts();
   // Output file options:
   minRelevantAmplitude                = opts.minRelevantAmplitude;
   // Analysis options:
   analParms = <HarmSyn.AnalParms>{};
   analParms.startFrequency            = opts.startFrequency;
   analParms.startFrequencyMin         = opts.startFrequencyMin;
   analParms.startFrequencyMax         = opts.startFrequencyMax;
   analParms.trackingStartPos          = opts.trackingStartPos;
   analParms.trackingStartLevel        = opts.trackingStartLevel;
   analParms.trackingInterval          = opts.trackingInterval / 1000;
   analParms.maxFrequencyDerivative    = opts.maxFrequencyDerivative;
   analParms.minTrackingAmplitude      = opts.minTrackingAmplitude;
   analParms.harmonics                 = opts.harmonics;
   analParms.fCutoff                   = opts.fCutoff;
   analParms.shiftFactor               = opts.shiftFactor;
   analParms.trackingRelWindowWidth    = opts.trackingRelWindowWidth;
   analParms.trackingWindowFunctionId  = opts.trackingWindowFunction;
   analParms.interpolationInterval     = opts.interpolationInterval;
   analParms.ampRelWindowWidth         = opts.ampRelWindowWidth;
   analParms.ampWindowFunctionId       = opts.ampWindowFunction;
   // Synthesis options:
   synParms = <HarmSyn.SynParms>{};
   synParms.interpolationMethod        = opts.interpolationMethod;
   synParms.f0Multiplier               = opts.f0Multiplier;
   synParms.freqShift                  = opts.freqShift;
   synParms.harmonicMod                = HarmSyn.decodeHarmonicModString(opts.harmonicMod);
   synParms.outputSampleRate           = opts.sampleRate; }

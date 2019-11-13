// Main module for Node commandline mode.

import * as CmdLine from "./CmdLine";
import {SimpleError} from "../Utils";
import {HarmSynDefRecord} from "../intData/HarmSynDef";
import * as HarmSynFileReader from "../intData/HarmSynFileReader";
import * as HarmSynFileWriter from "../intData/HarmSynFileWriter";
import * as HarmTrack from "../analysis/HarmTrack";
import * as HarmSyn from "../synthesis/HarmSyn";
import * as Utils from "../Utils";
import * as Fs from "fs";
import * as DspUtils from "dsp-collection/utils/DspUtils";
import * as WindowFunctions from "dsp-collection/signal/WindowFunctions";
import * as SourceMapSupport from "source-map-support";
import * as WavFileEncoder from "wav-file-encoder";
import * as WavDecoder from "wav-decoder";

const fallbackStartFrequency = 250;

var inputSignal:             Float64Array;
var inputSampleRate:         number;
var startFrequency:          number;
var harmSynDef:              HarmSynDefRecord[];
var outputSignal:            Float64Array;

function readInputWavFile() {
   const buf = Fs.readFileSync(CmdLine.inputFileName);
   const audioData = WavDecoder.decode.sync(buf, {symetric: true});
   if (audioData.channelData.length > 1) {
      console.log("Warning: Only the first auto channel is used."); }
   inputSignal = new Float64Array(audioData.channelData[0]);
   inputSampleRate = audioData.sampleRate; }

function readInputTextFile() {
   const fileData = Fs.readFileSync(CmdLine.inputFileName, "utf8");
   harmSynDef = HarmSynFileReader.parseHarmSynFile(fileData); }

function determineStartFrequency() {
   if (CmdLine.startFrequency) {
      startFrequency = CmdLine.startFrequency;
      return; }
   const f = HarmTrack.findTrackingStartFrequency(inputSignal, inputSampleRate, 0, inputSignal.length / inputSampleRate);
   if (f) {
      startFrequency = f;
      if (CmdLine.debugLevel > 0) {
         console.log(`Auto-detected start frequency: ${startFrequency.toFixed(1)} Hz.`); }
      return; }
   startFrequency = fallbackStartFrequency;
   console.log(`Start frequency could not be determined by pitch detection. Using ${startFrequency} Hz.`); }

function analyzeInputFile() {
   determineStartFrequency();
   const trackingIntervalSamples = CmdLine.trackingInterval / 1000 * inputSampleRate;
   const trackingPositions = Math.floor(inputSignal.length / trackingIntervalSamples);
   const windowFunction1 = WindowFunctions.getFunctionbyId(CmdLine.windowFunctionId1, {tableCacheCostLimit: 1});
   const trackingInfos = HarmTrack.trackHarmonics(inputSignal, 0, trackingIntervalSamples, trackingPositions, startFrequency / inputSampleRate,
         CmdLine.maxFrequencyDerivative / inputSampleRate, DspUtils.convertDbToAmplitude(CmdLine.minTrackingAmplitude), CmdLine.harmonics,
         CmdLine.fCutoff / inputSampleRate, CmdLine.shiftFactor, CmdLine.relWindowWidth1, windowFunction1);
   const windowFunction2 = WindowFunctions.getFunctionbyId(CmdLine.windowFunctionId2, {tableCacheCostLimit: 1});
   harmSynDef = HarmTrack.genHarmSynDefRecords(inputSignal, inputSampleRate, trackingInfos, 0, trackingIntervalSamples, CmdLine.interpolationInterval, CmdLine.fCutoff / inputSampleRate, CmdLine.relWindowWidth2, windowFunction2); }

function synthesizeOutputFile() {
   const harmSynBase = HarmSyn.prepare(harmSynDef, CmdLine.interpolationMethod, CmdLine.f0Multiplier, CmdLine.harmonicMod);
   outputSignal = HarmSyn.synthesize(harmSynBase, CmdLine.outputSampleRate); }

function writeOutputWavFile() {
   const wavFileData = WavFileEncoder.encodeWavFile2([outputSignal], CmdLine.outputSampleRate, WavFileEncoder.WavFileType.float32);
   Fs.writeFileSync(CmdLine.outputFileName, Buffer.from(wavFileData)); }

function writeOutputTextFile() {
   const fileData = HarmSynFileWriter.createHarmSynFile(harmSynDef, -55);
   Fs.writeFileSync(CmdLine.outputFileName, fileData); }

function readInputFile() {
   const ext = Utils.getFileNameExtension(CmdLine.inputFileName);
   switch ((ext ?? "?").toLowerCase()) {
      case "wav": {
         readInputWavFile();
         analyzeInputFile();
         break; }
      case "txt": {
         readInputTextFile();
         break; }
      default: {
         throw new SimpleError("Unrecognized input file name extension."); }}}

function writeOutputFile() {
   const ext = Utils.getFileNameExtension(CmdLine.outputFileName);
   switch ((ext ?? "?").toLowerCase()) {
      case "wav": {
         synthesizeOutputFile();
         writeOutputWavFile();
         break; }
      case "txt": {
         writeOutputTextFile();
         break; }
      default: {
         throw new SimpleError("Unrecognized output file name extension."); }}}

function main2() {
   SourceMapSupport.install();
   CmdLine.init();
   readInputFile();
   writeOutputFile(); }

function main() {
   try {
      main2(); }
    catch (e) {
      if (e instanceof SimpleError) {
         console.log(e.message); }
       else {
         console.log("HarmSyn failed.", e); }
      process.exit(99); }
   process.exit(0); }

void main();

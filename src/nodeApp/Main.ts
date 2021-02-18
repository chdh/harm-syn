// Main module for Node commandline mode.

import * as CmdLine from "./CmdLine";
import {SimpleError} from "../Utils";
import {HarmSynRecord} from "../intData/HarmSynDef";
import * as HarmSynFileReader from "../intData/HarmSynFileReaderV1";
import * as HarmSynFileWriter from "../intData/HarmSynFileWriterV1";
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
var harmSynDef:              HarmSynRecord[];
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

function determineStartFrequency (trackingStartPos: number) : number {
   if (CmdLine.startFrequency) {
      return CmdLine.startFrequency; }
   const f = HarmTrack.findTrackingStartFrequency(inputSignal, inputSampleRate, trackingStartPos, CmdLine.startFrequencyMin, CmdLine.startFrequencyMax);
   if (f) {
      if (CmdLine.debugLevel > 0) {
         console.log(`Auto-detected start frequency: ${f.toFixed(1)} Hz`); }
      return f; }
   console.log(`Start frequency could not be determined by pitch detection. Using ${fallbackStartFrequency} Hz.`);
   return fallbackStartFrequency; }

function analyzeInputFile() {
   const trackingStartPos1 = HarmTrack.findTrackingStartPosition(inputSignal, inputSampleRate, CmdLine.trackingStartPos, CmdLine.trackingStartLevel,
         CmdLine.startFrequency, CmdLine.startFrequencyMin, CmdLine.trackingRelWindowWidth);
   const trackingStartPos = Math.ceil(trackingStartPos1 / CmdLine.trackingInterval - 1E-3) * CmdLine.trackingInterval;
   if (CmdLine.debugLevel >= 5) {
      console.log(`Tracking start position: ${trackingStartPos.toFixed(3)} s`); }
   const startFrequency = determineStartFrequency(trackingStartPos);
   const trackingIntervalSamples = CmdLine.trackingInterval * inputSampleRate;
   const trackingPositions = Math.floor(inputSignal.length / trackingIntervalSamples);
   const trackingstartPosInt = Math.round(trackingStartPos / CmdLine.trackingInterval);
   const trackingWindowFunction = WindowFunctions.getFunctionbyId(CmdLine.trackingWindowFunctionId, {tableCacheCostLimit: 1});
   const trackingInfos = HarmTrack.trackHarmonics(inputSignal, trackingIntervalSamples, trackingPositions, trackingstartPosInt, startFrequency / inputSampleRate,
         CmdLine.maxFrequencyDerivative / inputSampleRate, DspUtils.convertDbToAmplitude(CmdLine.minTrackingAmplitude), CmdLine.harmonics,
         CmdLine.fCutoff / inputSampleRate, CmdLine.shiftFactor, CmdLine.trackingRelWindowWidth, trackingWindowFunction);
   const ampWindowFunction = WindowFunctions.getFunctionbyId(CmdLine.ampWindowFunctionId, {tableCacheCostLimit: 1});
   harmSynDef = HarmTrack.genHarmSynRecords(inputSignal, inputSampleRate, trackingInfos, trackingIntervalSamples, CmdLine.interpolationInterval,
         CmdLine.fCutoff / inputSampleRate, CmdLine.ampRelWindowWidth, ampWindowFunction); }

function synthesizeOutputFile() {
   const harmSynBase = HarmSyn.prepare(harmSynDef, CmdLine.interpolationMethod, CmdLine.f0Multiplier, CmdLine.harmonicMod);
   outputSignal = HarmSyn.synthesize(harmSynBase, CmdLine.outputSampleRate); }

function writeOutputWavFile() {
   const wavFileData = WavFileEncoder.encodeWavFile2([outputSignal], CmdLine.outputSampleRate, WavFileEncoder.WavFileType.float32);
   Fs.writeFileSync(CmdLine.outputFileName, Buffer.from(wavFileData)); }

function writeOutputTextFile() {
   const fileData = HarmSynFileWriter.createHarmSynFile(harmSynDef, CmdLine.minRelevantAmplitude);
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

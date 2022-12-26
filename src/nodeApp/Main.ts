// Main module for Node commandline mode.

import * as CmdLine from "./CmdLine.js";
import {analParms, synParms} from "./CmdLine.js";
import {SimpleError} from "../Utils.js";
import {HarmSynRecord, HarmSynDef} from "../intData/HarmSynIntData.js";
import * as HarmSynIntData from "../intData/HarmSynIntData.js";
import * as HarmSynFileReader from "../intData/HarmSynFileReaderV1.js";
import * as HarmSynFileWriter from "../intData/HarmSynFileWriterV1.js";
import * as HarmAnal from "../analysis/HarmAnal.js";
import * as HarmSyn from "../synthesis/HarmSyn.js";
import * as Utils from "../Utils.js";
import * as Fs from "fs";
import * as WavFileEncoder from "wav-file-encoder";
import * as WavFileDecoder from "wav-file-decoder";

var inputSignal:             Float32Array;
var inputSampleRate:         number;
var harmSynRecs:             HarmSynRecord[];
var harmSynDef:              HarmSynDef;
var outputSignal:            Float64Array;

function readInputWavFile() {
   const buf = Fs.readFileSync(CmdLine.inputFileName);
   const audioData = WavFileDecoder.decodeWavFile(buf);
   if (audioData.channelData.length > 1) {
      console.log("Warning: Only the first auto channel is used."); }
   inputSignal = audioData.channelData[0];
   inputSampleRate = audioData.sampleRate; }

function readInputTextFile() {
   const fileData = Fs.readFileSync(CmdLine.inputFileName, "utf8");
   harmSynRecs = HarmSynFileReader.parseHarmSynFile(fileData); }

function writeOutputWavFile() {
   const wavFileData = WavFileEncoder.encodeWavFile2([outputSignal], synParms.outputSampleRate, WavFileEncoder.WavFileType.float32);
   Fs.writeFileSync(CmdLine.outputFileName, Buffer.from(wavFileData)); }

function writeOutputTextFile() {
   const fileData = HarmSynFileWriter.createHarmSynFile(harmSynRecs, CmdLine.minRelevantAmplitude);
   Fs.writeFileSync(CmdLine.outputFileName, fileData); }

function readInputFile() {
   const ext = Utils.getFileNameExtension(CmdLine.inputFileName);
   switch ((ext ?? "?").toLowerCase()) {
      case "wav": {
         readInputWavFile();
         harmSynRecs = HarmAnal.analyzeInputFile(inputSignal, inputSampleRate, analParms);
         break; }
      case "txt": {
         readInputTextFile();
         break; }
      default: {
         throw new SimpleError("Unrecognized input file name extension."); }}
   harmSynDef = HarmSynIntData.convertRecordsToDef(harmSynRecs); }

function writeOutputFile() {
   const ext = Utils.getFileNameExtension(CmdLine.outputFileName);
   switch ((ext ?? "?").toLowerCase()) {
      case "wav": {
         outputSignal = HarmSyn.synthesize(harmSynDef, synParms);
         writeOutputWavFile();
         break; }
      case "txt": {
         writeOutputTextFile();
         break; }
      default: {
         throw new SimpleError("Unrecognized output file name extension."); }}}

function main2() {
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

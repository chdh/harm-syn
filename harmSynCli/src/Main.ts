// Main module for Node commandline mode.

import * as Fs from "node:fs";
import * as WavFileEncoder from "wav-file-encoder";
import * as WavFileDecoder from "wav-file-decoder";
import * as HarmSyn from "harm-syn";
import * as HarmSynFileReader from "harm-syn/intData/HarmSynFileReaderV1";
import * as HarmSynFileWriter from "harm-syn/intData/HarmSynFileWriterV1";

import * as CmdLine from "./CmdLine.ts";
import {analParms, synParms} from "./CmdLine.ts";
import {SimpleError} from "./Utils.ts";
import * as Utils from "./Utils.ts";

var inputSignal:             Float32Array;
var inputSampleRate:         number;
var harmSynRecs:             HarmSyn.HarmSynRecord[];
var harmSynDef:              HarmSyn.HarmSynDef;
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
         harmSynRecs = HarmSyn.analyzeHarmonicSignal(inputSignal, inputSampleRate, analParms);
         break; }
      case "txt": {
         readInputTextFile();
         break; }
      default: {
         throw new SimpleError("Unrecognized input file name extension."); }}
   harmSynDef = HarmSyn.convertRecordsToDef(harmSynRecs); }

function writeOutputFile() {
   const ext = Utils.getFileNameExtension(CmdLine.outputFileName);
   switch ((ext ?? "?").toLowerCase()) {
      case "wav": {
         outputSignal = HarmSyn.synthesizeHarmonicSignal(harmSynDef, synParms);
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

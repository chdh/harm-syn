import * as HarmSynIntData from "../intData/HarmSynIntData.js";
import {HarmSynRecord, HarmSynDef} from "../intData/HarmSynIntData.js";
import * as HarmSynFileReader from "../intData/HarmSynFileReaderV1.js";
import * as HarmSynFileWriter from "../intData/HarmSynFileWriterV1";
import * as HarmSynSub from "../synthesis/HarmSynSub.js";
import {HarmSynBase} from "../synthesis/HarmSynSub.js";
import * as HarmAnal from "../analysis/HarmAnal.js";
import * as Utils from "../Utils.js";
import * as UtilsB from "./UtilsB.js";
import {catchError, waitForDisplayUpdate} from "./UtilsB.js";
import * as DomUtils from "./DomUtils.js";
import * as AudioUtils from "./AudioUtils.js";
import InternalAudioPlayer from "./InternalAudioPlayer.js";
import * as ParmProc from "./ParmProc.js";
import * as FunctionCurveViewer from "function-curve-viewer";
import * as WavFileEncoder from "wav-file-encoder";
import * as DialogMgr from "dialog-manager";

const defaultTextFileUrl = "testSound1.txt";

var audioPlayer:                       InternalAudioPlayer;

// GUI components:
var inputSignalViewerWidget:           FunctionCurveViewer.Widget;
var outputSignalViewerWidget:          FunctionCurveViewer.Widget;
var frequencyViewerWidget:             FunctionCurveViewer.Widget;
var amplitudesViewerWidget:            FunctionCurveViewer.Widget;
var amplOverFrequencyViewerWidget:     FunctionCurveViewer.Widget;

// Input signal:
var inputSignalValid:                  boolean = false;
var inputSignalSamples:                Float32Array;
var inputSignalSampleRate:             number;
var inputSignalFileName:               string;

// Intermediate data:
var harmSynDefValid:                   boolean = false;
var harmSynRecs:                       HarmSynRecord[];
var harmSynDef:                        HarmSynDef;
var intermediateFileName:              string;

// Output signal:
var outputSignalValid:                 boolean = false;
var outputSignalSamples:               Float64Array;
var outputSignalSampleRate:            number;
var outputSignalFileName:              string;

//------------------------------------------------------------------------------

function loadSignalViewer (widget: FunctionCurveViewer.Widget, signalSamples: ArrayLike<number>, sampleRate: number) {
   const viewerFunction = FunctionCurveViewer.createViewerFunctionForFloat64Array(signalSamples, sampleRate);
   const viewerState: Partial<FunctionCurveViewer.ViewerState> = {
      viewerFunction:  viewerFunction,
      xMin:            0,
      xMax:            signalSamples.length / sampleRate,
      yMin:            -1.2,
      yMax:            1.2,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      focusShield:     true };
   widget.setViewerState(viewerState); }

function loadFrequencyViewer (harmSynBase: HarmSynBase) {
   const viewerFunction = (t: number) => (t >= 0 && t < harmSynBase.duration) ? harmSynBase.f0Function(t) : undefined;
   const viewerState: Partial<FunctionCurveViewer.ViewerState> = {
      viewerFunction:  viewerFunction,
      xMin:            0,
      xMax:            harmSynBase.duration,
      yMin:            harmSynBase.f0Min / 1.1,
      yMax:            harmSynBase.f0Max * 1.1,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      focusShield:     true };
   frequencyViewerWidget.setViewerState(viewerState); }

function loadAmplitudesViewer (harmSynBase: HarmSynBase) {
   const viewerFunction = (time: number, _sampleWidth: number, channel: number) => {
      const amplitudeFunction = harmSynBase.amplitudeFunctions[channel];
      if (!amplitudeFunction) {
         return NaN; }
      return amplitudeFunction(time); };
   const viewerState: Partial<FunctionCurveViewer.ViewerState> = {
      viewerFunction:  viewerFunction,
      channels:        harmSynBase.harmonics,
      xMin:            0,
      xMax:            harmSynBase.duration,
      yMin:            -70,
      yMax:            0,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      yAxisUnit:       "dB",
      focusShield:     true };
   amplitudesViewerWidget.setViewerState(viewerState); }

function loadAmplOverFrequencyViewer (base: HarmSynBase) {
   const paintFunction = (pctx: FunctionCurveViewer.CustomPaintContext) => {
      const ctx = pctx.ctx;
      ctx.save();
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         const amplitudeFunction = base.amplitudeFunctions[harmonic - 1];
         if (!amplitudeFunction) {
            continue; }
         ctx.strokeStyle = pctx.curveColors[harmonic - 1] || "#666666";
         ctx.beginPath();
         for (let time = 0; time < base.duration; time += 0.001) {
            const frequency = base.f0Function(time) * harmonic;      // (possible speed-optimization: Compute F0 once for all harmonics)
            const amplitude = amplitudeFunction(time);
            if (!isFinite(amplitude)) {
               ctx.stroke();
               ctx.beginPath();
               continue; }
            ctx.lineTo(pctx.mapLogicalToCanvasXCoordinate(frequency), pctx.mapLogicalToCanvasYCoordinate(amplitude)); }
         ctx.stroke(); }
      ctx.restore(); };
   const viewerState: Partial<FunctionCurveViewer.ViewerState> = {
      xMin:            0,
      xMax:            Math.min(5500, base.f0Max * base.harmonics * 1.1),
      yMin:            -70,
      yMax:            0,
      xAxisUnit:       "Hz",
      yAxisUnit:       "dB",
      customPaintFunction: paintFunction,
      focusShield:     true };
   amplOverFrequencyViewerWidget.setViewerState(viewerState); }

function analyze() {
   const analParms = ParmProc.getUiAnalParms();
   const recs = HarmAnal.analyzeInputFile(inputSignalSamples, inputSignalSampleRate, analParms);
   setHarmSynRecs(recs, inputSignalFileName); }

function synthesize() {
   outputSignalValid = false;
   const synParms = ParmProc.getUiSynParms();
   const harmSynBase = HarmSynSub.prepare(harmSynDef, synParms.interpolationMethod, synParms.f0Multiplier, synParms.harmonicMod);
   loadFrequencyViewer(harmSynBase);
   loadAmplitudesViewer(harmSynBase);
   loadAmplOverFrequencyViewer(harmSynBase);
   outputSignalSamples = HarmSynSub.synthesizeFromBase(harmSynBase, synParms.outputSampleRate);
   outputSignalSampleRate = synParms.outputSampleRate;
   outputSignalFileName = intermediateFileName;
   outputSignalValid = true;
   loadSignalViewer(outputSignalViewerWidget, outputSignalSamples, outputSignalSampleRate); }

//--- Audio file i/o -----------------------------------------------------------

async function loadAudioFileData (fileData: ArrayBuffer, fileName: string) {
   const audioData = await AudioUtils.decodeAudioFileData(fileData);
   inputSignalSamples = audioData.channelData[0];          // only the first channel is used
   inputSignalSampleRate = audioData.sampleRate;
   inputSignalFileName = fileName;
   inputSignalValid = true;
   loadSignalViewer(inputSignalViewerWidget, inputSignalSamples, inputSignalSampleRate);
   harmSynDefValid = false;
   outputSignalValid = false;
   refreshButtons(); }

async function loadLocalAudioFile (file: File) {
   const fileData = await file.arrayBuffer();
   await loadAudioFileData(fileData, file.name); }

async function loadAudioFileFromUrl (url: string) {
   const fileData = await Utils.loadFileFromUrl(url);
   const fileName = url.substring(url.lastIndexOf("/") + 1);
   await loadAudioFileData(fileData, fileName); }

function loadAudioFileButton_click() {
   audioPlayer.stop();
   UtilsB.openFileOpenDialog((file: File) => catchError(loadLocalAudioFile, file)); }

async function saveWavFileButton_click() {
   audioPlayer.stop();
   if (!outputSignalValid) {
      await synthesizeButton_click(); }
   const wavFileData = WavFileEncoder.encodeWavFile2([outputSignalSamples], outputSignalSampleRate, WavFileEncoder.WavFileType.float32);
   const fileName = Utils.removeFileNameExtension(outputSignalFileName) + ".wav";
   UtilsB.openSaveAsDialog(wavFileData, fileName, "audio/wav", "wav", "WAV audio file"); }

//--- Text file i/o ------------------------------------------------------------

function setHarmSynRecs (recs: HarmSynRecord[], fileName: string) {
   harmSynRecs = recs;
   harmSynDef = HarmSynIntData.convertRecordsToDef(recs);
   harmSynDefValid = true;
   // DomUtils.setValue("inputFileName", fileName);
   intermediateFileName = fileName;
   const harmonics = harmSynDef.amplitudeCurves.length;
   ParmProc.renderHarmonicCheckboxes(harmonics); }

function processTextFileData (fileData: string, fileName: string) {
   const recs = HarmSynFileReader.parseHarmSynFile(fileData);
   setHarmSynRecs(recs, fileName);
   refreshButtons(); }

async function loadLocalTextFile (file: File) {
   harmSynDefValid = false;
   synParms_change();
   const fileData = await file.text();
   processTextFileData(fileData, file.name); }

async function loadTextFileFromUrl (url: string) {
   const fileData = await Utils.loadTextFileFromUrl(url);
   const fileName = url.substring(url.lastIndexOf("/") + 1);
   processTextFileData(fileData, fileName); }

function loadTextFileButton_click() {
   audioPlayer.stop();
   UtilsB.openFileOpenDialog((file: File) => catchError(loadLocalTextFile, file)); }

function saveTextFileButton_click() {
   const minRelevantAmplitude = DomUtils.getValueNum("minRelevantAmplitude");
   const fileData = HarmSynFileWriter.createHarmSynFile(harmSynRecs, minRelevantAmplitude);
   const fileName = Utils.removeFileNameExtension(intermediateFileName) + ".txt";
   UtilsB.openSaveAsDialog(fileData, fileName, "text/plain", "txt", "Text file"); }

//------------------------------------------------------------------------------

function refreshButtons() {
   const playButtonText = audioPlayer.isPlaying() ? "Stop" : "Play";
   DomUtils.enableElement("playInputButton", inputSignalValid);
   DomUtils.setText("playInputButton", playButtonText);
   DomUtils.enableElement("analyzeButton", inputSignalValid);
   DomUtils.enableElement("saveTextFileButton", harmSynDefValid);
   DomUtils.enableElement("synthesizeButton", harmSynDefValid);
   DomUtils.enableElement("playOutputButton", harmSynDefValid);
   DomUtils.setText("playOutputButton", playButtonText);
   DomUtils.enableElement("saveWavFileButton", harmSynDefValid); }

function synParms_change() {
   audioPlayer.stop();
   outputSignalValid = false;
   refreshButtons(); }

async function showProgressInfo() {
   DialogMgr.showProgressInfo({msgHtml: `<div class="progressInfoMsg">Processing...</div>`});
   await waitForDisplayUpdate(); }

async function analyzeButton_click() {
   audioPlayer.stop();
   try {
      await showProgressInfo();
      analyze();
      synthesize(); }
    finally {
      DialogMgr.closeProgressInfo(); }
   refreshButtons(); }

async function synthesizeButton_click() {
   audioPlayer.stop();
   try {
      await showProgressInfo();
      synthesize(); }
    finally {
      DialogMgr.closeProgressInfo(); }}

async function playInputButton_click() {
   if (audioPlayer.isPlaying()) {
      audioPlayer.stop();
      return; }
   await audioPlayer.playSamples(inputSignalSamples, inputSignalSampleRate); }

async function playOutputButton_click() {
   if (audioPlayer.isPlaying()) {
      audioPlayer.stop();
      return; }
   if (!outputSignalValid) {
      await synthesizeButton_click(); }
   await audioPlayer.playSamples(outputSignalSamples, outputSignalSampleRate); }

async function initWithAudioFile (audioFileUrl: string) {
   try {
      await showProgressInfo();
      await loadAudioFileFromUrl(audioFileUrl);
      analyze();
      synthesize(); }
    finally {
      DialogMgr.closeProgressInfo(); }
   refreshButtons(); }

async function initWithTextFile (textFileUrl: string) {
   try {
      await showProgressInfo();
      await loadTextFileFromUrl(textFileUrl);
      synthesize(); }
    finally {
      DialogMgr.closeProgressInfo(); }
   refreshButtons(); }

async function initParms() {
   const up = ParmProc.getUrlParms();
   ParmProc.setUiAnalParms(up.analParms);
   ParmProc.setUiSynParms(up.synParms);
   if (up.audioFileUrl) {
      await initWithAudioFile(up.audioFileUrl); }
    else {
      const defaultTextFileUrl2 = (window.location.protocol != "file:") ? defaultTextFileUrl : undefined;
      const textFileUrl = up.textFileUrl ?? defaultTextFileUrl2;
      if (textFileUrl) {
         await initWithTextFile(textFileUrl); }}}

async function startup2() {
   audioPlayer = new InternalAudioPlayer();
   audioPlayer.addEventListener("stateChange", refreshButtons);
   const inputSignalViewerCanvasElement       = <HTMLCanvasElement>document.getElementById("inputSignalViewer")!;
   const outputSignalViewerCanvasElement      = <HTMLCanvasElement>document.getElementById("outputSignalViewer")!;
   const frequencyViewerCanvasElement         = <HTMLCanvasElement>document.getElementById("frequencyViewer")!;
   const amplitudesViewerCanvasElement        = <HTMLCanvasElement>document.getElementById("amplitudesViewer")!;
   const amplOverFrequencyViewerCanvasElement = <HTMLCanvasElement>document.getElementById("amplOverFrequencyViewer")!;
   inputSignalViewerWidget       = new FunctionCurveViewer.Widget(inputSignalViewerCanvasElement);
   outputSignalViewerWidget      = new FunctionCurveViewer.Widget(outputSignalViewerCanvasElement);
   frequencyViewerWidget         = new FunctionCurveViewer.Widget(frequencyViewerCanvasElement);
   amplitudesViewerWidget        = new FunctionCurveViewer.Widget(amplitudesViewerCanvasElement);
   amplOverFrequencyViewerWidget = new FunctionCurveViewer.Widget(amplOverFrequencyViewerCanvasElement);
   UtilsB.synchronizeViewers([inputSignalViewerWidget, outputSignalViewerWidget, frequencyViewerWidget, amplitudesViewerWidget]);
   DomUtils.addClickEventListener("loadAudioFileButton", loadAudioFileButton_click);
   DomUtils.addClickEventListener("playInputButton", playInputButton_click);
   DomUtils.addClickEventListener("analyzeButton", analyzeButton_click);
   DomUtils.addClickEventListener("saveTextFileButton", saveTextFileButton_click);
   DomUtils.addClickEventListener("loadTextFileButton", loadTextFileButton_click);
   DomUtils.addClickEventListener("enableAllHarmonicsButton", () => {ParmProc.setHarmonicCheckboxes(true); synParms_change(); });
   DomUtils.addClickEventListener("disableAllHarmonicsButton", () => {ParmProc.setHarmonicCheckboxes(false); synParms_change(); });
   DomUtils.addChangeEventListener("synParms", synParms_change);
   DomUtils.addClickEventListener("synthesizeButton", synthesizeButton_click);
   DomUtils.addClickEventListener("playOutputButton", playOutputButton_click);
   DomUtils.addClickEventListener("saveWavFileButton", saveWavFileButton_click);
   ParmProc.populateWindowFunctionSelectElement("trackingWindowFunctionId");
   ParmProc.populateWindowFunctionSelectElement("ampWindowFunctionId");
   await initParms();
   refreshButtons(); }

async function startup() {
   try {
      await startup2(); }
    catch (e) {
      console.log(e);
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", <any>startup);

import {HarmSynDefRecord} from "../intData/HarmSynDef";
import * as HarmSynFileReader from "../intData/HarmSynFileReader";
import * as HarmSyn from "../synthesis/HarmSyn";
import {HarmSynBase} from "../synthesis/HarmSyn";
import * as Utils from "../Utils";
import * as UtilsB from "./UtilsB";
import * as DomUtils from "./DomUtils";
import InternalAudioPlayer from "./InternalAudioPlayer";
import * as FunctionCurveViewer from "function-curve-viewer";
import * as WavFileEncoder from "wav-file-encoder";

const defaultInputFileUrl = "testSound1.txt";

var audioContext:                      AudioContext;
var audioPlayer:                       InternalAudioPlayer;

// GUI components:
var synthesizeButtonElement:           HTMLButtonElement;
var playButtonElement:                 HTMLButtonElement;
var wavFileButtonElement:              HTMLButtonElement;
var signalViewerWidget:                FunctionCurveViewer.Widget | undefined;
var frequencyViewerWidget:             FunctionCurveViewer.Widget | undefined;
var amplitudesViewerWidget:            FunctionCurveViewer.Widget | undefined;
var amplitudesOverFrequencyViewerWidget: FunctionCurveViewer.Widget | undefined;

// Current input file data:
var harmSynDef:                        HarmSynDefRecord[] | undefined;
var harmonicCount:                     number;                       // number of harmonics oocuring in harmSynDef
var inputFileName:                     string;

// Current synthesized signal:
var signalSamples:                     Float64Array | undefined;
var signalSampleRate:                  number;
var signalFileName:                    string;

//------------------------------------------------------------------------------

function setSignalViewer() {
   if (signalViewerWidget) {
      signalViewerWidget.setConnected(false);
      signalViewerWidget = undefined; }
   const canvasElement = <HTMLCanvasElement>document.getElementById("signalViewer")!;
   signalViewerWidget = new FunctionCurveViewer.Widget(canvasElement);
   const viewerFunction = FunctionCurveViewer.createViewerFunctionForFloat64Array(signalSamples!, signalSampleRate);
   const viewerState : FunctionCurveViewer.ViewerState = {
      viewerFunction:  viewerFunction,
      xMin:            0,
      xMax:            signalSamples!.length / signalSampleRate,
      yMin:            -1.2,
      yMax:            1.2,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      focusShield:     true };
   signalViewerWidget.setViewerState(viewerState); }

function setFrequencyViewer (harmSynBase: HarmSynBase) {
   if (frequencyViewerWidget) {
      frequencyViewerWidget.setConnected(false);
      frequencyViewerWidget = undefined; }
   const canvasElement = <HTMLCanvasElement>document.getElementById("frequencyViewer")!;
   frequencyViewerWidget = new FunctionCurveViewer.Widget(canvasElement);
   const viewerState : FunctionCurveViewer.ViewerState = {
      viewerFunction:  harmSynBase.f0Function,
      xMin:            0,
      xMax:            harmSynBase.duration,
      yMin:            harmSynBase.f0Min / 1.1,
      yMax:            harmSynBase.f0Max * 1.1,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      focusShield:     true };
   frequencyViewerWidget.setViewerState(viewerState); }

function setAmplitudesViewer (harmSynBase: HarmSynBase) {
   if (amplitudesViewerWidget) {
      amplitudesViewerWidget.setConnected(false);
      amplitudesViewerWidget = undefined; }
   const canvasElement = <HTMLCanvasElement>document.getElementById("amplitudesViewer")!;
   amplitudesViewerWidget = new FunctionCurveViewer.Widget(canvasElement);
   const viewerFunction = (time: number, _sampleWidth: number, channel: number) => {
      const amplitudeFunction = harmSynBase.amplitudeFunctions[channel];
      if (!amplitudeFunction) {
         return NaN; }
      return amplitudeFunction(time); };
   const viewerState : FunctionCurveViewer.ViewerState = {
      viewerFunction:  viewerFunction,
      channels:        harmSynBase.harmonics,
      xMin:            0,
      xMax:            harmSynBase.duration,
      yMin:            -60,
      yMax:            0,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x,
      xAxisUnit:       "s",
      yAxisUnit:       "dB",
      focusShield:     true };
   amplitudesViewerWidget.setViewerState(viewerState); }

function setAmplitudesOverFrequencyViewer (base: HarmSynBase) {
   if (amplitudesOverFrequencyViewerWidget) {
      amplitudesOverFrequencyViewerWidget.setConnected(false);
      amplitudesOverFrequencyViewerWidget = undefined; }
   const canvasElement = <HTMLCanvasElement>document.getElementById("amplitudesOverFrequencyViewer")!;
   amplitudesOverFrequencyViewerWidget = new FunctionCurveViewer.Widget(canvasElement);
   const paintFunction = (pctx: FunctionCurveViewer.CustomPaintContext) => {
      const ctx = pctx.ctx;
      ctx.save();
      for (let harmonic = 1; harmonic <= base.harmonics; harmonic++) {
         ctx.strokeStyle = pctx.curveColors[harmonic - 1] || "#666666";
         ctx.beginPath();
         for (let time = 0; time < base.duration; time += 0.001) {
            const frequency = base.f0Function(time) * harmonic;      // (possible speed-optimization: Compute F0 once for all harmonics)
            const amplitudeFunction = base.amplitudeFunctions[harmonic - 1];
            const amplitude = amplitudeFunction ? amplitudeFunction(time) : NaN;
            if (!isFinite(amplitude)) {
               ctx.stroke();
               ctx.beginPath();
               continue; }
            ctx.lineTo(pctx.mapLogicalToCanvasXCoordinate(frequency), pctx.mapLogicalToCanvasYCoordinate(amplitude)); }
         ctx.stroke(); }
      ctx.restore(); };
   const viewerState : FunctionCurveViewer.ViewerState = {
      xMin:            0,
      xMax:            Math.min(5500, base.f0Max * base.harmonics * 1.1),
      yMin:            -80,
      yMax:            0,
      xAxisUnit:       "Hz",
      yAxisUnit:       "dB",
      customPaintFunction: paintFunction,
      focusShield:     true };
   amplitudesOverFrequencyViewerWidget.setViewerState(viewerState); }

function synthesize() {
   signalSamples = undefined;
   const sampleRate = DomUtils.getValueNum("sampleRate");
   const interpolationMethod = DomUtils.getValue("interpolationMethod");
   const harmonicMod = getHarmonicMod();
   const f0Multiplier = DomUtils.getValueNum("f0Multiplier");
   const harmSynBase = HarmSyn.prepare(harmSynDef!, interpolationMethod, f0Multiplier, harmonicMod);
   setFrequencyViewer(harmSynBase);
   setAmplitudesViewer(harmSynBase);
   setAmplitudesOverFrequencyViewer(harmSynBase);
   signalSamples = HarmSyn.synthesize(harmSynBase, sampleRate);
   signalSampleRate = sampleRate;
   signalFileName = inputFileName;
   setSignalViewer();
   UtilsB.synchronizeViewers([signalViewerWidget!, frequencyViewerWidget!, amplitudesViewerWidget!]); }

//--- Check boxes to enable/disable harmonics ----------------------------------

function getHarmonicMod() : number[] {
   const a: number[] = Array(harmonicCount);
   for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      a[harmonic - 1] = DomUtils.getChecked("harmonic-" + harmonic) ? 0 : -Infinity; }
   return a; }

function setHarmonicCheckboxes (newState: boolean) {
   const a = document.querySelectorAll("input.harmonic");
   for (const e of a) {
      (<HTMLInputElement>e).checked = newState; }}

function renderHarmonicCheckboxes() {
   const container = document.getElementById("harmonicCheckboxes")!;
   let html = "<div>";
   for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      let extraClass = "";
      if (harmonic > 1 && harmonic % 20 == 1) {
         html += "</div><div>"; }
       else if (harmonic > 1 && harmonic % 5 == 1) {
         extraClass = " harmonic-gap"; }
//    html += `<label class="harmonic${extraClass}" for="harmonic-${harmonic}">${harmonic}:</label><input class="harmonic" id="harmonic-${harmonic}" type="checkbox" checked>`; }
      html += `<input class="harmonic${extraClass}" id="harmonic-${harmonic}" type="checkbox" checked><label class="harmonic" for="harmonic-${harmonic}">${harmonic}</label>`; }
   html += "</div>";
   container.innerHTML = html; }

//--- Input file handling ------------------------------------------------------

function processInputFileData (fileData: string, fileName: string) {
   harmSynDef = HarmSynFileReader.parseHarmSynFile(fileData);
   harmonicCount = Math.max(...harmSynDef.map(r => r.amplitudes.length));
   inputFileName = fileName;
   DomUtils.setValue("inputFileName", fileName);
   renderHarmonicCheckboxes();
   refreshButtons(); }

async function loadLocalInputFile (file: File) {
   try {
      harmSynDef = undefined;
      inputParms_change();
      const fileData = await UtilsB.loadTextFileData(file);
      processInputFileData(fileData, file.name); }
    catch (e) {
      alert("Error: " + e); }}

function loadInputFileButton_click() {
   UtilsB.openFileOpenDialog(loadLocalInputFile); }

async function loadTextFileByUrl (url: string) : Promise<string> {
   const response = await fetch(url, {mode: "cors"});   // (server must send "Access-Control-Allow-Origin" header field or have same origin)
   if (!response.ok) {
      throw new Error("Request failed for " + url); }
   return response.text(); }

async function loadInputFileFromUrl (url: string) {
   const fileData = await loadTextFileByUrl(url);
   const fileName = url.substring(url.lastIndexOf("/") + 1);
   processInputFileData(fileData, fileName); }

async function loadInitialInputFile() {
   try {
      const parmsString = window.location.hash.substring(1);
      const usp = new URLSearchParams(parmsString);
      const inputFileUrl = usp.get("file") || defaultInputFileUrl;
      await loadInputFileFromUrl(inputFileUrl); }
    catch (e) {
      if (window.location.protocol == "file:") {           // ignore error when running from local file system
         console.log("Unable to load initial input file.", e);
         return; }
      throw e; }}

//------------------------------------------------------------------------------

function refreshButtons() {
   const inputFileDataAvailable = !!harmSynDef;
   synthesizeButtonElement.disabled = !inputFileDataAvailable;
   playButtonElement.disabled = !inputFileDataAvailable;
   playButtonElement.textContent = audioPlayer.isPlaying() ? "Stop" : "Play";
   wavFileButtonElement.disabled = !inputFileDataAvailable; }

function inputParms_change() {
   audioPlayer.stop();
   signalSamples = undefined;
   refreshButtons(); }

function synthesizeButton_click() {
   audioPlayer.stop();
   synthesize();
   refreshButtons(); }

async function playButton_click() {
   if (audioPlayer.isPlaying()) {
      audioPlayer.stop();
      return; }
   if (!signalSamples) {
      synthesize(); }
   await audioPlayer.playSamples(signalSamples!, signalSampleRate); }

function wavFileButton_click() {
   audioPlayer.stop();
   if (!signalSamples) {
      synthesize(); }
   const buffer = UtilsB.createAudioBufferFromSamples(signalSamples!, signalSampleRate, audioContext);
   const wavFileData = WavFileEncoder.encodeWavFile(buffer, WavFileEncoder.WavFileType.float32);
   const blob = new Blob([wavFileData], {type: "audio/wav"});
   UtilsB.openSaveAsDialog(blob, Utils.removeFileNameExtension(signalFileName) + ".wav"); }

async function startup2() {
   audioContext = new ((<any>window).AudioContext || (<any>window).webkitAudioContext)();
   audioPlayer = new InternalAudioPlayer(audioContext);
   audioPlayer.addEventListener("stateChange", refreshButtons);
   document.getElementById("enableAllHarmonicsButton")!.addEventListener("click", () => {setHarmonicCheckboxes(true); inputParms_change(); });
   document.getElementById("disableAllHarmonicsButton")!.addEventListener("click", () => {setHarmonicCheckboxes(false); inputParms_change(); });
   document.getElementById("loadInputFileButton")!.addEventListener("click", loadInputFileButton_click);
   document.getElementById("inputParms")!.addEventListener("change", inputParms_change);
   synthesizeButtonElement = <HTMLButtonElement>document.getElementById("synthesizeButton")!;
   synthesizeButtonElement.addEventListener("click", () => UtilsB.catchError(synthesizeButton_click));
   playButtonElement = <HTMLButtonElement>document.getElementById("playButton")!;
   playButtonElement.addEventListener("click", () => UtilsB.catchError(playButton_click));
   wavFileButtonElement = <HTMLButtonElement>document.getElementById("wavFileButton")!;
   wavFileButtonElement.addEventListener("click", () => UtilsB.catchError(wavFileButton_click));
   refreshButtons();
   await loadInitialInputFile(); }

async function startup() {
   try {
      await startup2(); }
    catch (e) {
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", startup);

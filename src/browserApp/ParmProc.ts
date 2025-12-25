// Parameter processing routines

import * as DomUtils from "./DomUtils.js";
import {maxHarmonics} from "../intData/HarmSynIntData.js";
import {AnalParms, defaultAnalParms} from "../analysis/HarmAnal.js";
import {SynParms, defaultSynParms} from "../synthesis/HarmSyn.js";
import * as WindowFunctions from "dsp-collection/signal/WindowFunctions.js";

//--- UI parameters ------------------------------------------------------------

export function populateWindowFunctionSelectElement (selectElementId: string) {
   const selectElement = DomUtils.getSelectElement(selectElementId);
   for (const d of WindowFunctions.windowFunctionIndex) {
      selectElement.add(new Option(d.name, d.id)); }}

export function setUiAnalParms (p: AnalParms) {
   DomUtils.setValueNum("startFrequency",           p.startFrequency);
   DomUtils.setValueNum("startFrequencyMin",        p.startFrequencyMin);
   DomUtils.setValueNum("startFrequencyMax",        p.startFrequencyMax);
   DomUtils.setValueNum("trackingStartPos",         p.trackingStartPos);
   DomUtils.setValueNum("trackingStartLevel",       p.trackingStartLevel);
   DomUtils.setValueNum("trackingInterval",         p.trackingInterval * 1000);
   DomUtils.setValueNum("maxFrequencyDerivative",   p.maxFrequencyDerivative);
   DomUtils.setValueNum("minTrackingAmplitude",     p.minTrackingAmplitude);
   DomUtils.setValueNum("harmonics",                p.harmonics);
   DomUtils.setValueNum("fCutoff",                  p.fCutoff);
   DomUtils.setValueNum("shiftFactor",              p.shiftFactor);
   DomUtils.setValueNum("trackingRelWindowWidth",   p.trackingRelWindowWidth);
   DomUtils.setValue   ("trackingWindowFunctionId", p.trackingWindowFunctionId);
   DomUtils.setValueNum("interpolationInterval",    p.interpolationInterval);
   DomUtils.setValueNum("ampRelWindowWidth",        p.ampRelWindowWidth);
   DomUtils.setValue   ("ampWindowFunctionId",      p.ampWindowFunctionId); }

export function getUiAnalParms() : AnalParms {
   const p = <AnalParms>{};
   p.startFrequency           = DomUtils.getValueNumOpt("startFrequency");
   p.startFrequencyMin        = DomUtils.getValueNum   ("startFrequencyMin");
   p.startFrequencyMax        = DomUtils.getValueNum   ("startFrequencyMax");
   p.trackingStartPos         = DomUtils.getValueNumOpt("trackingStartPos");
   p.trackingStartLevel       = DomUtils.getValueNum   ("trackingStartLevel");
   p.trackingInterval         = DomUtils.getValueNum   ("trackingInterval") / 1000;
   p.maxFrequencyDerivative   = DomUtils.getValueNum   ("maxFrequencyDerivative");
   p.minTrackingAmplitude     = DomUtils.getValueNum   ("minTrackingAmplitude");
   p.harmonics                = DomUtils.getValueNum   ("harmonics");
   p.fCutoff                  = DomUtils.getValueNum   ("fCutoff");
   p.shiftFactor              = DomUtils.getValueNum   ("shiftFactor");
   p.trackingRelWindowWidth   = DomUtils.getValueNum   ("trackingRelWindowWidth");
   p.trackingWindowFunctionId = DomUtils.getValue      ("trackingWindowFunctionId");
   p.interpolationInterval    = DomUtils.getValueNum   ("interpolationInterval");
   p.ampRelWindowWidth        = DomUtils.getValueNum   ("ampRelWindowWidth");
   p.ampWindowFunctionId      = DomUtils.getValue      ("ampWindowFunctionId");
   return p; }

export function setUiSynParms (p: SynParms) {
   DomUtils.setValue   ("interpolationMethod",      p.interpolationMethod);
   DomUtils.setValueNum("f0Multiplier",             p.f0Multiplier);
   DomUtils.setValueNum("freqShift",                p.freqShift);
   // (harmonicMod not yet implemented)
   DomUtils.setValueNum("outputSampleRate",         p.outputSampleRate); }

export function getUiSynParms() : SynParms {
   const p = <SynParms>{};
   p.interpolationMethod = DomUtils.getValue   ("interpolationMethod");
   p.f0Multiplier        = DomUtils.getValueNum("f0Multiplier");
   p.freqShift           = DomUtils.getValueNum("freqShift");
   p.harmonicMod         = getHarmonicMod();
   p.outputSampleRate    = DomUtils.getValueNum("outputSampleRate");
   return p; }

//--- Check boxes to enable/disable harmonics ----------------------------------

function getHarmonicMod() : Float64Array {
   const a = new Float64Array(maxHarmonics);
   a.fill(-Infinity);
   for (let harmonic = 1; harmonic <= maxHarmonics; harmonic++) {
      const id = "harmonic-" + harmonic;
      if (!DomUtils.elementExists(id)) {
         break; }
      a[harmonic - 1] = DomUtils.getChecked(id) ? 0 : -Infinity; }
   return a; }

export function setHarmonicCheckboxes (newState: boolean) {
   const a = document.querySelectorAll("input.harmonic");
   for (const e of a) {
      (<HTMLInputElement>e).checked = newState; }}

export function renderHarmonicCheckboxes (harmonicCount: number) {
   const container = document.getElementById("harmonicCheckboxes")!;
   let html = "<div>";
   for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      let extraClass = "";
      if (harmonic > 1 && harmonic % 15 == 1) {
         html += "</div><div>"; }
       else if (harmonic > 1 && harmonic % 5 == 1) {
         extraClass = " harmonic-gap"; }
      html += `<input class="harmonic${extraClass}" id="harmonic-${harmonic}" type="checkbox" checked><label class="harmonic" for="harmonic-${harmonic}">${harmonic}</label>`; }
   html += "</div>";
   container.innerHTML = html; }

//--- URL parameters -----------------------------------------------------------

function getNum (usp: URLSearchParams, parmName: string) : number | undefined {
   const s = usp.get(parmName);
   if (!s) {
      return undefined; }
   const v = Number(s);
   if (isNaN(v)) {
      throw new Error(`Invalid value "${s}" for numeric URL parameter "${parmName}".`); }
   return v; }

function getUrlAnalParms (usp: URLSearchParams) : AnalParms {
   const d = defaultAnalParms;
   const p = <AnalParms>{};
   p.startFrequency           = getNum(usp, "startFrequency")         ?? d.startFrequency;
   p.startFrequencyMin        = getNum(usp, "startFrequencyMin")      ?? d.startFrequencyMin;
   p.startFrequencyMax        = getNum(usp, "startFrequencyMax")      ?? d.startFrequencyMax;
   p.trackingStartPos         = getNum(usp, "trackingStartPos")       ?? d.trackingStartPos;
   p.trackingStartLevel       = getNum(usp, "trackingStartLevel")     ?? d.trackingStartLevel;
   p.trackingInterval         = getNum(usp, "trackingInterval")       ?? d.trackingInterval;
   p.maxFrequencyDerivative   = getNum(usp, "maxFrequencyDerivative") ?? d.maxFrequencyDerivative;
   p.minTrackingAmplitude     = getNum(usp, "minTrackingAmplitude")   ?? d.minTrackingAmplitude;
   p.harmonics                = getNum(usp, "harmonics")              ?? d.harmonics;
   p.fCutoff                  = getNum(usp, "fCutoff")                ?? d.fCutoff;
   p.shiftFactor              = getNum(usp, "shiftFactor")            ?? d.shiftFactor;
   p.trackingRelWindowWidth   = getNum(usp, "trackingRelWindowWidth") ?? d.trackingRelWindowWidth;
   p.trackingWindowFunctionId = usp.get("trackingWindowFunctionId")   ?? d.trackingWindowFunctionId;
   p.interpolationInterval    = getNum(usp, "interpolationInterval")  ?? d.interpolationInterval;
   p.ampRelWindowWidth        = getNum(usp, "ampRelWindowWidth")      ?? d.ampRelWindowWidth;
   p.ampWindowFunctionId      = usp.get("ampWindowFunctionId")        ?? d.ampWindowFunctionId;
   return p; }

function getUrlSynParms (usp: URLSearchParams) : SynParms {
   const d = defaultSynParms;
   const p = <SynParms>{};
   p.interpolationMethod      = usp.get("interpolationMethod")  ?? d.interpolationMethod;
   p.f0Multiplier             = getNum(usp, "f0Multiplier")     ?? d.f0Multiplier;
   p.freqShift                = getNum(usp, "freqShift")        ?? d.freqShift;
   p.harmonicMod              = /* not yet implemented */          d.harmonicMod;
   p.outputSampleRate         = getNum(usp, "outputSampleRate") ?? d.outputSampleRate;
   return p; }

export interface UrlParms {
   audioFileUrl?:            string;
   textFileUrl?:             string;
   analParms:                AnalParms;
   synParms:                 SynParms; }

export function getUrlParms() : UrlParms {
   const parmsString = window.location.hash.substring(1);
   const usp = new URLSearchParams(parmsString);
   const up = <UrlParms>{};
   up.audioFileUrl = usp.get("audioFile") ?? undefined;
   up.textFileUrl = usp.get("textFile") ?? undefined;
   up.analParms = getUrlAnalParms(usp);
   up.synParms = getUrlSynParms(usp);
   return up; }

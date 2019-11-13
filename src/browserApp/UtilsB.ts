// Browser-specific utilities.

import * as FunctionCurveViewer from "function-curve-viewer";

export function loadTextFileData (file: File) : Promise<string> {
   return new Promise<string>(executor);
   function executor (resolve: Function, reject: Function) {
      const fileReader = new FileReader();
      fileReader.addEventListener("loadend", () => resolve(fileReader.result));
      fileReader.addEventListener("error", () => reject(fileReader.error));
      fileReader.readAsText(file); }}

export function openFileOpenDialog (callback: (file: File) => void) {
   const element: HTMLInputElement = document.createElement("input");
   element.type = "file";
   element.addEventListener("change", () => {
      if (element.files && element.files.length == 1) {
         callback(element.files[0]); }});
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   (<any>document).dummyFileOpenElementHolder = element; } // to prevent garbage collection

export function openSaveAsDialog (blob: Blob, fileName: string) {
   const url = URL.createObjectURL(blob);
   const element = document.createElement("a");
   element.href = url;
   element.download = fileName;
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   setTimeout(() => URL.revokeObjectURL(url), 60000);
   (<any>document).dummySaveAsElementHolder = element; }   // to prevent garbage collection

export async function catchError (f: Function, ...args: any[]) {
   try {
      const r = f(...args);
      if (r instanceof Promise) {
         await r; }}
    catch (error) {
      console.log(error);
      alert("Error: " + error); }}

export function createAudioBufferFromSamples (samples: Float64Array, sampleRate: number, audioContext: AudioContext) : AudioBuffer {
   const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
   const data = buffer.getChannelData(0);
   for (let i = 0; i < samples.length; i++) {
      data[i] = samples[i]; }
   return buffer; }

// Synchronizes the X axis viewport between a group of function curve viewers.
export function synchronizeViewers (widgetGroup: FunctionCurveViewer.Widget[]) {
   for (const widget of widgetGroup) {
      widget.addEventListener("viewportchange", () => synchronize(widget)); }
   function synchronize (activeWidget: FunctionCurveViewer.Widget) {
      const state1 = activeWidget.getViewerState();
      for (const widget2 of widgetGroup) {
         if (widget2 == activeWidget) {
            continue; }
         const state2 = widget2.getViewerState();
         state2.xMin = state1.xMin;
         state2.xMax = state1.xMax;
         widget2.setViewerState(state2); }}}

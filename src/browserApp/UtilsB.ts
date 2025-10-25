// Browser-specific utilities.

import * as FunctionCurveViewer from "function-curve-viewer";

const dummyResolvedPromise = Promise.resolve();

export function nextTick (callback: () => void) {
   void dummyResolvedPromise.then(callback); }

export async function waitForDisplayUpdate() : Promise<void> {
   await waitForNextAnimationFrame();
   await waitForNextAnimationFrame(); }

function waitForNextAnimationFrame() : Promise<void> {
   return new Promise<void>((resolve: Function) => {
      window.requestAnimationFrame(() => resolve()); }); }

export function catchError (f: Function, ...args: any[]) {
   void catchErrorAsync(f, ...args); }

async function catchErrorAsync (f: Function, ...args: any[]) {
   try {
      const r = f(...args);
      if (r instanceof Promise) {
         await r; }}
    catch (error) {
      console.log(error);
      alert("Error: " + error); }}

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

//------------------------------------------------------------------------------

export function openFileOpenDialog (callback: (file: File) => void) {
   if ((<any>window).showOpenFilePicker) {
      openFileOpenDialog_new().then(callback, (e) => console.log(e)); }
    else {
      openFileOpenDialog_old(callback); }}

async function openFileOpenDialog_new() : Promise<File> {
   const pickerOpts = {};
   const fileHandle: FileSystemFileHandle = (await (<any>window).showOpenFilePicker(pickerOpts))[0];
   const file = await fileHandle.getFile();
   return file; }

function openFileOpenDialog_old (callback: (file: File) => void) {
   const element: HTMLInputElement = document.createElement("input");
   element.type = "file";
   element.addEventListener("change", () => {
      if (element.files?.length == 1) {
         callback(element.files[0]); }});
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   (<any>document).dummyFileOpenElementHolder = element; } // to prevent garbage collection

export function openSaveAsDialog (data: ArrayBuffer | string, fileName: string, mimeType: string, fileNameExtension: string, fileTypeDescription: string) {
   if ((<any>window).showSaveFilePicker) {
      catchError(openSaveAsDialog_new, data, fileName, mimeType, fileNameExtension, fileTypeDescription); }
    else {
      openSaveAsDialog_old(data, fileName, mimeType); }}

async function openSaveAsDialog_new (data: ArrayBuffer | string, fileName: string, mimeType: string, fileNameExtension: string, fileTypeDescription: string) {
   const fileTypeDef: any = {};
   fileTypeDef[mimeType] = ["." + fileNameExtension];
   const pickerOpts = {
      suggestedName: fileName,
      types: [{
         description: fileTypeDescription,
         accept: fileTypeDef }]};
   let fileHandle: FileSystemFileHandle;
   try {
      fileHandle = await (<any>window).showSaveFilePicker(pickerOpts); }
    catch (e) {
      if (e.name == "AbortError") {
         return; }
      throw e; }
   const stream /* : FileSystemWritableFileStream */ = await (<any>fileHandle).createWritable();
   await stream.write(data);
   await stream.close(); }

function openSaveAsDialog_old (data: ArrayBuffer | string, fileName: string, mimeType: string) {
   const blob = new Blob([data], {type: mimeType});
   const url = URL.createObjectURL(blob);
   const element = document.createElement("a");
   element.href = url;
   element.download = fileName;
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   setTimeout(() => URL.revokeObjectURL(url), 60000);
   (<any>document).dummySaveAsElementHolder = element; }   // to prevent garbage collection

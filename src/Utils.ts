import * as DspUtils from "dsp-collection/utils/DspUtils";

export class SimpleError extends Error {}

export function splitTextFileIntoLines (fileData: string) : string[] {
   return fileData.split(/\r?\n/); }

export function removeFileNameExtension (s: string) : string {
   const p = s.lastIndexOf(".");
   return (p > 0) ? s.substring(0, p) : s; }

export function getFileNameExtension (s: string) : string | undefined {
   const p = s.lastIndexOf(".");
   return (p > 0) ? s.substring(p + 1) : undefined; }

export function convertAmplitudesToDb (a: ArrayLike<number>) : Float64Array {
   const n = a.length;
   const a2 = new Float64Array(n);
   for (let p = 0; p < n; p++) {
      a2[p] = DspUtils.convertAmplitudeToDb(a[p]); }
   return a2; }

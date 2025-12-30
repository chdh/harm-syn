import * as DspUtils from "dsp-collection/utils/DspUtils";

export function splitTextFileIntoLines (fileData: string) : string[] {
   return fileData.split(/\r?\n/); }

export function convertAmplitudesToDb (a: ArrayLike<number>) : Float64Array {
   const n = a.length;
   const a2 = new Float64Array(n);
   for (let p = 0; p < n; p++) {
      a2[p] = DspUtils.convertAmplitudeToDb(a[p]); }
   return a2; }

export function decodeNumber (s: string) : number {
  const x = Number(s);
  if (!isFinite(x) || !s) {
     throw new Error("Invalid numeric value \"" + s + "\"."); }
  return x; }

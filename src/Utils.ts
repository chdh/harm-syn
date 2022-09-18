import * as DspUtils from "dsp-collection/utils/DspUtils";

export var debugLevel:       number = 0;

export class SimpleError extends Error {}

export function setDebugLevel (newDebugLevel: number) {
   debugLevel = newDebugLevel; }

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

export function decodeNumber (s: string) : number {
  const x = Number(s);
  if (!isFinite(x) || !s) {
     throw new SimpleError("Invalid numeric argument value \"" + s + "\"."); }
  return x; }

export function decodeInt (s: string) : number {
   const v = decodeNumber(s);
   if (!Number.isInteger(v)) {
     throw new SimpleError("Invalid integer argument value \"" + s + "\"."); }
   return v; }

export async function loadFileFromUrl (url: string) : Promise<ArrayBuffer> {
   const response = await fetch(url, {mode: "cors", credentials: "include"}); // (server must send "Access-Control-Allow-Origin" header field or have same origin)
   if (!response.ok) {
      throw new Error("Request failed for " + url); }
   return await response.arrayBuffer(); }

export async function loadTextFileFromUrl (url: string) : Promise<string> {
   const response = await fetch(url, {mode: "cors"});   // (server must send "Access-Control-Allow-Origin" header field or have same origin)
   if (!response.ok) {
      throw new Error("Request failed for " + url); }
   return await response.text(); }

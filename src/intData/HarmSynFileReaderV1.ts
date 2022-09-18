// Harmonic synthesizer file parser.
// Version for old file format.

import {HarmSynRecord, maxHarmonics} from "./HarmSynIntData.js";
import * as Utils from "../Utils";

function parseHarmSynFileLine (s: string) : HarmSynRecord | undefined {
   let p = 0;
   skipBlanks();
   if (p >= s.length || s[p] == ";" || s[p] == "*") {
      return; }
   const r = <HarmSynRecord>{};
   r.time = parseNumber();
   skipBlanks();
   r.f0 = parseNumber();
   if (s[p++] != "/") {
      throw new Error("'/' expected after F0."); }
   const f0Amplitude = parseNumber();
   const amplitudes = new Float64Array(maxHarmonics);
   amplitudes.fill(-Infinity);
   amplitudes[0] = f0Amplitude;
   let usedHarmonics = 1;
   while (true) {
      skipBlanks();
      if (p >= s.length) {
         break; }
      if (s[p++] != "*") {
         throw new Error("'*' expected."); }
      const harmonic = parseNumber();
      if (!Number.isInteger(harmonic) || harmonic <= 1 || harmonic > maxHarmonics) {
         throw new Error("Invalid harmonic multiplier " + harmonic + "."); }
      if (s[p++] != "/") {
         throw new Error("'/' expected after frequency multiplier."); }
      const amplitude = parseNumber();
      amplitudes[harmonic - 1] = amplitude;
      usedHarmonics = Math.max(usedHarmonics, harmonic); }
   r.amplitudes = amplitudes.subarray(0, usedHarmonics);
   return r;
   //
   function skipBlanks() {
      while (p < s.length && s[p] == " ") {
         p++; }}
   //
   function parseNumber() : number {
      const p0 = p;
      if (s[p] == "+" || s[p] == "-") {
         p++; }
      while (p < s.length) {
         const c = s[p];
         if (!(c >= "0" && c <= "9" || c == ".")) {
            break; }
         p++; }
      const x = decodeNumber(s.substring(p0, p));
      if (!isFinite(x)) {
         throw new Error("Syntax error. Number expected at position " + (p0 + 1) + "."); }
      return x; }}

function decodeNumber (s: string) : number {
   if (!s) {
      return NaN; }
   return Number(s); }

export function parseHarmSynFile (fileData: string) : HarmSynRecord[] {
   const harmSynDef: HarmSynRecord[] = [];
   const fileLines = Utils.splitTextFileIntoLines(fileData);
   for (let lineNo = 1; lineNo <= fileLines.length; lineNo++) {
      let r: HarmSynRecord | undefined;
      try {
         r = parseHarmSynFileLine(fileLines[lineNo - 1]); }
       catch (e) {
         throw new Error("Error while parsing line " + lineNo + ": " + e); }
      if (r) {
         harmSynDef.push(r); }}
   return harmSynDef; }

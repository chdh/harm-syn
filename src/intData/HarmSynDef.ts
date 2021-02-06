// Intermediate data definition.

export const maxHarmonics = 100;

export interface FunctionCurveDef {
   xVals:                    Float64Array;                 // x-values (time in seconds)
   yVals:                    Float64Array; }               // y-values (frequency or amplitude)

export interface HarmSynDef {
   f0Curve:                  FunctionCurveDef;             // fundamental frequency [Hz]
   amplitudeCurves:          FunctionCurveDef[]; }         // amplitudes of the harmonic frequency components [dB]

// Contains the F0 and amplitude values for a specific point in time.
export interface HarmSynRecord {
   time:                     number;                       // time position [s]
   f0:                       number;                       // fundamental frequency [Hz]
   amplitudes:               Float64Array; }               // amplitudes of the harmonic frequency components [dB]

export function convertRecordsToDef (recs: HarmSynRecord[]) : HarmSynDef {
   const def = <HarmSynDef>{};
   def.f0Curve = getF0Curve(recs);
   const harmonics = Math.max(...recs.map(r => r.amplitudes.length));
   const minAmpl = getMinAmplitude(recs);
   const undefAmpl = Math.floor(minAmpl);
   def.amplitudeCurves = Array(harmonics);
   for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
      def.amplitudeCurves[harmonic - 1] = getAmplitudeCurve(recs, harmonic, undefAmpl); }
   return def; }

function getF0Curve (recs: HarmSynRecord[]) : FunctionCurveDef {
   const n = recs.length;
   const xVals = getTimeXVals(recs);
   const yVals = new Float64Array(n);
   for (let i = 0; i < n; i++) {
      yVals[i] = recs[i].f0; }
   return {xVals, yVals}; }

function getAmplitudeCurve (recs: HarmSynRecord[], harmonic: number, undefAmpl: number) : FunctionCurveDef {
   const n = recs.length;
   const xVals = getTimeXVals(recs);
   const yVals = new Float64Array(n);
   for (let i = 0; i < n; i++) {
      const r = recs[i];
      const a1 = (harmonic <= r.amplitudes.length) ? r.amplitudes[harmonic - 1] : undefAmpl;
      const a2 = isFinite(a1) ? a1 : undefAmpl;
      yVals[i] = a2; }
   return {xVals, yVals}; }

function getTimeXVals (recs: HarmSynRecord[]) : Float64Array {
   const n = recs.length;
   const xVals = new Float64Array(n);
   for (let i = 0; i < n; i++) {
      xVals[i] = recs[i].time; }
   return xVals; }

function getMinAmplitude (recs: HarmSynRecord[]) : number {
   let min = Infinity;
   for (const rec of recs) {
      for (const a of rec.amplitudes) {
         if (isFinite(a) && a < min) {
            min = a; }}}
   return min; }

// Intermediate data definition.

export const maxHarmonics = 100;

export interface HarmSynDefRecord {
   time:                     number;                       // time position [s]
   f0:                       number;                       // fundamental frequency [Hz]
   amplitudes:               Float64Array; }               // amplitudes of the harmonic frequency components [dB]

// This module exports the high-level API of the HarmSyn package.
// The lower level API can be accessed directly in the respective modules within the package.

export {HarmSynRecord, HarmSynDef, convertRecordsToDef} from "./intData/HarmSynIntData.ts";
export {analyzeHarmonicSignal, AnalParms, defaultAnalParms} from "./analysis/HarmAnal.ts";
export {synthesizeHarmonicSignal, SynParms, defaultSynParms, decodeHarmonicModString} from "./synthesis/HarmSyn.ts";

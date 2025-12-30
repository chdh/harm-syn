# HarmSyn - Harmonic Analyzer and Re-Synthesizer

An analysis and synthesis algorithm for quasi-periodic signals, e.g. vowels.

The HarmSyn package has two components that make up its functionality.

- The analysis component tracks the instantaneous frequency of a harmonic signal and measures the amplitudes of its harmonics at regular time intervals.
- The synthesis component re-synthesizes the harmonic signal based on its fundamental frequency and the amplitudes of its harmonics at each time point.

The Git repository consists of three parts.

- root: The JavaScript NPM package containing the algorithm.
- harmSynApp: A browser-based web application.
- harmSynCli: A [Node](https://nodejs.org)-based command-line tool.

**Online demo**: [www.source-code.biz/harmSyn](http://www.source-code.biz/harmSyn)<br>
NPM package: [harm-syn](https://www.npmjs.com/package/harm-syn)

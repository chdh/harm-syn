const offlineAudioContext = new OfflineAudioContext(1, 1, 44100);

export function createAudioBufferFromSamples (samples: ArrayLike<number>, sampleRate: number) : AudioBuffer {
   const buffer = offlineAudioContext.createBuffer(1, samples.length, sampleRate);
   const data = buffer.getChannelData(0);
   for (let i = 0; i < samples.length; i++) {
      data[i] = samples[i]; }
   return buffer; }

export function decodeAudioFileData (fileData: ArrayBuffer) : Promise<AudioBuffer> {
   return offlineAudioContext.decodeAudioData(fileData); }           // problem: resamples the audio signal

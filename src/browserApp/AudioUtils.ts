import * as WavFileDecoder from "wav-file-decoder";

const offlineAudioContext = new OfflineAudioContext(1, 1, 44100);

export interface AudioFileData {
   channelData:              Float32Array[];
   sampleRate:               number; }

export async function decodeAudioFileData (fileData: ArrayBuffer) : Promise<AudioFileData> {
   if (WavFileDecoder.isWavFile(fileData)) {
      return WavFileDecoder.decodeWavFile(fileData); }
    else {
      const audioBuffer = await offlineAudioContext.decodeAudioData(fileData); // problem: resamples the audio signal
      const channelData: Float32Array[] = new Array(audioBuffer.numberOfChannels);
      for (let channelNo = 0; channelNo < audioBuffer.numberOfChannels; channelNo++) {
         channelData[channelNo] = audioBuffer.getChannelData(channelNo); }
      return {channelData, sampleRate: audioBuffer.sampleRate}; }}

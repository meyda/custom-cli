#!/usr/bin/env node
import { exec } from "child_process";
import { readFileSync } from "fs";
import { mkdtemp } from "fs/promises";
import path from "path";
import wav from "node-wav";
import os from "os";
import Meyda from "meyda";

const CONFIG = {
  bufferSize: 1024,
  hopSize: 512,
  numberOfMFCCCoefficients: 13,
  features: ["rms", "mfcc"]
}

const FILE = process.argv[process.argv.length - 1];
// Create a temporary directory to store transcoded audio
const TEMP_DIR = await mkdtemp(path.join(os.tmpdir(), "transcoder-storage-"));

async function transcodeToWav(filename) {
  return new Promise((resolve, reject) => {
    let output_filename = `${path.join(TEMP_DIR, path.win32.basename(filename))}.wav`;
    // "shell out" to ffmpeg
    exec(
      `ffmpeg -i ${filename} ${output_filename}`,
      (error, stdout, stderr) => {
        if (error) {
          console.log("ERROR: ", error);
          reject(error);
        }
        resolve({ filename: output_filename, stdout, stderr });
      }
    );
  });
}

function chunk(samples, chunkSize, hopSize) {
  const chunks = [];

  for (let i = 0; i < samples.length; i += hopSize) {
    chunks.push(samples.slice(i, i + chunkSize));
  }
  return chunks;
}

try {
  let { filename } = await transcodeToWav(FILE);
  // result.filename is the new filename of the transcoded audio.
  // We can now use node-wav as described above to read the audio

  let buffer = readFileSync(filename);
  let decodedAudio = wav.decode(buffer);

  const buffers = chunk(decodedAudio.channelData[0], CONFIG.bufferSize, CONFIG.hopSize);
  const features = buffers.map(buffer => Meyda.extract(CONFIG.features, buffer));
  console.log(features);
  console.log(["rms"].concat(new Array(features[0].mfcc.length).fill("mfcc").map((_, i) => `mfcc${i}`)).join(","));
  for (var featureFrame of features) {
    console.log([featureFrame.rms, ...featureFrame.mfcc].join(","));
  }
} catch (error) {
  console.log("ERROR: ", error);
}

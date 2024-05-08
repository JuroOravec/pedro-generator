import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Progress } from '@ffmpeg/types';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export const createFfmpeg = () => {
  const ffmpeg = new FFmpeg();

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    ffmpeg.on('log', ({ message }) => {
      console.log(message);
    });
    // toBlobURL is used to bypass CORS issue, urls with the same
    // domain can be used directly.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    });
  };

  const transcode = async ({ input, inputFile, outputFile, onProgress }: {
    input?: string | Blob | File;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `input.webm`
     */
    inputFile: string;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `output.mp4`
     */
    outputFile: string;
    onProgress?: (input: { processedMs: number; timePassedMs: number }) => void;
  }) => {
    if (input) {
      await ffmpeg.writeFile(inputFile, await fetchFile(input));
    }

    const startTime = Date.now();
    const innerOnProgress = (event: Progress) => {
      const processedMs = event.time / 1000;
      const timePassedMs = Date.now() - startTime;
      onProgress?.({ processedMs, timePassedMs });
    };
    
    ffmpeg.on("progress", innerOnProgress);
    await ffmpeg.exec(['-i', inputFile, outputFile]);
    ffmpeg.off("progress", innerOnProgress);
  };

  const joinVideoAndAudioFiles = async ({ audioInput, audioInputFile, videoInput, videoInputFile, outputFile }: {
    videoInput?: string | Blob | File;
    audioInput?: string | Blob | File;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `input.webm`
     */
    videoInputFile: string;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `input.mp3`
     */
    audioInputFile: string;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `output.mp4`
     */
    outputFile: string;
  }) => {
    if (videoInput) {
      await ffmpeg.writeFile(videoInputFile, await fetchFile(videoInput));
    }
    if (audioInput) {
      await ffmpeg.writeFile(audioInputFile, await fetchFile(audioInput));
    }
    // Add audio - https://superuser.com/questions/590201/add-audio-to-video-using-ffmpeg
    await ffmpeg.exec(`-i ${videoInputFile} -i ${audioInputFile} -c copy -map 0:v:0 -map 1:a:0 ${outputFile}`.split(' '));
  };

  const videoToGif = async ({ videoInput, videoInputFile, outputFile }: {
    videoInput?: string | Blob | File;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `input.webm`
     */
    videoInputFile: string;
    /**
     * This is passed to ffmpeg. The extension tells ffmpeg how to process this file.
     * 
     * E.g. `output.mp4`
     */
    outputFile: string;
  }) => {
    if (videoInput) {
      await ffmpeg.writeFile(videoInputFile, await fetchFile(videoInput));
    }
    // Convert to gif - See https://superuser.com/questions/556029
    // TODO: DOES NOT WORK
    await ffmpeg.exec(`-i ${videoInputFile} -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 ${outputFile}`.split(' '));
  };

  const exportFile = async ({ file, mimeType }: { file: string; mimeType: string }) => {
    const data = await ffmpeg.readFile(file);
    // @ts-ignore
    const blob = new Blob([data.buffer], { type: mimeType });
    return blob;
  };

  return {
    load,
    transcode,
    joinVideoAndAudioFiles,
    exportFile,
    videoToGif,
  };
};

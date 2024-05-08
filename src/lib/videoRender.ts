import { createFfmpeg } from '../lib/videoConvert';


export interface ProgressInfo {
  /** For how long is the post processing going. */
  timePassedMs: number;
  /** How many milliseconds of the video are processed */
  processedMs: number;
  /** Fraction (0-1) of how much of the video is processed */
  progress: number;
}

export const recordCanvas = ({ canvas, durationSec, frameRate }: {
  canvas: HTMLCanvasElement;
  durationSec: number;
  frameRate?: number;
}) => {
  // Optional frames per second argument.
  const stream = canvas.captureStream(frameRate)
  const recordedChunks: BlobPart[] = []

  console.log(stream)
  const options = { mimeType: 'video/webm' }

  const promise = new Promise<Blob>((res) => {
    const mediaRecorder = new MediaRecorder(stream, options)
    mediaRecorder.ondataavailable = handleDataAvailable
    mediaRecorder.onstop = handleOnStop
    mediaRecorder.start()

    function handleDataAvailable(event: any) {
      console.log('data-available')
      recordedChunks.push(event.data)
      console.log(recordedChunks)
    }

    function handleOnStop() {
      console.log('data available after MediaRecorder.stop() called.')

      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      res(blob)
    }

    // Stop recording after given duration
    setTimeout(() => {
      console.log('stopping')
      mediaRecorder.stop()
    }, durationSec * 1000)
  })

  return promise
}

const ffmpeg = createFfmpeg();
/** Convert WebM to MP4 and add audio track */
export const postprocessPedroVideo = async (input: {
  audioUrl: string;
  videoBlob: Blob;
  durationSec: number;
  onProgress?: (input: ProgressInfo) => void;
}) => {
  const { audioUrl, videoBlob, durationSec, onProgress } = input;

  await ffmpeg.load();
  await ffmpeg.transcode({
    input: videoBlob,
    inputFile: 'input.webm',
    outputFile: 'output-mute.mp4',
    onProgress: ({ processedMs, timePassedMs }) => {
      const progress = processedMs / (durationSec * 1000);
      onProgress?.({ timePassedMs, processedMs, progress });
    },
  });
  await ffmpeg.joinVideoAndAudioFiles({
    audioInput: audioUrl,
    audioInputFile: 'input.mp3',
    videoInputFile: 'output-mute.mp4',
    outputFile: 'output.mp4',
  });
};

export const exportPedroVideoAsMp4 = async () => {
  const processedVid = await ffmpeg.exportFile({
    file: 'output.mp4',
    mimeType: 'video/mp4',
  });
  return processedVid;
};

export const exportPedroVideoAsGif = async () => {
  await ffmpeg.videoToGif({
    videoInputFile: 'output.mp4',
    outputFile: 'output.gif',
  });
  const processedVid = await ffmpeg.exportFile({
    file: 'output.gif',
    mimeType: 'image/gif',
  });
  return processedVid;
};

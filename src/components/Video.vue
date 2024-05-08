<template>
  <div style="height: 100vh;">
    <Ad ad-slot="top" />
    <h1 class="text-h2 text-center pb-8 pt-8 font-weight-medium">
      Pedro meme generator
    </h1>
    <p class="text-h5 text-center pb-16 pb font-weight-medium">
      Turn your recording into Pedro.
    </p>
    
    <div class="d-flex align-center flex-column pa-6">
      <v-btn-toggle
        v-model="movieModeIndex"
        variant="outlined"
        divided
        mandatory
        class="text-white"
      >
        <v-btn v-for="video in VIDEO_MODES" :key="video.title">
          <v-icon :icon="video.icon" class="pr-2"></v-icon>
          {{ video.title }}
        </v-btn>
      </v-btn-toggle>

      <div class="video-controls d-flex justify-center pt-8">
        <v-btn-toggle
          v-model="videoToolbarSelectedSettings"
          variant="outlined"
          divided
          multiple
          class="text-white"
        >
          <v-btn v-for="setting in TOOLBAR_SETTINGS" :key="setting.value">
            <v-icon :icon="setting.icon" class="pr-2"></v-icon>
            {{ setting.title }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <div class="mt-8">
        <v-btn v-if="!isRecording && !isPostprocessing" size="large" @click="recordMovie">
          <v-icon icon="mdi-record-circle" class="mr-2 text-red-lighten-2"></v-icon>
          Record
        </v-btn>
        <v-btn v-else-if="isRecording" class="bg-red" size="large" disabled>
          <v-icon icon="mdi-record-circle" class="mr-2 text-white"></v-icon>
          Recording
        </v-btn>
        <v-btn v-else class="bg-blue" size="large" disabled>
          <v-progress-circular class="mr-2 text-white" indeterminate size="20"></v-progress-circular>
          Postprocessing
        </v-btn>
      </div>

      <div v-if="postprocessState" class="w-100">
        <v-progress-linear
          class="mt-8"
          color="light-blue"
          height="30"
          :model-value="postprocessState.progress * 100"
          striped
        >
          <template #default="{ value }">
            <strong>{{ Math.ceil(value) }}%</strong>
          </template>
        </v-progress-linear>
        <div class="pt-2">
          Time elapsed: {{ formatTimeElapsed(Math.round(postprocessState.timePassedMs / 1000))  }}
        </div>
      </div>

      <div v-if="downloadAvailable">
        <v-btn
          v-for="output in OUTPUT_MODES"
          :key="output.value"
          class="mt-16 bg-green"
          size="large"
          @click="downloadVideo(output.value)"
        >
          <v-icon icon="mdi-download" class="mr-2 text-white"></v-icon>
          Download {{ output.title }}
        </v-btn>
      </div>
    </div>

    <div
      ref="canvasWrapper"
      class="canvas-wrapper pb-16"
      :class="currMovieMode.wrapperClass"
      @click="togglePlayMovie"
    >
      <img v-if="!canvas" :src="pedro" />
    </div>

    <div class="pt-16 pb-8 text-center d-flex flex-column" style="gap:30px;">
      <div class="d-flex flex-column">
        <p>
          Enjoyed? Used commercially?
        </p>
        <a href="https://www.buymeacoffee.com/jurooravec" target="_blank" class="pt-2 mx-auto" style="width: fit-content">
          <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
        </a>
      </div>
      <div>
        Made with ❤️ by <a href="https://github.com/JuroOravec" target="_blank">Juro Oravec</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import etro from "etro";
import { computed, ref, watch } from "vue"
import { saveAs } from 'file-saver';
import { inv } from 'mathjs'
import chunk from 'lodash/chunk';

import pedro from '../assets/pedro-placeholder.png';
import Ad from './Ad.vue';
import { recordCanvas, postprocessPedroVideo, exportPedroVideoAsMp4, exportPedroVideoAsGif, type ProgressInfo } from '../lib/videoRender';

type ExportType = "mp4" | "gif";
type SettingType = "audio" | "flip" | "rotate";

const TOOLBAR_SETTINGS: {
  icon: string;
  title: string;
  value: SettingType;
  defaultValue: boolean;
}[] = [
  {
    title: "Rotate",
    icon: "mdi-rotate-left",
    value: 'rotate',
    defaultValue: true,
  },
  {
    title: "Flip",
    icon: "mdi-flip-horizontal",
    value: 'flip',
    defaultValue: true,
  },
  {
    title: "Audio",
    icon: "mdi-volume-high",
    value: 'audio',
    defaultValue: true,
  },
];

const commonVideoCanvasStyle: Partial<CSSStyleDeclaration> = {
  margin: 'auto',
}

const VIDEO_MODES: {
  icon: string;
  title: string;
  videoHeight: number;
  videoWidth: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  wrapperClass: string;
  canvasStyle?: Partial<CSSStyleDeclaration>;
}[] = [
  {
    title: "Vertical",
    icon: "mdi-cellphone",
    videoWidth: 720,
    videoHeight: 1280,
    videoOffsetY: -50,
    canvasStyle: { ...commonVideoCanvasStyle, height: '100%' },
    wrapperClass: 'vertical',
  },
  {
    title: "Horizontal",
    icon: "mdi-cellphone mdi-rotate-90",
    videoWidth: 1280,
    videoHeight: 720,
    canvasStyle: { ...commonVideoCanvasStyle, width: '100%' },
    wrapperClass: 'horizontal',
  },
  {
    icon: "mdi-crop-square",
    title: "Square",
    videoHeight: 720,
    videoWidth: 720,
    canvasStyle: { ...commonVideoCanvasStyle, height: '100%' },
    wrapperClass: 'square',
  },
];

const OUTPUT_MODES: {
  icon: string;
  title: string;
  value: ExportType;
}[] = [
  // {
  //   title: "GIF",
  //   icon: "mdi-cellphone",
  //   value: 'gif',
  // },
  {
    title: "MP4",
    icon: "mdi-cellphone",
    value: 'mp4',
  },
];

// declare a ref to hold the element reference
// the name must match template ref value
const canvasWrapper = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const audio = ref<HTMLAudioElement | null>(null);

// Video info and playback
const movieModeIndex = ref<number>(0);
const movie = ref<etro.Movie | null>(null);
const movieIsPlaying = ref<boolean>(false);
const movieDuration = ref<number>(0);
const movieRestartId = ref<any>(null);

// Video processing inputs
const videoToolbarSelectedSettings = ref<number[]>(TOOLBAR_SETTINGS.map((_, i) => i));

// Video processing
const isLoadingMovie = ref<boolean>(false);
const isRecording = ref<boolean>(false);
const isPostprocessing = ref<boolean>(false);
const postprocessState = ref<ProgressInfo | null>(null);
const downloadAvailable = ref<boolean>(false);

const currMovieMode = computed(() => {
  return VIDEO_MODES[movieModeIndex.value];
});

const currSettings = computed(() => {
  return TOOLBAR_SETTINGS.reduce<Record<SettingType, boolean>>((agg, setting, index) => {
    agg[setting.value] = videoToolbarSelectedSettings.value.includes(index);
    return agg;
  }, {} as any);
});

const createMovie = async (input: {
  canvas: HTMLCanvasElement;
  audio: HTMLAudioElement | null;
  videoHeight: number;
  videoWidth: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  duration: number;
  enableFlip: boolean;
  enableRotate: boolean;
}) => {
  const { canvas, audio, videoHeight, videoWidth, videoOffsetX = 0, videoOffsetY = 0, duration, enableFlip, enableRotate } = input;

  // See https://etrojs.dev/docs/getting-started/create-a-movie
  const movie = new etro.Movie({
    canvas,
    background: etro.parseColor('black'),
    actx: new AudioContext(),
  });

  let audioLayer: etro.layer.Audio | null = null;
  if (audio) {
    audioLayer = new etro.layer.Audio({
      startTime: 0,
      source: audio,
    });
  }

  // Get the user's webcam stream
  // See https://etrojs.dev/docs/tutorials/react-webcam-filter/
  const video = await navigator.mediaDevices
    .getUserMedia({ video: true })
    // Create a video element from the stream
    .then((stream) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      return new Promise<HTMLVideoElement>((resolve) => {
        video.onloadedmetadata = () => {
          resolve(video);
        };
      });
    });

  const crop = computeWebcamCrop({ video });
  console.log({ video, crop });
  const videoLayer = new etro.layer.Video({
    startTime: 0,
    source: video,
    width: videoWidth,
    height: videoHeight,
    sourceX: crop.xOffset,
    sourceY: crop.yOffset,
    sourceWidth: crop.width,
    sourceHeight: crop.height,
  });
  console.log({ videoLayer });

  const circle = computeCircleDims({ height: crop.height, width: crop.width });
  const maskFx = new etro.effect.EllipticalMask({
    x: circle.xOffset, // the x-coordinate of the center of the ellipse
    y: circle.yOffset, // the y-coordinate of the center of the ellipse
    radiusX: circle.radius, // the horizontal radius of the ellipse
    radiusY: circle.radius, // the vertical radius of the ellipse
    rotation: 0, // rotation angle in radians (default: 0)
    startAngle: 0, // start angle in radians (default: 0)
    endAngle: 2 * Math.PI, // end angle in radians (default: 2 * Math.PI)
    anticlockwise: false, // whether the ellipse is drawn clockwise or anticlockwise (default: false)
  });

  const computePedroRotationInRadians = (timeSec: number) => {
    // NOTES:
    // - Full video has 10.6 seconds
    // - 00:00 - 3/4 Pi (N-E)
    // - 03:00 - 2 Pi   (S)
    // - 10:60 - 4 Pi   (S)
    // See https://en.wikipedia.org/wiki/Radian
    let radians = 0;
    if (timeSec < 3) {
      radians = (
        5/4 * Math.PI         // Do 235 deg turn
        * (
          (timeSec - 0)     // Starting at second 0
          / 3               // Over 3 seconds
        )
        + (3/4 * Math.PI)   // And starting at 135 deg
      );
    } else {
      radians = (
        2 * Math.PI         // Do 360 deg turn
        * (
          (timeSec - 3)     // Starting at second 3
          / (duration - 3)  // Over the rest of the video duration
        )
        + (2 * Math.PI)   // And starting at 0 deg (after 1 loop)
      );
    }
    return radians;
  };

  /**
   * See https://stackoverflow.com/a/9202004/9788634
   * And https://github.com/josdejong/mathjs
   */
  const rotateAroundCenter = (input: {
    angle: number;
    imageWidth: number;
    imageHeight: number;
  }) => {
    const { angle, imageHeight, imageWidth } = input;

    const matrix = new etro.effect.Transform.Matrix();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle)

    const rotation = new etro.effect.Transform.Matrix([
        cos,  sin,   0,
      -sin,  cos,   0,
          0,    0,   1,
    ]);
    const translation = new etro.effect.Transform.Matrix([
      1,  0,  -imageWidth /2,
      0,  1,  -imageHeight/2,
      0,  0,   1,
    ]);
    const translationInv = new etro.effect.Transform.Matrix(
      inv(chunk(translation.data, 3)).flat(1)
    );
  
    // inv(translation) * rotation * translation
    const transformMatrix = translation.multiply(rotation).multiply(translationInv);
    matrix.multiply(transformMatrix);

    return matrix;
  };

  const flipYAxis = (input: {
    imageWidth: number;
  }) => {
    const { imageWidth } = input;

    const matrix = new etro.effect.Transform.Matrix();

    const flipYAxisMatrix = new etro.effect.Transform.Matrix([
      -1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);

    // Move the image so the center of the image is on the Y axis
    const translation = new etro.effect.Transform.Matrix([
      1,  0,  -imageWidth /2,
      0,  1,   0,
      0,  0,   1,
    ]);
    const translationInv = new etro.effect.Transform.Matrix(
      inv(chunk(translation.data, 3)).flat(1)
    );
  
    // inv(translation) * yflip * translation
    const transformMatrix = translation.multiply(flipYAxisMatrix).multiply(translationInv);
    matrix.multiply(transformMatrix);

    return matrix;
  };

  const scaleAroundCenter = (input: {
    imageWidth: number;
    imageHeight: number;
    xScale: number;
    yScale: number;
  }) => {
    const { imageHeight, imageWidth, xScale, yScale } = input;

    const matrix = new etro.effect.Transform.Matrix();

    // Move the image so the center of the image is on point (0, 0)
    const translation = new etro.effect.Transform.Matrix([
      1,  0,  -imageWidth /2,
      0,  1,  -imageHeight/2,
      0,  0,   1,
    ]);
    // Move back, considering the changed size and hence changed center of image
    const translationInv = new etro.effect.Transform.Matrix(
      inv([
        [1,  0,  -imageWidth * xScale /2],
        [0,  1,  -imageHeight * yScale /2],
        [0,  0,   1],
      ]).flat(1)
    );

    const transformMatrix = translation.scale(xScale, yScale).multiply(translationInv);
    matrix.multiply(transformMatrix);

    return matrix;
  };

  const centerRotationFx = new etro.effect.Transform({
    matrix: (element, timeSec) => {
      console.log({ timeSec });
      const radians = computePedroRotationInRadians(timeSec);
      return rotateAroundCenter({
        imageHeight: crop.height,
        imageWidth: crop.width,
        angle: radians,
      });
    },
  });

  const flipYAxisFx = new etro.effect.Transform({
    matrix: flipYAxis({
      imageWidth: crop.width,
    }),
  });

  const scale = 1.15;
  const scaleAroundCenterFx = new etro.effect.Transform({
    matrix: scaleAroundCenter({
      imageHeight: crop.height,
      imageWidth: crop.width,
      xScale: scale,
      yScale: scale,
    }),
  });

  const translateFx = new etro.effect.Transform({
    matrix: new etro.effect.Transform.Matrix()
      .translate(
        ((videoWidth - crop.width * scale) / 2) + videoOffsetX,
        ((videoHeight - crop.height * scale) / 2) + videoOffsetY,
      )
  });

  // Compose
  // IMPORTANT: The order matters!
  movie.layers.push(videoLayer);
  if (audioLayer) movie.layers.push(audioLayer);

  // IMPORTANT: The order matters!
  if (enableFlip) movie.effects.push(flipYAxisFx);
  if (enableRotate) movie.effects.push(centerRotationFx);
  movie.effects.push(
    maskFx,
    scaleAroundCenterFx,
    translateFx,
  );

  return movie;
};

const computeWebcamCrop = ({ video }: { video: HTMLVideoElement }) => {
  const { videoHeight: height, videoWidth: width } = video;
  const smallerDim = height < width ? "height" : height > width ? "width" : "height";
  const { lgDimSize, smDimSize } = smallerDim === "height"
    ? { lgDimSize: width, smDimSize: height }
    : { lgDimSize: height, smDimSize: width };
  
  const lgDimOffset = (lgDimSize - smDimSize) / 2;

  return smallerDim === "height"
    ? { xOffset: lgDimOffset, width: height, yOffset: 0, height: height }
    : { xOffset: 0, width: width, yOffset: lgDimOffset, height: width };
};

const computeCircleDims = ({ height, width }: { height: number; width: number }) => {
  const CIRCLE_DISTANCE_FROM_EDGE_FRACTION = 0

  const smallerDim = height < width ? "height" : height > width ? "width" : "height";
  const smallerDimSize = smallerDim === "height" ? height : width;

  const diameter = (1 - CIRCLE_DISTANCE_FROM_EDGE_FRACTION) * smallerDimSize;
  const radius = diameter / 2;

  const xOffset = width / 2;
  const yOffset = height / 2;

  return {
    radius,
    xOffset,
    yOffset,
  };
};

const createCanvas = () => {
  const newCanvas = document.createElement("canvas");
  newCanvas.width = currMovieMode.value.videoWidth;
  newCanvas.height = currMovieMode.value.videoHeight;

  Object.entries(currMovieMode.value.canvasStyle ?? {}).forEach(([key, val]) => {
    // @ts-ignore
    newCanvas.style[key] = val;
  });
  return newCanvas;
};

const initCanvas = (canvasEl: HTMLCanvasElement) => {
  if (!canvasWrapper.value) throw Error("Cannot find container for canvas element");

  // Remove old canvas
  if (canvas.value) canvas.value.remove();

  // Assign the new one
  canvasWrapper.value.appendChild(canvasEl);
  canvas.value = canvasEl;
};

const initMovie = async () => {
  const newCanvas = createCanvas();
  initCanvas(newCanvas);

  let audioSrc: HTMLAudioElement | null = null
  let audioDuration: number | null = null;

  // Create new audio
  audioSrc = new Audio("/pedro.mp3");
  // See https://stackoverflow.com/questions/44610417/audio-duration-returns-nan
  audioDuration = await new Promise<number>((res) => {
    audioSrc!.onloadedmetadata = () => {
      res(audioSrc!.duration);
    };
  });

  // Remove old audio
  if (audio.value) audio.value.remove();
  // Set new audio
  audio.value = audioSrc;
  movieDuration.value = audioDuration;

  const duration = audioDuration != null ? audioDuration : movieDuration.value;
  if (!duration) throw Error("Normal movie must be called before render preview")

  const newMovie = await createMovie({
    canvas: newCanvas,
    audio: currSettings.value.audio ? audioSrc : null,
    videoHeight: currMovieMode.value.videoHeight,
    videoWidth: currMovieMode.value.videoWidth,
    videoOffsetX: currMovieMode.value.videoOffsetX,
    videoOffsetY: currMovieMode.value.videoOffsetY,
    enableFlip: currSettings.value.flip,
    enableRotate: currSettings.value.rotate,
    duration,
  });

  return { movie: newMovie, canvas: newCanvas };
};

const startMovie = (input: { loop?: boolean } = {}) => {
  const { loop = true } = input;

  if (!movie.value) throw Error("Cannot start movie - No movie set")
  if (movieIsPlaying.value) throw Error("Cannot start movie - Movie already playing")

  const setupLoop = () => {
    if (loop) {
      movieRestartId.value = setInterval(() => {
        if (!movie.value) return;
        console.log("RESTARTING PLAYBACK!");
        movie.value.stop();
        movie.value.play();
      }, movieDuration.value * 1000);
    } else if (movieRestartId.value !== null) {
      clearInterval(movieRestartId.value);
      movieRestartId.value = null;
    }
  };

  movieIsPlaying.value = true;

  return new Promise<void>((res) => {
    movie.value!.play({
      onStart: () => {
        setupLoop();
        res();
      },
    });
  });
};

const stopMovie = () => {
  if (movieRestartId.value !== null) {
    clearInterval(movieRestartId.value);
    movieRestartId.value = null;
  }

  if (!movie.value) throw Error("Cannot stop movie - No movie set")
  if (!movieIsPlaying.value) throw Error("Cannot stop movie - Movie already stopped")

  movie.value.stop()
  movieIsPlaying.value = false;
};

const togglePlayMovie = async () => {
  if (!canvasWrapper.value) throw Error("Cannot toggle play movie - No movie container found")
  if (isLoadingMovie.value) return;

  isLoadingMovie.value = true;
  
  if (!movie.value) {
    const res = await initMovie();
    movie.value = res.movie
  }

  if (!movieIsPlaying.value) {
    await startMovie({ loop: true });
  } else {
    stopMovie();
  }

  isLoadingMovie.value = false;
};

const recordMovie = async () => {
  if (isRecording.value || isPostprocessing.value) throw Error("Recording already in progress");

  // Stop video if already playing, so we start with a clean slate, just to be safe
  if (movie.value && movieIsPlaying.value) {
    stopMovie();
  }

  // Initial state
  isRecording.value = true;
  isPostprocessing.value = false;
  postprocessState.value = null;
  downloadAvailable.value = false;

  const currMovie = await initMovie();
  movie.value = currMovie.movie;
  const durationSec = movieDuration.value;

  // Start the video (user's camera + effects applied), and record it
  await startMovie({ loop: false });
  const webmBlob = await recordCanvas({
    canvas: currMovie.canvas,
    durationSec,
    frameRate: 30,
  });
  movie.value.pause();
  console.log('Video finished recording!');

  isPostprocessing.value = true;
  isRecording.value = false;
  
  // Postprocess the video
  console.log('TRANSCODING!');
  await postprocessPedroVideo({
    audioUrl: '/pedro.mp3',
    videoBlob: webmBlob,
    durationSec,
    onProgress: (data) => {
      // console.log(data);
      postprocessState.value = data;
    }
  });
  console.log('TRANSCODING DONE!');
  downloadAvailable.value = true;
  isPostprocessing.value = false;
  postprocessState.value = null;
};

const downloadVideo = async (format: ExportType) => {
  if (format === 'mp4') {
    const blob = await exportPedroVideoAsMp4();
    saveAs(blob, "pedro.mp4");
  } else if (format === 'gif') {
    const blob = await exportPedroVideoAsGif();
    saveAs(blob, "pedro.gif");
  }
};

// See https://stackoverflow.com/a/34841026/9788634
const formatTimeElapsed = (seconds: number) => {
  const hours   = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const secs = seconds % 60

  return [hours, minutes, secs]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v,i) => v !== "00" || i > 0)
      .join(":");
};


// Re-initialize to re-render the canvas when canvas dimensions change
watch([currMovieMode, currSettings], async () => {
  const wasPlaying = movieIsPlaying.value;
  if (movieIsPlaying.value) {
    stopMovie();
  }
  const res = await initMovie();
  movie.value = res.movie

  if (wasPlaying) startMovie();
});

</script>

<style scoped lang="scss">
.canvas-wrapper {
  display: flex;
  height: inherit;
  width: fit-content;
  margin: auto;
  background: black;
  cursor: pointer;

  &.vertical {
    height: 100vh;
  }
  &.horizontal, &.square {
    height: fit-content;
  }
}
</style>

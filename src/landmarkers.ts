/**
 * Loads MediaPipe's three landmarkers from this site's own files
 * (public/mediapipe/wasm and public/mediapipe/models), so nothing is fetched
 * from a CDN and, once loaded, the page makes no further network requests.
 *
 * The @mediapipe/tasks-vision bundle is imported lazily: the page paints with
 * no ML code at all, and the ~40 MB of runtime + models only download after
 * the visitor presses a button.
 */
import type { FaceLandmarker, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

export type Landmarkers = {
  face: FaceLandmarker;
  hands: HandLandmarker;
  pose: PoseLandmarker;
};

const WASM_PATH = "/mediapipe/wasm";
const MODELS = {
  face: "/mediapipe/models/face_landmarker.task",
  hand: "/mediapipe/models/hand_landmarker.task",
  pose: "/mediapipe/models/pose_landmarker_lite.task",
} as const;

let cached: Promise<Landmarkers> | null = null;

export function loadLandmarkers(onProgress: (message: string) => void = () => {}): Promise<Landmarkers> {
  if (!cached) {
    cached = load(onProgress).catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

async function load(onProgress: (message: string) => void): Promise<Landmarkers> {
  onProgress("Loading the vision runtime…");
  const mp = await import("@mediapipe/tasks-vision");
  const vision = await mp.FilesetResolver.forVisionTasks(WASM_PATH);

  // GPU first, CPU when the device or browser refuses (older phones, some WebViews).
  const withFallback = async <T>(label: string, make: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> => {
    onProgress(`Loading the ${label} model…`);
    try {
      return await make("GPU");
    } catch (gpuError) {
      console.warn(`${label} landmarker: GPU delegate failed, using CPU`, gpuError);
      return make("CPU");
    }
  };

  const face = await withFallback("face", (delegate) =>
    mp.FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.face, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    }),
  );
  const hands = await withFallback("hand", (delegate) =>
    mp.HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.hand, delegate },
      runningMode: "VIDEO",
      numHands: 2,
    }),
  );
  const pose = await withFallback("pose", (delegate) =>
    mp.PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODELS.pose, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      outputSegmentationMasks: false,
    }),
  );
  onProgress("Models ready.");
  return { face, hands, pose };
}

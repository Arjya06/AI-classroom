import { FilesetResolver, FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FrameCvMetrics {
  detectedFacesCount: number;
  facePresenceScore: number;
  attentionOrientationScore: number;
  averageYawDeg: number;
  averagePitchDeg: number;
  eyeOpennessRatio: number;
  averageLuminance: number;
  dataQualityStatus: 'RELIABLE' | 'POOR_LIGHTING' | 'INSUFFICIENT_VISUAL_DATA';
  landmarksList: NormalizedLandmark[][];
}

let cachedLandmarker: FaceLandmarker | null = null;
let loadPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (cachedLandmarker) return cachedLandmarker;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 8,
      minFaceDetectionConfidence: 0.45,
      minFacePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    }).catch(async () => {
      // Fallback to CPU delegate if WebGL/GPU fails
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 8,
      });
    });
    cachedLandmarker = landmarker;
    return landmarker;
  })();

  return loadPromise;
}

export function estimateFrameLuminance(video: HTMLVideoElement, sampleCanvas: HTMLCanvasElement): number {
  const w = 64;
  const h = 48;
  sampleCanvas.width = w;
  sampleCanvas.height = h;
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 128;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return Math.round(sum / (w * h));
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Estimates approximate head orientation (yaw & pitch degrees) and eye openness
 * from MediaPipe 468-point facial landmarks.
 * Note: These are approximate geometric indicators, never definitive gaze or mental-focus proof.
 */
function evaluateSingleFace(landmarks: NormalizedLandmark[]): {
  yawDeg: number;
  pitchDeg: number;
  ear: number;
  orientationScore: number;
} {
  const nose = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  // Horizontal asymmetry ratio -> approximate yaw
  const leftDist = Math.max(0.001, nose.x - leftCheek.x);
  const rightDist = Math.max(0.001, rightCheek.x - nose.x);
  const yawRatio = (leftDist - rightDist) / (leftDist + rightDist);
  const yawDeg = Math.round(yawRatio * 65);

  // Vertical ratio -> approximate pitch
  const upperDist = Math.max(0.001, nose.y - forehead.y);
  const lowerDist = Math.max(0.001, chin.y - nose.y);
  const pitchRatio = (upperDist - lowerDist) / (upperDist + lowerDist);
  const pitchDeg = Math.round(pitchRatio * 55);

  // Eye openness ratio (approximate EAR from vertical lid gap / horizontal eye width)
  const leftGap = dist(landmarks[159], landmarks[145]);
  const leftWidth = Math.max(0.001, dist(landmarks[33], landmarks[133]));
  const rightGap = dist(landmarks[386], landmarks[374]);
  const rightWidth = Math.max(0.001, dist(landmarks[362], landmarks[263]));
  const ear = ((leftGap / leftWidth) + (rightGap / rightWidth)) / 2;

  // Forward orientation indicator: Penalize large yaw (>22 deg) or downward pitch
  const yawPenalty = Math.max(0, Math.abs(yawDeg) - 10) * 1.8;
  const pitchPenalty = Math.max(0, Math.abs(pitchDeg) - 12) * 1.5;
  const eyeBonus = ear >= 0.18 ? 10 : ear >= 0.12 ? 4 : -12;

  const orientationScore = Math.max(0, Math.min(100, Math.round(92 - yawPenalty - pitchPenalty + eyeBonus)));
  return { yawDeg, pitchDeg, ear: Math.round(ear * 100) / 100, orientationScore };
}

export function analyzeVideoFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  sampleCanvas: HTMLCanvasElement,
  timestampMs: number
): FrameCvMetrics {
  const avgLum = estimateFrameLuminance(video, sampleCanvas);
  const result = landmarker.detectForVideo(video, timestampMs);
  const faces = result.faceLandmarks || [];

  if (avgLum < 32 && faces.length === 0) {
    return {
      detectedFacesCount: 0,
      facePresenceScore: 0,
      attentionOrientationScore: 0,
      averageYawDeg: 0,
      averagePitchDeg: 0,
      eyeOpennessRatio: 0,
      averageLuminance: avgLum,
      dataQualityStatus: 'POOR_LIGHTING',
      landmarksList: [],
    };
  }

  if (faces.length === 0) {
    return {
      detectedFacesCount: 0,
      facePresenceScore: 0,
      attentionOrientationScore: 0,
      averageYawDeg: 0,
      averagePitchDeg: 0,
      eyeOpennessRatio: 0,
      averageLuminance: avgLum,
      dataQualityStatus: 'INSUFFICIENT_VISUAL_DATA',
      landmarksList: [],
    };
  }

  const evals = faces.map(evaluateSingleFace);
  const avgYaw = Math.round(evals.reduce((a, b) => a + b.yawDeg, 0) / evals.length);
  const avgPitch = Math.round(evals.reduce((a, b) => a + b.pitchDeg, 0) / evals.length);
  const avgEar = Math.round((evals.reduce((a, b) => a + b.ear, 0) / evals.length) * 100) / 100;
  const avgOrientation = Math.round(evals.reduce((a, b) => a + b.orientationScore, 0) / evals.length);

  return {
    detectedFacesCount: faces.length,
    facePresenceScore: 100,
    attentionOrientationScore: avgOrientation,
    averageYawDeg: avgYaw,
    averagePitchDeg: avgPitch,
    eyeOpennessRatio: avgEar,
    averageLuminance: avgLum,
    dataQualityStatus: avgLum < 38 ? 'POOR_LIGHTING' : 'RELIABLE',
    landmarksList: faces,
  };
}

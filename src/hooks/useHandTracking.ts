import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface HandData {
  x: number;
  y: number;
  z: number;
  pinch: number;
  isHandVisible: boolean;
  trail: { x: number; y: number; id: number }[];
}

export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handData, setHandData] = useState<HandData>({
    x: 0.5,
    y: 0.5,
    z: 1,
    pinch: 0,
    isHandVisible: false,
    trail: [],
  });
  const lastHandDataRef = useRef<HandData>(handData);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const trailIdRef = useRef<number>(0);

  useEffect(() => {
    if (!videoRef.current) return;

    const setupHandTracking = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task?v=1`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        landmarkerRef.current = handLandmarker;

        // Start camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            requestRef.current = requestAnimationFrame(predictWebcam);
          };
        }
      } catch (err) {
        console.error("Failed to initialize hand tracking:", err);
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !landmarkerRef.current || videoRef.current.readyState < 2) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const startTimeMs = performance.now();
      try {
        const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        processResults(results);
      } catch (err) {
        console.error("Error during hand detection:", err);
      }
      
      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const processResults = (results: HandLandmarkerResult) => {
      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Index finger tip (8) and Thumb tip (4)
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        // Calculate pinch distance (Euclidean distance between thumb and index)
        const pinch = Math.sqrt(
          Math.pow(thumb.x - index.x, 2) + 
          Math.pow(thumb.y - index.y, 2)
        );

        // Average position of hand (using index tip)
        // We invert X because the camera is mirrored
        const rawX = 1 - index.x;
        const rawY = index.y;
        const rawZ = index.z; // Depth (approximate)

        // Internal Smoothing (LERP) to reduce raw jitter before state updates
        const LERP_FACTOR = 0.25; // Lower = smoother but more lag
        const x = lastHandDataRef.current.x + (rawX - lastHandDataRef.current.x) * LERP_FACTOR;
        const y = lastHandDataRef.current.y + (rawY - lastHandDataRef.current.y) * LERP_FACTOR;
        const z = 1 - rawZ;
        const currentPinch = lastHandDataRef.current.pinch + (pinch - lastHandDataRef.current.pinch) * (LERP_FACTOR * 1.5); // Pinch can be slightly faster

        const threshold = 0.0001; 
        const hasChanged = 
          Math.abs(x - lastHandDataRef.current.x) > threshold ||
          Math.abs(y - lastHandDataRef.current.y) > threshold ||
          Math.abs(currentPinch - lastHandDataRef.current.pinch) > threshold ||
          !lastHandDataRef.current.isHandVisible;

        if (hasChanged) {
          const newTrail = [...lastHandDataRef.current.trail, { x, y, id: trailIdRef.current++ }].slice(-12);
          const newData = {
            x,
            y,
            z, // Invert depth so closer is larger
            pinch: currentPinch,
            isHandVisible: true,
            trail: newTrail,
          };
          lastHandDataRef.current = newData;
          setHandData(newData);
        }
      } else {
        if (lastHandDataRef.current.isHandVisible) {
          const newData = { ...lastHandDataRef.current, isHandVisible: false, trail: [] };
          lastHandDataRef.current = newData;
          setHandData(newData);
        }
      }
    };

    setupHandTracking();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { videoRef, handData };
}

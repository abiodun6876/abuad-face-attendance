// src/types/react-webcam.d.ts (create this file)
declare module 'react-webcam' {
  import { Component, RefObject } from 'react';

  interface WebcamProps {
    audio?: boolean;
    audioConstraints?: MediaStreamConstraints['audio'];
    videoConstraints?: MediaTrackConstraints;
    screenshotFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
    width?: number;
    height?: number;
    screenshotQuality?: number;
    onUserMedia?: (stream: MediaStream) => void;
    onUserMediaError?: (error: string | DOMException) => void;
    minScreenshotWidth?: number;
    minScreenshotHeight?: number;
    style?: React.CSSProperties;
    mirrored?: boolean;
    className?: string;
    muted?: boolean;
  }

  export default class Webcam extends Component<WebcamProps> {
    getScreenshot(): string | null;
  }
}

// Then in your FaceCamera component:
const webcamRef = useRef<Webcam>(null); // Now this will work
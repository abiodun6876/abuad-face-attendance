// components/FaceCamera.tsx
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button, Spin, message, Typography } from 'antd';
import { Camera, AlertCircle, Scan } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: { success: boolean; photoData?: { base64: string } }) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  loading?: boolean;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = false,
  captureInterval = 3000,
  loading = false
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [hudStatus, setHudStatus] = useState('SYSTEM_IDLE');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check camera permissions on mount
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        setHudStatus('INITIALIZING...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraError('');
        setHudStatus('CAMERA_CONNECTED');
      } catch (error: any) {
        setCameraError('CAMERA_ACCESS_DENIED');
        setHudStatus('SYSTEM_ERROR');
        setIsCameraActive(false);
      }
    };
    checkCameraPermissions();
  }, []);

  useEffect(() => {
    if (loading) {
      setHudStatus('BIO_metrics: ANALYZING...');
    } else if (isCameraActive) {
      setHudStatus('SYSTEM_READY: MONITORING');
    }
  }, [loading, isCameraActive]);

  const capturePhoto = () => {
    if (!webcamRef.current) {
      message.error('Camera not ready');
      return null;
    }
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        message.error('Failed to capture photo');
        return null;
      }
      return imageSrc;
    } catch (error) {
      message.error('Camera error occurred');
      return null;
    }
  };

  const handleCapture = () => {
    const photoData = capturePhoto();
    if (!photoData) return;

    if (mode === 'enrollment' && onEnrollmentComplete) {
      onEnrollmentComplete(photoData);
    } else if (mode === 'attendance' && onAttendanceComplete) {
      onAttendanceComplete({
        success: true,
        photoData: { base64: photoData }
      });
    }
  };

  useEffect(() => {
    if (autoCapture && isCameraActive && mode === 'attendance') {
      intervalRef.current = setInterval(() => {
        setCountdown(1);
        setTimeout(() => {
          handleCapture();
          setCountdown(null);
        }, 1000);
      }, captureInterval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoCapture, isCameraActive, mode, captureInterval]);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user" as const
  };

  if (cameraError) {
    return (
      <div className="hud-container" style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="hud-corner corner-tl"></div>
        <div className="hud-corner corner-tr"></div>
        <div className="hud-corner corner-bl"></div>
        <div className="hud-corner corner-br"></div>
        <AlertCircle size={48} className="hud-error" style={{ marginBottom: 16 }} />
        <div className="hud-error" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 24 }}>ACCESS_DENIED</div>
        <div className="hud-status" style={{ top: '20px', right: '20px' }}>ERROR_CODE: 0x403</div>
        <Button
          className="hologram-btn"
          onClick={() => {
            setCameraError('');
            setIsCameraActive(true);
            window.location.reload();
          }}
        >
          RETRY_CONNECTION
        </Button>
      </div>
    );
  }

  return (
    <div className="hud-container" style={{ minHeight: '400px' }}>
      <div className="hud-corner corner-tl"></div>
      <div className="hud-corner corner-tr"></div>
      <div className="hud-corner corner-bl"></div>
      <div className="hud-corner corner-br"></div>

      <div className="laser-scanner"></div>

      <div className="hud-status">
        STATUS: {hudStatus}<br />
        RESOLUTION: 1280x720<br />
        MODE: {mode.toUpperCase()}<br />
        ENCRYPTION: AES-256
      </div>

      {isCameraActive ? (
        <>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            onUserMediaError={() => {
              setCameraError('WEBCAM_INIT_FAILED');
              setIsCameraActive(false);
            }}
          />

          {countdown && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 120,
              fontWeight: 'bold',
              color: 'var(--hologram-color)',
              textShadow: '0 0 20px var(--hologram-color)',
              zIndex: 20,
              fontFamily: 'Courier New'
            }}>
              {countdown}
            </div>
          )}

          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              textAlign: 'center'
            }}>
              <Spin size="large" tip="SCANNING..." style={{ color: 'var(--hologram-color)' }} />
            </div>
          )}

          {mode === 'enrollment' && !autoCapture && (
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 10
            }}>
              <Button
                className="hologram-btn"
                icon={<Scan size={18} style={{ marginRight: 8 }} />}
                onClick={handleCapture}
                loading={loading}
              >
                START_BIOMETRIC_CAPTURE
              </Button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          height: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
        }}>
          <Camera size={48} color="rgba(0, 242, 255, 0.3)" />
          <div className="hud-status" style={{ position: 'static', textAlign: 'center' }}>CAMERA_DISABLED</div>
          <Button
            className="hologram-btn"
            onClick={() => setIsCameraActive(true)}
          >
            RESTORE_LINK
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;

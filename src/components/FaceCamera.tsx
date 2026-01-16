// components/FaceCamera.tsx - Complete fixed version
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button, Spin, message, Typography } from 'antd';
import { Camera } from 'lucide-react';

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
  // Use any type to avoid TypeScript issues with the ref
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const capturePhoto = () => {
    if (!webcamRef.current) return null;
    
    try {
      // Use getScreenshot method which is available on the Webcam component
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        console.error('Failed to capture photo');
        return null;
      }
      
      return imageSrc;
    } catch (error) {
      console.error('Error capturing photo:', error);
      return null;
    }
  };

  const handleCapture = () => {
    const photoData = capturePhoto();
    if (!photoData) {
      message.error('Failed to capture photo');
      return;
    }
    
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
    width: 640,
    height: 480,
    facingMode: "user" as const
  };

  return (
    <div style={{ position: 'relative', height: '100%' }}>
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
              borderRadius: 8
            }}
          />
          
          {countdown && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 10
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
              zIndex: 20
            }}>
              <Spin size="large" />
            </div>
          )}
          
          {mode === 'enrollment' && !autoCapture && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 10
            }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera />}
                onClick={handleCapture}
                loading={loading}
                style={{ height: 50, fontSize: 16 }}
              >
                CAPTURE FACE
              </Button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          gap: 16
        }}>
          <div style={{ fontSize: 48 }}>📷</div>
          <Text type="secondary">Camera is disabled</Text>
          <Button 
            type="primary" 
            onClick={() => setIsCameraActive(true)}
            size="large"
          >
            Enable Camera
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;
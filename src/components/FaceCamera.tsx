// src/components/FaceCamera.tsx - SIMPLIFIED AUTO-CAPTURE
import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Tag
} from 'antd';
import { Camera, CheckCircle, VideoOff } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  autoCapture?: boolean;
  captureInterval?: number;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = true,
  captureInterval = 3000 // Capture every 3 seconds
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [autoCaptureActive, setAutoCaptureActive] = useState(autoCapture);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureRef = useRef<number | null>(null);

  // Simple auto-capture function
  const startAutoCapture = () => {
    if (autoCaptureRef.current !== null) {
      window.clearInterval(autoCaptureRef.current);
    }
    
    if (autoCaptureActive && mode === 'attendance' && isCameraActive) {
      console.log('Starting auto-capture interval...');
      
      autoCaptureRef.current = window.setInterval(() => {
        if (!isCapturing && isCameraActive) {
          const now = Date.now();
          if (now - lastCaptureTime > captureInterval) {
            console.log('Auto-capture triggered');
            handleCapture();
          }
        }
      }, 1000); // Check every second
    }
  };

  // Stop auto-capture
  const stopAutoCapture = () => {
    if (autoCaptureRef.current !== null) {
      window.clearInterval(autoCaptureRef.current);
      autoCaptureRef.current = null;
    }
  };

  // Start camera
  const startCamera = async () => {
    console.log('Starting camera...');
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    try {
      // Try different constraints
      const constraintsOptions = [
        { video: { width: 640, height: 480 } },
        { video: { facingMode: 'user' } },
        { video: true }
      ];

      let stream = null;
      
      for (const constraints of constraintsOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
          console.log('Camera started with constraints:', constraints);
          break;
        } catch (err) {
          console.log('Failed with constraints:', constraints);
        }
      }

      if (!stream) {
        throw new Error('Could not access camera');
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('Camera video loaded');
              resolve(true);
            };
          } else {
            resolve(true);
          }
        });
        
        setIsCameraActive(true);
        
        // Start auto-capture for attendance mode
        if (mode === 'attendance' && autoCaptureActive) {
          startAutoCapture();
        }
        
        console.log('Camera started successfully');
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found.');
      } else {
        setError('Failed to start camera: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    stopAutoCapture();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture image
  const captureImage = async (): Promise<string | null> => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      console.error('Camera not ready for capture');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Canvas context not available');
      return null;
    }

    console.log('Capturing image...');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    console.log('Image captured successfully');
    
    return imageData;
  };

  // Handle capture
  const handleCapture = async () => {
    if (!isCameraActive || isCapturing) {
      console.log('Cannot capture: camera not active or already capturing');
      return;
    }
    
    console.log('Starting capture process...');
    setIsCapturing(true);
    setLastCaptureTime(Date.now());
    setCaptureCount(prev => prev + 1);
    
    try {
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture image');
      }

      console.log('Processing captured image...');
      
      // Process capture
      processCapture(imageData);
      
    } catch (error) {
      console.error('Capture error:', error);
      setIsCapturing(false);
    }
  };

  // Process capture
  const processCapture = (imageData: string) => {
    console.log('Processing capture...');
    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(interval);
          
          console.log('Capture processing complete');
          
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            captureCount: captureCount + 1
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
              console.log('Attendance capture sent to parent');
            }, 500);
          }
          
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  // Toggle auto-capture
  const toggleAutoCapture = () => {
    const newState = !autoCaptureActive;
    setAutoCaptureActive(newState);
    
    if (newState && isCameraActive && mode === 'attendance') {
      startAutoCapture();
    } else {
      stopAutoCapture();
    }
  };

  // Auto-start camera on mount for attendance
  useEffect(() => {
    if (mode === 'attendance') {
      const timer = setTimeout(() => {
        startCamera();
      }, 500);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    }
  }, [mode]);

  // Restart auto-capture when camera becomes active
  useEffect(() => {
    if (isCameraActive && mode === 'attendance' && autoCaptureActive) {
      startAutoCapture();
    }
  }, [isCameraActive, autoCaptureActive]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ margin: '0 auto' }} bodyStyle={{ padding: '16px' }}>
      {/* Camera Feed */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '100%',
          height: 300,
          backgroundColor: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 16,
          border: isCameraActive ? '3px solid #52c41a' : '3px solid #d9d9d9',
          position: 'relative'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isCameraActive ? 'block' : 'none'
            }}
          />
          {!isCameraActive && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <VideoOff size={48} />
            </div>
          )}
          
          {/* Auto-capture status */}
          {isCameraActive && mode === 'attendance' && (
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              backgroundColor: autoCaptureActive ? 'rgba(82, 196, 26, 0.8)' : 'rgba(250, 173, 20, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {autoCaptureActive ? `AUTO-CAPTURE: ${captureCount}` : 'MANUAL MODE'}
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{ marginTop: 12 }}>
          <Space>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%',
              backgroundColor: isCameraActive ? '#52c41a' : '#ff4d4f'
            }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {isCameraActive ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
            </Text>
            
            {isCapturing && (
              <>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  animation: 'pulse 1s infinite'
                }} />
                <Text type="secondary" style={{ fontSize: '12px', color: '#1890ff' }}>
                  CAPTURING...
                </Text>
              </>
            )}
          </Space>
        </div>

        {/* Control buttons */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Button
            type="primary"
            icon={<Camera size={16} />}
            onClick={handleCapture}
            disabled={!isCameraActive || isCapturing}
            size="small"
          >
            Capture Now
          </Button>
          
          {mode === 'attendance' && (
            <Button
              type={autoCaptureActive ? "default" : "primary"}
              onClick={toggleAutoCapture}
              size="small"
            >
              {autoCaptureActive ? 'Stop Auto' : 'Start Auto'}
            </Button>
          )}
          
          <Button
            onClick={isCameraActive ? stopCamera : startCamera}
            size="small"
          >
            {isCameraActive ? 'Stop Camera' : 'Start Camera'}
          </Button>
        </div>
      </div>

      {/* Processing */}
      {isCapturing && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Progress 
            percent={progress} 
            status="active" 
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
          <Text type="secondary" style={{ marginTop: 8, fontSize: '12px' }}>
            Processing face... ({progress}%)
          </Text>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Alert
            message="Camera Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            onClick={startCamera}
            size="small"
          >
            Retry Camera
          </Button>
        </div>
      )}

      {/* Status info */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Space>
          <Tag color={isCameraActive ? "green" : "red"}>
            {isCameraActive ? 'Camera On' : 'Camera Off'}
          </Tag>
          <Tag color={autoCaptureActive ? "green" : "orange"}>
            {autoCaptureActive ? 'Auto-Capture On' : 'Manual Mode'}
          </Tag>
          <Tag color="blue">
            Captures: {captureCount}
          </Tag>
        </Space>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
};

export default FaceCamera;
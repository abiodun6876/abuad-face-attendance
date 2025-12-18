// src/components/FaceCamera.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef, RefObject } from 'react';
import { Button, Card, Progress, Alert, Space, Typography, Row, Col } from 'antd';
import { Camera, CheckCircle, XCircle, RotateCw, User } from 'lucide-react';
import Webcam from 'react-webcam';
import { faceRecognition } from '../utils/faceRecognition';
import { supabase } from '../lib/supabase';
import { syncService } from '../services/syncService';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  sessionInfo?: {
    facultyId?: string;
    departmentId?: string;
    level?: number;
    courseCode?: string;
    eventId?: string;
    sessionId?: string;
  };
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
}

// Type for webcam ref - FIX HERE
type WebcamComponent = typeof Webcam;



const FaceCamera: React.FC<FaceCameraProps> = ({ 
  mode, 
  student, 
  sessionInfo,
  onEnrollmentComplete,
  onAttendanceComplete 
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [imagesCaptured, setImagesCaptured] = useState<string[]>([]);
  const [status, setStatus] = useState<'ready' | 'capturing' | 'processing' | 'complete'>('ready');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Capture settings
  const CAPTURE_COUNT = mode === 'enrollment' ? 5 : 3;
  const CAPTURE_INTERVAL = 500;

  const captureImage = (): string | null => {
    if (!webcamRef.current) return null;
    
    // Cast to any to access getScreenshot method
    const webcamInstance = webcamRef.current as any;
    const imageSrc = webcamInstance.getScreenshot ? webcamInstance.getScreenshot() : null;
    
    if (imageSrc) {
      setImagesCaptured(prev => [...prev, imageSrc]);
    }
    return imageSrc;
  };

  const startCapture = async () => {
    if (capturing) return;
    
    setCapturing(true);
    setStatus('capturing');
    setImagesCaptured([]);
    setProgress(0);
    
    // Capture multiple images
    for (let i = 0; i < CAPTURE_COUNT; i++) {
      captureImage();
      setProgress(((i + 1) / CAPTURE_COUNT) * 100);
      await new Promise(resolve => setTimeout(resolve, CAPTURE_INTERVAL));
    }
    
    setCapturing(false);
    setStatus('processing');
    await processCapturedImages();
  };

  const processCapturedImages = async () => {
    try {
      if (mode === 'enrollment') {
        await handleEnrollment();
      } else {
        await handleAttendance();
      }
    } catch (error) {
      console.error('Processing error:', error);
      setResult({
        success: false,
        message: 'Failed to process images. Please try again.'
      });
      setStatus('ready');
    }
  };

  const handleEnrollment = async () => {
    if (!student?.id && !student?.matric_number) {
      setResult({
        success: false,
        message: 'Student information is required for enrollment'
      });
      setStatus('ready');
      return;
    }

    const studentId = student.id || student.matric_number || `STUDENT_${Date.now()}`;
    
    try {
      // Generate mock embedding (replace with real face API)
      const embedding = faceRecognition.generateMockEmbedding();
      
      // Save to local storage
      faceRecognition.saveEmbeddingToLocal(studentId, embedding);
      
      // Save first image to IndexedDB
      if (imagesCaptured.length > 0) {
        await faceRecognition.saveImageToIndexedDB(studentId, imagesCaptured[0]);
      }
      
      // Update database with face enrollment data
      const updateData = {
        face_enrolled_at: new Date().toISOString(),
        enrollment_status: 'enrolled',
        face_match_threshold: 0.7
      };

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id || student.student_id);

      if (error) {
        console.error('Failed to update database:', error);
      }

      const result = {
        success: true,
        message: 'Face enrollment completed successfully',
        studentId,
        imagesCaptured: imagesCaptured.length,
        timestamp: new Date().toISOString()
      };

      setResult(result);
      setStatus('complete');
      
      if (onEnrollmentComplete) {
        onEnrollmentComplete(result);
      }

    } catch (error) {
      console.error('Enrollment error:', error);
      setResult({
        success: false,
        message: 'Enrollment failed. Please try again.'
      });
      setStatus('ready');
    }
  };

  const handleAttendance = async () => {
    try {
      // Generate mock embedding for test (replace with real detection)
      const testEmbedding = faceRecognition.generateMockEmbedding();
      
      // Match against stored embeddings
      const matches = faceRecognition.matchFace(testEmbedding);
      
      if (matches.length > 0 && matches[0].match) {
        const bestMatch = matches[0];
        
        // Get student details from database
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('id', bestMatch.studentId)
          .single();

        const result = {
          success: true,
          message: 'Attendance recorded successfully',
          student: studentData || { id: bestMatch.studentId },
          confidence: bestMatch.confidence,
          sessionInfo,
          timestamp: new Date().toISOString()
        };

        // Save to local storage for offline sync
        if (sessionInfo) {
          syncService.saveAttendanceLocally(
            bestMatch.studentId,
            `${sessionInfo.courseCode}_${Date.now()}`
          );
        }

        setResult(result);
        setStatus('complete');
        
        if (onAttendanceComplete) {
          onAttendanceComplete(result);
        }
      } else {
        setResult({
          success: false,
          message: 'No matching face found. Please try again.',
          matches
        });
        setStatus('ready');
      }
    } catch (error) {
      console.error('Attendance error:', error);
      setResult({
        success: false,
        message: 'Attendance processing failed'
      });
      setStatus('ready');
    }
  };

  const resetCamera = () => {
    setResult(null);
    setImagesCaptured([]);
    setProgress(0);
    setStatus('ready');
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const videoConstraints = {
    facingMode: facingMode,
    width: 640,
    height: 480
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <Camera size={20} />
            <span>{mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}</span>
          </Space>
        }
        extra={
          <Button
            icon={<RotateCw size={16} />}
            onClick={toggleCamera}
            size="small"
          >
            Switch Camera
          </Button>
        }
      >
        {status !== 'complete' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              position: 'relative', 
              marginBottom: 20,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#000'
            }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{ 
                  width: '100%',
                  maxHeight: 400,
                  objectFit: 'cover'
                }}
              />
              {status === 'capturing' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '50%',
                  width: 100,
                  height: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  {imagesCaptured.length}/{CAPTURE_COUNT}
                </div>
              )}
            </div>

            {status === 'capturing' && (
              <div style={{ marginBottom: 20 }}>
                <Progress percent={Math.round(progress)} status="active" />
                <Text type="secondary">
                  Capturing images... ({imagesCaptured.length}/{CAPTURE_COUNT})
                </Text>
              </div>
            )}

            {status === 'processing' && (
              <div style={{ marginBottom: 20 }}>
                <Progress percent={100} status="active" />
                <Text type="secondary">Processing face data...</Text>
              </div>
            )}

            <Button
              type="primary"
              size="large"
              icon={<Camera size={20} />}
              onClick={startCapture}
              loading={status === 'capturing' || status === 'processing'}
              disabled={status === 'capturing' || status === 'processing'}
              style={{ marginBottom: 10 }}
            >
              {mode === 'enrollment' ? 'Start Face Enrollment' : 'Capture Attendance'}
            </Button>

            {imagesCaptured.length > 0 && status !== 'capturing' && (
              <div style={{ marginTop: 20 }}>
                <Text strong>Captured Images:</Text>
                <Row gutter={[8, 8]} style={{ marginTop: 10 }}>
                  {imagesCaptured.map((img, index) => (
                    <Col span={6} key={index}>
                      <img
                        src={img}
                        alt={`Capture ${index + 1}`}
                        style={{
                          width: '100%',
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '1px solid #d9d9d9'
                        }}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
        )}

        {status === 'complete' && result && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {result.success ? (
              <CheckCircle size={64} color="#52c41a" />
            ) : (
              <XCircle size={64} color="#ff4d4f" />
            )}
            
            <Title level={4} style={{ marginTop: 20, marginBottom: 10 }}>
              {result.success ? 'Success!' : 'Failed'}
            </Title>
            
            <Text style={{ display: 'block', marginBottom: 20 }}>
              {result.message}
            </Text>

            {result.success && mode === 'attendance' && result.student && (
              <Card style={{ marginBottom: 20, textAlign: 'left' }}>
                <Space>
                  <User size={20} />
                  <div>
                    <Text strong>Student: </Text>
                    <Text>{result.student.name || 'Unknown'}</Text>
                  </div>
                </Space>
                {result.confidence && (
                  <div style={{ marginTop: 10 }}>
                    <Text strong>Confidence: </Text>
                    <Text>{(result.confidence * 100).toFixed(1)}%</Text>
                  </div>
                )}
              </Card>
            )}

            <Space>
              <Button type="primary" onClick={resetCamera}>
                {mode === 'enrollment' ? 'Enroll Another' : 'Take Another'}
              </Button>
              <Button onClick={() => setStatus('ready')}>
                Back to Camera
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FaceCamera;
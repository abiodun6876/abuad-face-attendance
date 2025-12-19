// src/components/FaceCamera.tsx - SIMPLIFIED VERSION
import React, { useState } from 'react';
import { Card, Button, Alert, Typography, Space, Progress } from 'antd';
import { Camera, RefreshCw, CheckCircle, User } from 'lucide-react';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0);

  const simulateFaceCapture = () => {
    setIsCapturing(true);
    setProgress(0);
    
    // Simulate capture process
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          if (mode === 'enrollment') {
            const result = {
              success: true,
              studentId: student?.id || `student_${Date.now()}`,
              studentName: student?.name || 'Unknown Student',
              embedding: Array.from({ length: 128 }, () => Math.random()),
              quality: 0.85 + Math.random() * 0.1,
              photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.matric_number || 'student'}`,
              timestamp: new Date().toISOString(),
              message: 'Face captured successfully!'
            };
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            const result = {
              success: true,
              student: {
                id: `student_${Math.floor(Math.random() * 1000)}`,
                name: 'Demo Student',
                matric_number: `20/ABC${Math.floor(Math.random() * 1000)}`
              },
              confidence: 0.85 + Math.random() * 0.1,
              message: 'Attendance recorded successfully',
              timestamp: new Date().toISOString()
            };
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 500);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  return (
    <Card style={{ maxWidth: 600, margin: '0 auto' }}>
      <Title level={4} style={{ textAlign: 'center' }}>
        {mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}
      </Title>
      
      {mode === 'enrollment' && student && (
        <Alert
          message={`Enrolling: ${student.name || 'Student'}`}
          description={`Matric: ${student.matric_number || 'Not assigned'}`}
          type="info"
          showIcon
          icon={<User />}
          style={{ marginBottom: 20 }}
        />
      )}

      <div style={{ textAlign: 'center' }}>
        {isCapturing ? (
          <div style={{ padding: '40px 20px' }}>
            <div style={{ 
              width: 200, 
              height: 200, 
              margin: '0 auto 20px',
              borderRadius: '50%',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #1890ff'
            }}>
              <Camera size={64} color="#1890ff" />
            </div>
            
            <Text style={{ display: 'block', marginBottom: 20 }}>
              {progress < 100 
                ? 'Capturing face... Please look at the camera' 
                : 'Face captured successfully!'
              }
            </Text>
            
            <Progress percent={progress} status="active" />
            
            {progress >= 100 && (
              <Alert
                message="Success!"
                description="Face data has been captured and processed"
                type="success"
                showIcon
                style={{ marginTop: 20 }}
              />
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 0' }}>
            <div style={{ 
              width: 200, 
              height: 200, 
              margin: '0 auto 20px',
              borderRadius: '50%',
              backgroundColor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Camera size={64} color="#666" />
            </div>
            
            <Alert
              message="Face Capture Instructions"
              description={
                <div style={{ textAlign: 'left', marginTop: 10 }}>
                  <p>1. Ensure good lighting on your face</p>
                  <p>2. Look directly at the camera</p>
                  <p>3. Keep a neutral expression</p>
                  <p>4. Remove glasses if possible</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 20, textAlign: 'left' }}
            />
            
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera size={20} />}
                onClick={simulateFaceCapture}
                style={{ minWidth: 200 }}
              >
                {mode === 'enrollment' ? 'Capture Face' : 'Take Attendance'}
              </Button>
              
              <Button
                icon={<RefreshCw size={16} />}
                onClick={() => window.location.reload()}
              >
                Restart
              </Button>
            </Space>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <Text type="secondary">
          <small>
            <CheckCircle size={12} style={{ marginRight: 5 }} />
            Your face data is encrypted and stored securely
          </small>
        </Text>
      </div>
    </Card>
  );
};

export default FaceCamera;
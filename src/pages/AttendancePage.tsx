// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  message, 
  Progress,
  Badge,
  Space,
  Tag,
  Spin
} from 'antd';
import { Camera, CheckCircle, XCircle, Play, StopCircle } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import faceRecognition from '../utils/faceRecognition';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

interface MatchResult {
  studentId: string;
  name: string;
  matric_number: string;
  confidence: number;
}

const AttendancePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bestMatch, setBestMatch] = useState<MatchResult | null>(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [presentToday, setPresentToday] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false); // Start with auto-scan disabled
  const [isScanning, setIsScanning] = useState(false);

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        setShowCamera(false);
        
        await faceRecognition.loadModels();
        
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
        
        setShowCamera(true);
        loadTodayCount();
      } catch (error) {
        console.error('Failed to load face models:', error);
        message.warning('Face recognition models not loaded. Attendance may not work properly.');
      }
    };

    loadModels();
  }, []);

  // Load today's attendance count
  const loadTodayCount = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      setPresentToday(count || 0);
    } catch (error) {
      console.error('Error loading count:', error);
    }
  };

  const handleAttendanceComplete = async (result: { success: boolean; photoData?: { base64: string } }) => {
    if (!autoScanEnabled) {
      return;
    }

    if (!result.success || !result.photoData) {
      message.error('Failed to capture photo');
      return;
    }

    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet');
      return;
    }

    setIsScanning(true);
    setLoading(true);
    setProcessing(true);
    setBestMatch(null);
    setShowCamera(false);

    try {
      const faceDescriptor = await faceRecognition.extractFaceDescriptor(result.photoData.base64);
      
      if (!faceDescriptor) {
        message.warning('No face detected');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setIsScanning(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      if (foundMatches.length === 0) {
        message.warning('No matching student found');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setIsScanning(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      const topMatch = foundMatches[0];
      setBestMatch(topMatch);
      
      if (topMatch.confidence > 0.7) {
        await autoMarkAttendance(topMatch);
      } else {
        setProcessing(false);
        setLoading(false);
        setIsScanning(false);
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      message.error(`Error: ${error.message}`);
      setProcessing(false);
      setLoading(false);
      setIsScanning(false);
      setShowCamera(true);
    }
  };

  const autoMarkAttendance = async (match: MatchResult) => {
    try {
      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0];
      const attendanceTime = now.toTimeString().split(' ')[0];
      
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('matric_number', match.matric_number)
        .eq('date', attendanceDate)
        .maybeSingle();

      if (existingAttendance) {
        message.warning(`${match.name} already marked today`);
        setAttendanceMarked(true);
        setTimeout(() => resetToCamera(), 3000);
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .insert([{
          student_id: match.studentId,
          matric_number: match.matric_number,
          name: match.name,
          date: attendanceDate,
          time: attendanceTime,
          status: 'present',
          method: 'face_recognition',
          confidence: match.confidence,
          created_at: now.toISOString()
        }]);

      if (error) throw error;

      message.success(`✅ ${match.name}`);
      setAttendanceMarked(true);
      setPresentToday(prev => prev + 1);
      
      setTimeout(() => resetToCamera(), 3000);
      
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      message.error(`Failed to mark attendance: ${error.message}`);
      resetToCamera();
    }
  };

  const resetToCamera = () => {
    setBestMatch(null);
    setAttendanceMarked(false);
    setProcessing(false);
    setLoading(false);
    setIsScanning(false);
    setShowCamera(true);
  };

  // Toggle auto-scan
  const toggleAutoScan = () => {
    const newState = !autoScanEnabled;
    setAutoScanEnabled(newState);
    setIsScanning(false);
    message.info(`Auto-scan ${newState ? 'started' : 'stopped'}`);
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#0a0e17',
      color: 'white',
      padding: 0,
      margin: 0,
      overflow: 'hidden'
    }}>
      {/* Loading Screen */}
      {!modelsLoaded && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0e17'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" style={{ marginBottom: 24, color: '#1890ff' }} />
            <Title level={3} style={{ color: 'white', marginBottom: 16 }}>
              Loading Face Recognition...
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
              Initializing system
            </Text>
          </div>
        </div>
      )}

      {/* Camera View */}
      {showCamera && modelsLoaded && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Top Bar - Minimal */}
          <div style={{ 
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Left - Status Indicator */}
            <Badge 
              status={autoScanEnabled ? "success" : "warning"}
              text={
                <Text style={{ 
                  color: autoScanEnabled ? '#52c41a' : '#faad14',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}>
                  {autoScanEnabled ? "SCANNING" : "READY"}
                </Text>
              } 
            />

            {/* Center - Attendance Counter Square */}
            <div style={{ 
              width: 65,
              height: 65,
              borderRadius: '8px',
              backgroundColor: 'rgba(82, 196, 26, 0.1)',
              border: '2px solid #52c41a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <Text style={{ 
                color: '#52c41a', 
                fontSize: 24,
                fontWeight: 'bold',
                lineHeight: '26px'
              }}>
                {presentToday}
              </Text>
              <Text style={{ 
                color: 'rgba(255, 255, 255, 0.6)', 
                fontSize: 10,
                marginTop: 2
              }}>
                PRESENT
              </Text>
            </div>

            {/* Right - Control Buttons */}
            <Space>
              {autoScanEnabled ? (
                <Button
                  type="primary"
                  danger
                  onClick={toggleAutoScan}
                  icon={<StopCircle size={16} />}
                  size="small"
                  style={{ 
                    padding: '6px 16px',
                    fontSize: 12,
                    height: 'auto'
                  }}
                >
                  STOP
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={toggleAutoScan}
                  icon={<Play size={16} />}
                  size="small"
                  style={{ 
                    padding: '6px 16px',
                    fontSize: 12,
                    height: 'auto'
                  }}
                >
                  START
                </Button>
              )}
            </Space>
          </div>

          {/* Main Camera Area - No scrolling */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            backgroundColor: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ 
              width: '100%',
              height: '100%',
              position: 'relative'
            }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleAttendanceComplete}
                autoCapture={autoScanEnabled}
                captureInterval={2000}
                loading={loading}
              />
              
              {/* Face Guide Square */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 300,
                height: 300,
                borderRadius: '12px',
                border: '2px dashed rgba(255, 255, 255, 0.4)',
                pointerEvents: 'none',
                boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.4)'
              }}>
                {loading && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    width: '100%'
                  }}>
                    <Spin size="large" style={{ color: '#1890ff' }} />
                    <Text style={{ 
                      color: 'white', 
                      marginTop: 16,
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}>
                      SCANNING...
                    </Text>
                  </div>
                )}
                
                {/* Dotted corners */}
                <div style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  width: 20,
                  height: 20,
                  borderTop: '3px dotted rgba(255, 255, 255, 0.6)',
                  borderLeft: '3px dotted rgba(255, 255, 255, 0.6)'
                }} />
                <div style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  borderTop: '3px dotted rgba(255, 255, 255, 0.6)',
                  borderRight: '3px dotted rgba(255, 255, 255, 0.6)'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  left: -2,
                  width: 20,
                  height: 20,
                  borderBottom: '3px dotted rgba(255, 255, 255, 0.6)',
                  borderLeft: '3px dotted rgba(255, 255, 255, 0.6)'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  borderBottom: '3px dotted rgba(255, 255, 255, 0.6)',
                  borderRight: '3px dotted rgba(255, 255, 255, 0.6)'
                }} />
              </div>

              {/* Bottom Status Bar */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Left - Status */}
                <Space>
                  <Tag color={autoScanEnabled ? "green" : "default"} style={{ margin: 0, fontSize: 11 }}>
                    {autoScanEnabled ? "AUTO ON" : "AUTO OFF"}
                  </Tag>
                  <Tag color={modelsLoaded ? "success" : "warning"} style={{ margin: 0, fontSize: 11 }}>
                    {modelsLoaded ? "READY" : "LOADING"}
                  </Tag>
                </Space>

                {/* Center - Instruction */}
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 12,
                  fontWeight: '500'
                }}>
                  {autoScanEnabled ? "Face detection active" : "Press START to begin"}
                </Text>

                {/* Right - Empty for balance */}
                <div style={{ width: 60 }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing/Results View - No scrolling */}
      {!showCamera && modelsLoaded && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0e17',
          overflow: 'hidden'
        }}>
          {processing ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 160, 
                height: 160, 
                position: 'relative',
                margin: '0 auto 24px'
              }}>
                <Progress
                  type="circle"
                  percent={75}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': '#52c41a',
                  }}
                  size={160}
                  strokeWidth={6}
                  format={() => (
                    <div style={{ fontSize: 28, color: '#1890ff' }}>
                      <Camera size={32} />
                    </div>
                  )}
                />
              </div>
              <Title level={3} style={{ color: 'white', marginBottom: 12 }}>
                PROCESSING...
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
                Recognizing face
              </Text>
            </div>
          ) : attendanceMarked ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                borderRadius: '50%', 
                backgroundColor: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 0 30px rgba(82, 196, 26, 0.4)'
              }}>
                <CheckCircle size={60} color="white" />
              </div>
              <Title level={3} style={{ color: '#52c41a', marginBottom: 8 }}>
                SUCCESS
              </Title>
              {bestMatch && (
                <>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 18, marginBottom: 4 }}>
                    {bestMatch.name}
                  </Text>
                  <Tag color="blue" style={{ fontSize: 14, padding: '6px 12px', marginBottom: 16 }}>
                    {bestMatch.matric_number}
                  </Tag>
                </>
              )}
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
                Returning in 3 seconds...
              </Text>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                borderRadius: '50%', 
                backgroundColor: '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <XCircle size={60} color="white" />
              </div>
              <Title level={3} style={{ color: '#ff4d4f', marginBottom: 12 }}>
                NO MATCH
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, marginBottom: 24 }}>
                Face not recognized
              </Text>
              <Button
                type="primary"
                onClick={resetToCamera}
                style={{ 
                  padding: '8px 24px',
                  fontSize: 14
                }}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
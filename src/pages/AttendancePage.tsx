// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  message, 
  Row, 
  Col, 
  Tag, 
  Spin,
  Space,
  Alert,
  Modal,
  Statistic,
  Progress,
  Badge,
  Divider
} from 'antd';
import { 
  Camera, 
  UserCheck, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Scan,
  Shield,
  Zap
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import faceRecognition from '../utils/faceRecognition';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Countdown } = Statistic;

interface MatchResult {
  studentId: string;
  name: string;
  matric_number: string;
  confidence: number;
}

interface AttendanceStats {
  totalEnrolled: number;
  totalPresent: number;
  recognitionRate: number;
}

const AttendancePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bestMatch, setBestMatch] = useState<MatchResult | null>(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [stats, setStats] = useState<AttendanceStats>({
    totalEnrolled: 0,
    totalPresent: 0,
    recognitionRate: 0
  });

  // Load face recognition models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        await faceRecognition.loadModels();
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
        loadStats();
      } catch (error) {
        console.error('Failed to load face models:', error);
        message.warning('Face recognition models not loaded. Attendance may not work properly.');
      }
    };

    loadModels();
  }, []);

  // Load attendance statistics
const loadStats = async () => {
  try {
    // Get total enrolled students - FIXED
    const { count: totalEnrolled, error: studentsError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_status', 'enrolled');

    // Get today's attendance count - FIXED
    const today = new Date().toISOString().split('T')[0];
    const { count: totalPresent, error: attendanceError } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    if (!studentsError && !attendanceError) {
      const recognitionRate = (totalEnrolled || 0) > 0 
        ? ((totalPresent || 0) / (totalEnrolled || 0)) * 100 
        : 0;

      setStats({
        totalEnrolled: totalEnrolled || 0,
        totalPresent: totalPresent || 0,
        recognitionRate
      });
    } else {
      console.error('Error loading stats:', studentsError || attendanceError);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

  const handleAttendanceComplete = async (result: { success: boolean; photoData?: { base64: string } }) => {
    if (!result.success || !result.photoData) {
      message.error('Failed to capture photo');
      return;
    }

    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet. Please wait...');
      return;
    }

    setLoading(true);
    setProcessing(true);
    setScanCount(prev => prev + 1);
    setBestMatch(null);
    setShowResults(true);

    try {
      console.log('Finding face matches...');
      
      // Find matches
      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      if (foundMatches.length === 0) {
        message.warning('No matching student found. Please try again or enroll the student.');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
        }, 1500);
        return;
      }

      // Get the best match (highest confidence)
      const topMatch = foundMatches[0];
      setBestMatch(topMatch);
      
      // Auto-mark attendance if confidence is high enough
      if (topMatch.confidence > 0.8) {
        await autoMarkAttendance(topMatch);
      } else {
        // If confidence is medium, show confirmation
        message.info(`Medium confidence match found (${(topMatch.confidence * 100).toFixed(1)}%). Please verify.`);
      }
      
    } catch (error: any) {
      console.error('Error matching face:', error);
      message.error(`Recognition error: ${error.message}`);
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const autoMarkAttendance = async (match: MatchResult) => {
    try {
      // Get current date and time
      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0];
      const attendanceTime = now.toTimeString().split(' ')[0];
      
      // Check if already marked today
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('matric_number', match.matric_number)
        .eq('date', attendanceDate)
        .maybeSingle();

      if (existingAttendance) {
        message.warning(`${match.name} already marked attendance today at ${existingAttendance.time}`);
        setAttendanceMarked(true);
        setTimeout(() => resetSession(), 3000);
        return;
      }

      // Mark attendance
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
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      message.success(`✅ Attendance marked for ${match.name} at ${attendanceTime}`);
      setAttendanceMarked(true);
      
      // Update stats
      loadStats();
      
      // Reset after 3 seconds
      setTimeout(() => resetSession(), 3000);
      
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      message.error(`Failed to mark attendance: ${error.message}`);
    }
  };

  const resetSession = () => {
    setBestMatch(null);
    setAttendanceMarked(false);
    setShowResults(false);
    setProcessing(false);
  };

  const manualMarkAttendance = async () => {
    if (!bestMatch) return;
    await autoMarkAttendance(bestMatch);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Space direction="vertical" size="middle">
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 32px',
            backgroundColor: '#001529',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0, 21, 41, 0.2)'
          }}>
            <Shield size={36} color="#1890ff" />
            <Title level={2} style={{ margin: 0, color: 'white' }}>
              ABUAD FACE AUTH
            </Title>
          </div>
          
          <Space size={32}>
            <Statistic 
              title="Enrolled Students" 
              value={stats.totalEnrolled}
              prefix={<Users size={16} />}
            />
            <Statistic 
              title="Present Today" 
              value={stats.totalPresent}
              valueStyle={{ color: '#52c41a' }}
              prefix={<UserCheck size={16} />}
            />
            <Statistic 
              title="Recognition Rate" 
              value={stats.recognitionRate.toFixed(1)}
              suffix="%"
              prefix={<CheckCircle size={16} />}
            />
          </Space>
        </Space>
      </div>

      <Row gutter={32}>
        {/* Left Column - Camera */}
        <Col xs={24} md={12}>
          <Card 
            bordered={false}
            style={{ 
              height: '100%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              borderRadius: 16
            }}
            bodyStyle={{ padding: 24 }}
          >
            <div style={{ marginBottom: 24 }}>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Camera size={24} color="#1890ff" />
                <Title level={4} style={{ margin: 0 }}>Face Scanner</Title>
                <Tag color={modelsLoaded ? "success" : "warning"} icon={modelsLoaded ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}>
                  {modelsLoaded ? "System Ready" : "Initializing..."}
                </Tag>
              </Space>
              <Text type="secondary">Position your face in the frame. The system will auto-capture and recognize.</Text>
            </div>

            {/* Camera Preview */}
            <div style={{ 
              height: 350, 
              borderRadius: 12, 
              overflow: 'hidden',
              backgroundColor: '#000',
              marginBottom: 24,
              position: 'relative',
              border: '2px solid #f0f0f0'
            }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleAttendanceComplete}
                autoCapture={true}
                captureInterval={2000}
                loading={loading || processing}
              />
              
              {/* Overlay Status */}
              {processing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  zIndex: 10
                }}>
                  <Spin size="large" style={{ marginBottom: 16 }} />
                  <Title level={4} style={{ color: 'white', marginBottom: 8 }}>
                    PROCESSING...
                  </Title>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Recognizing face features
                  </Text>
                </div>
              )}
            </div>

            {/* Scan Counter */}
            <div style={{ 
              backgroundColor: '#fafafa',
              padding: '16px',
              borderRadius: 8,
              marginBottom: 16
            }}>
              <Space size="large" align="center">
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Auto-Scan</Text>
                  <Title level={3} style={{ margin: 0, color: '#1890ff' }}>{scanCount}</Title>
                </div>
                <Divider type="vertical" style={{ height: 40 }} />
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>System Status</Text>
                  <Space>
                    <Badge status={modelsLoaded ? "success" : "processing"} />
                    <Text>{modelsLoaded ? "Face Recognition Ready" : "Loading Models..."}</Text>
                  </Space>
                </div>
              </Space>
            </div>

            {bestMatch && !attendanceMarked && (
              <Button 
                type="primary" 
                size="large" 
                block
                onClick={manualMarkAttendance}
                icon={<CheckCircle size={18} />}
                style={{ height: 50, fontSize: 16 }}
              >
                Confirm & Mark Attendance
              </Button>
            )}
          </Card>
        </Col>

        {/* Right Column - Results */}
        <Col xs={24} md={12}>
          <Card 
            bordered={false}
            style={{ 
              height: '100%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              borderRadius: 16
            }}
            bodyStyle={{ padding: 24 }}
          >
            <div style={{ marginBottom: 24 }}>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Scan size={24} color="#52c41a" />
                <Title level={4} style={{ margin: 0 }}>Recognition Results</Title>
                {bestMatch && (
                  <Tag color={bestMatch.confidence > 0.8 ? "success" : "warning"}>
                    {bestMatch.confidence > 0.8 ? "High Confidence" : "Medium Confidence"}
                  </Tag>
                )}
              </Space>
              <Text type="secondary">
                {bestMatch ? "Student identified successfully" : "Awaiting face scan..."}
              </Text>
            </div>

            {processing ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 24px' }}>
                  <Progress
                    type="circle"
                    percent={75}
                    strokeColor={{
                      '0%': '#1890ff',
                      '100%': '#52c41a',
                    }}
                    size={120}
                    format={() => (
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                        <Zap size={24} />
                      </div>
                    )}
                  />
                </div>
                <Title level={3} style={{ marginBottom: 8 }}>Analyzing Face</Title>
                <Text type="secondary">Comparing with database...</Text>
              </div>
            ) : attendanceMarked ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  backgroundColor: '#f6ffed',
                  border: '4px solid #b7eb8f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <CheckCircle size={48} color="#52c41a" />
                </div>
                <Title level={3} style={{ marginBottom: 8, color: '#52c41a' }}>
                  Attendance Marked!
                </Title>
                <Text type="secondary" style={{ marginBottom: 24 }}>
                  Student verified and attendance recorded
                </Text>
                <Countdown 
                  title="Next scan in" 
                  value={Date.now() + 3000} 
                  format="ss" 
                  onFinish={resetSession}
                  valueStyle={{ fontSize: 28, color: '#1890ff' }}
                />
              </div>
            ) : bestMatch ? (
              <div style={{ 
                backgroundColor: '#fafafa',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center'
              }}>
                {/* Confidence Meter */}
                <div style={{ marginBottom: 32 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Recognition Confidence
                  </Text>
                  <Progress
                    percent={bestMatch.confidence * 100}
                    strokeColor={bestMatch.confidence > 0.8 ? '#52c41a' : '#faad14'}
                    format={percent => `${percent?.toFixed(1)}%`}
                    size={['100%', 16]}
                  />
                  <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                    {bestMatch.confidence > 0.8 
                      ? "High confidence match - Auto-marked ✓" 
                      : "Please verify the student"}
                  </Text>
                </div>

                {/* Student Info Card */}
                <div style={{ 
                  backgroundColor: 'white',
                  borderRadius: 8,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  marginBottom: 24
                }}>
                  <div style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    backgroundColor: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: 'white',
                    fontSize: 32,
                    fontWeight: 'bold'
                  }}>
                    {bestMatch.name.charAt(0)}
                  </div>
                  
                  <Title level={3} style={{ marginBottom: 8 }}>
                    {bestMatch.name}
                  </Title>
                  
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                        {bestMatch.matric_number}
                      </Tag>
                    </div>
                    <Text type="secondary">Student ID: {bestMatch.studentId}</Text>
                  </Space>
                </div>

                {/* Status Info */}
                <Alert
                  message={
                    bestMatch.confidence > 0.8 
                      ? "✓ Auto-attendance marked successfully"
                      : "Please verify student identity before marking attendance"
                  }
                  type={bestMatch.confidence > 0.8 ? "success" : "info"}
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </div>
            ) : showResults ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  backgroundColor: '#fff2f0',
                  border: '4px solid #ffccc7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <AlertTriangle size={48} color="#ff4d4f" />
                </div>
                <Title level={3} style={{ marginBottom: 8, color: '#ff4d4f' }}>
                  No Match Found
                </Title>
                <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                  The face was not recognized in our database.
                </Text>
                <Space>
                  <Button 
                    type="primary" 
                    onClick={resetSession}
                    icon={<Camera size={16} />}
                  >
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/enrollment'}
                    icon={<UserCheck size={16} />}
                  >
                    Enroll Student
                  </Button>
                </Space>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  backgroundColor: '#f0f5ff',
                  border: '4px solid #d6e4ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <Scan size={48} color="#1890ff" />
                </div>
                <Title level={3} style={{ marginBottom: 8 }}>
                  Ready for Scan
                </Title>
                <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                  {modelsLoaded 
                    ? 'Position your face in front of the camera for automatic recognition' 
                    : 'Loading face recognition models...'}
                </Text>
                {!modelsLoaded && (
                  <Spin size="large" style={{ marginBottom: 16 }} />
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Quick Actions Footer */}
      <div style={{ 
        marginTop: 32, 
        padding: '20px 24px', 
        backgroundColor: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>Quick Actions:</Text>
          <Button 
            icon={<UserCheck size={16} />} 
            onClick={() => window.location.href = '/enrollment'}
          >
            Enroll Student
          </Button>
          <Button 
            icon={<Users size={16} />} 
            onClick={async () => {
              const { data: todayAttendance } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', new Date().toISOString().split('T')[0])
                .order('time', { ascending: false });
              
              Modal.info({
                title: `Today's Attendance (${todayAttendance?.length || 0} students)`,
                width: 800,
                content: (
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    {todayAttendance?.map((record, index) => (
                      <div key={index} style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Space>
                          <div style={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            backgroundColor: '#1890ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {record.name.charAt(0)}
                          </div>
                          <div>
                            <Text strong>{record.name}</Text>
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {record.matric_number} • {record.time}
                              </Text>
                            </div>
                          </div>
                        </Space>
                        <Tag color="success">Present</Tag>
                      </div>
                    ))}
                  </div>
                ),
              });
            }}
          >
            View Today's Attendance
          </Button>
        </Space>
        
        <Space>
          <Button 
            type="text" 
            icon={<Clock size={16} />}
            onClick={() => {
              const now = new Date();
              Modal.info({
                title: 'System Time',
                content: (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <Title level={2}>{now.toLocaleTimeString()}</Title>
                    <Text type="secondary">{now.toLocaleDateString()}</Text>
                  </div>
                ),
              });
            }}
          >
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AttendancePage;
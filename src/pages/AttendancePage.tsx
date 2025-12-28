// src/pages/AttendancePage.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Statistic,
  Modal,
  InputNumber,
  message,
  Grid,
  DatePicker,
  Tabs,
  Progress,
  Badge,
  Divider,
  Descriptions,
  Image
} from 'antd';
import { Camera, Calendar, CheckCircle, XCircle, Users, User, RefreshCw } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { TabPane } = Tabs;

const AttendancePage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseData, setSelectedCourseData] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [scoreInputValue, setScoreInputValue] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('attendance');
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    attendanceRate: 0
  });
  
  // Face recognition result state
  const [faceResult, setFaceResult] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string>('Ready to capture');
  const [matchedStudentData, setMatchedStudentData] = useState<any>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);

  // Fetch all courses
  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('code');
      
      if (error) throw error;
      setCourses(data || []);
      console.log('Courses loaded:', data?.length);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      message.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance records for selected course and date
  const fetchAttendanceRecords = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoading(true);
      const course = courses.find(c => c.id === selectedCourse);
      if (!course) {
        message.error('Course not found');
        return;
      }
      setSelectedCourseData(course);
      
      // Fetch attendance for this course on selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('course_code', course.code)
        .eq('attendance_date', selectedDate)
        .order('check_in_time', { ascending: false });
      
      if (attendanceError) throw attendanceError;
      
      setAttendanceRecords(attendanceData || []);
      
      // Fetch all enrolled students to get total count
      const { data: studentsData } = await supabase
        .from('students')
        .select('student_id')
        .eq('enrollment_status', 'enrolled');
      
      const totalStudents = studentsData?.length || 0;
      const presentToday = attendanceData?.length || 0;
      const attendanceRate = totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;
      
      setStats({
        totalStudents,
        presentToday,
        attendanceRate
      });
      
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, result: any) => {
    try {
      const attendanceDate = selectedDate;
      const studentId = studentData.student_id;
      const studentName = studentData.name;
      const matricNumber = studentData.matric_number;
      
      console.log('Recording attendance for:', studentName, studentId, matricNumber);
      
      // Check if attendance already exists for today and this course
      const { data: existingAttendance, error: fetchError } = await supabase
        .from('student_attendance')
        .select('id, score')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      
      if (existingAttendance) {
        // Update existing attendance
        const { error } = await supabase
          .from('student_attendance')
          .update({
            check_in_time: new Date().toISOString(),
            verification_method: 'face_recognition',
            confidence_score: result.confidence || 0.95,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
        message.success(`Attendance updated for ${studentName}`);
      } else {
        // Create new attendance record
        const attendanceData = {
          student_id: studentId,
          student_name: studentName,
          matric_number: matricNumber,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: studentData.level || selectedCourseData.level,
          attendance_date: attendanceDate,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'face_recognition',
          confidence_score: result.confidence || 0.95,
          score: 2.00,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('Inserting attendance record:', attendanceData);
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
        message.success(`Attendance recorded for ${studentName}`);
      }
      
      // Refresh attendance records
      fetchAttendanceRecords();
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Process students who don't have embeddings yet
  const processMissingEmbeddings = async () => {
    try {
      setLoading(true);
      message.info('Processing face data for students...');
      
      // Get students with photos but no embeddings
      const { data: studentsWithoutEmbeddings } = await supabase
        .from('students')
        .select('student_id, name, photo_data')
        .eq('enrollment_status', 'enrolled')
        .not('photo_data', 'is', null)
        .is('face_embedding', null)
        .limit(10);
      
      if (!studentsWithoutEmbeddings || studentsWithoutEmbeddings.length === 0) {
        message.success('All enrolled students already have face embeddings');
        return 0;
      }
      
      console.log(`Processing ${studentsWithoutEmbeddings.length} students for embeddings...`);
      let processedCount = 0;
      let failedCount = 0;
      
      for (const student of studentsWithoutEmbeddings) {
        try {
          // Extract face embedding from photo
          const descriptor = await faceRecognition.extractFaceDescriptor(
            `data:image/jpeg;base64,${student.photo_data}`
          );
          
          if (descriptor) {
            // Save to database
            const embeddingArray = Array.from(descriptor);
            await supabase
              .from('students')
              .update({
                face_embedding: embeddingArray,
                last_face_update: new Date().toISOString()
              })
              .eq('student_id', student.student_id);
            
            processedCount++;
            console.log(`✅ Processed: ${student.name}`);
          } else {
            console.log(`⚠️ No face detected in photo for: ${student.name}`);
            failedCount++;
          }
          
          // Small delay to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`❌ Failed for ${student.name}:`, error);
          failedCount++;
        }
      }
      
      console.log(`Embeddings processed: ${processedCount}/${studentsWithoutEmbeddings.length}`);
      
      if (processedCount > 0) {
        message.success(`Processed ${processedCount} students for face recognition`);
      }
      if (failedCount > 0) {
        message.warning(`${failedCount} students could not be processed (no face detected)`);
      }
      
      return processedCount;
      
    } catch (error) {
      console.error('Error processing embeddings:', error);
      message.error('Failed to process embeddings');
      return 0;
    } finally {
      setLoading(false);
    }
  };

  // Handle face capture status
  const handleFaceCaptureStatus = (status: any) => {
    if (status.isCapturing) {
      setIsCapturing(true);
      setCaptureStatus('Capturing...');
    } else if (status.message) {
      setCaptureStatus(status.message);
    }
    
    // Update if camera is active
    if (status.cameraActive !== undefined) {
      // Camera status is handled by isCameraActive state
    }
  };

  // Start camera function with face recognition initialization
  const startFaceAttendance = async () => {
    setIsCameraActive(true);
    setFaceResult(null);
    setMatchedStudentData(null);
    setCaptureStatus('Initializing face recognition...');
    
    try {
      // Pre-load face recognition models
      if (!faceModelsLoaded) {
        setCaptureStatus('Loading face recognition models...');
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
        console.log('Face recognition models loaded');
      }
      
      setCaptureStatus('Camera is active. Make sure face is clearly visible.');
      
    } catch (error) {
      console.warn('Failed to load face models:', error);
      setCaptureStatus('Face recognition unavailable. Using basic capture.');
      message.warning('Face recognition not available. Will use basic photo capture.');
    }
  };

  // Stop camera function
  const stopCamera = () => {
    setIsCameraActive(false);
    setFaceResult(null);
    setMatchedStudentData(null);
    setIsCapturing(false);
    setCaptureStatus('Ready to capture');
  };

  // ========== ACTUAL FACE RECOGNITION HANDLER ==========
  const handleAttendanceComplete = async (result: any) => {
    console.log('Face capture result:', result);
    
    // Update face result state
    setFaceResult(result);
    
    if (result.success && result.photoUrl) {
      setCaptureStatus('Processing face recognition...');
      setMatchedStudentData(null);
      setIsCapturing(true);
      
      try {
        if (!selectedCourseData) {
          message.error('Please select a course first');
          setCaptureStatus('Select a course first');
          setIsCapturing(false);
          return;
        }
        
        console.log('Starting face recognition matching...');
        
        // ========== ACTUAL FACE RECOGNITION ==========
        // 1. Use face recognition to find matching students
        const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
        console.log('Face matches found:', matches);
        
        if (matches.length === 0) {
          setCaptureStatus('No matching student found');
          
          // Check if students need embeddings
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('enrollment_status', 'enrolled')
            .not('photo_data', 'is', null)
            .is('face_embedding', null);
          
          if (count && count > 0) {
            message.warning(`No match found. ${count} students need face data processing.`);
          } else {
            message.error('No student match found. Please enroll student first or try again.');
          }
          
          setIsCapturing(false);
          return;
        }
        
        // 2. Get the best match (highest confidence)
        const bestMatch = matches[0];
        console.log('Best match:', bestMatch);
        
        // Check confidence threshold
        const CONFIDENCE_THRESHOLD = 0.65;
        if (bestMatch.confidence < CONFIDENCE_THRESHOLD) {
          setCaptureStatus('Match confidence too low');
          message.warning(`Match found but confidence is low (${(bestMatch.confidence * 100).toFixed(1)}%). Try again.`);
          setIsCapturing(false);
          return;
        }
        
        // 3. Get full student data from database
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', bestMatch.studentId)
          .eq('enrollment_status', 'enrolled')
          .maybeSingle();
        
        if (studentError) {
          console.error('Database error:', studentError);
          setCaptureStatus('Database error');
          message.error(`Database error: ${studentError.message}`);
          setIsCapturing(false);
          return;
        }
        
        if (!studentData) {
          setCaptureStatus('Student not enrolled');
          message.error('Matched student is not enrolled');
          setIsCapturing(false);
          return;
        }
        
        // 4. Store the matched student data
        setMatchedStudentData(studentData);
        
        // 5. Update face result with match details
        setFaceResult({
          ...result,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number,
            student_id: studentData.student_id
          },
          confidence: bestMatch.confidence,
          success: true
        });
        
        setCaptureStatus('Student identified!');
        message.success(`Identified: ${studentData.name} (${(bestMatch.confidence * 100).toFixed(1)}% confidence)`);
        
        // 6. Record attendance
        await recordAttendance(studentData, {
          confidence: bestMatch.confidence,
          photoUrl: result.photoUrl
        });
        
        // 7. Update capture status
        setCaptureStatus('Attendance recorded!');
        
      } catch (error: any) {
        console.error('Face recognition error:', error);
        
        // Check for specific errors
        if (error.message?.includes('models not loaded') || error.message?.includes('loadModels')) {
          setCaptureStatus('Loading face models...');
          message.warning('Loading face recognition models. Please wait...');
          
          // Try to load models and retry
          try {
            await faceRecognition.loadModels();
            setFaceModelsLoaded(true);
            // Retry after models load
            setTimeout(() => handleAttendanceComplete(result), 1000);
          } catch (loadError) {
            setCaptureStatus('Face recognition unavailable');
            message.error('Face recognition failed to load. Please try manual attendance.');
            setIsCapturing(false);
          }
        } else {
          setCaptureStatus('Face recognition error');
          message.error(`Face recognition error: ${error.message}`);
          setIsCapturing(false);
        }
      }
    } else {
      setCaptureStatus('Capture Failed');
      message.error(`Face capture failed: ${result.message || 'Unknown error'}`);
      setIsCapturing(false);
    }
    
    // Auto-hide result after 8 seconds (give time to see results)
    setTimeout(() => {
      setFaceResult(null);
      setCaptureStatus('Ready to capture');
      setMatchedStudentData(null);
      setIsCapturing(false);
    }, 8000);
  };

  // Handle mark all present
  const handleMarkAllPresent = async () => {
    if (!selectedCourseData) {
      message.error('Please select a course first');
      return;
    }
    
    Modal.confirm({
      title: 'Mark All Present',
      content: `Are you sure you want to mark all enrolled students as present for ${selectedCourseData.title}?`,
      onOk: async () => {
        setLoading(true);
        try {
          const attendanceDate = selectedDate;
          
          // Get all enrolled students
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('student_id, name, matric_number, level')
            .eq('enrollment_status', 'enrolled');
          
          if (studentsError) throw studentsError;
          
          if (!studentsData || studentsData.length === 0) {
            message.warning('No enrolled students found');
            return;
          }
          
          // Get already marked students for this course and date
          const { data: existingAttendance } = await supabase
            .from('student_attendance')
            .select('student_id')
            .eq('course_code', selectedCourseData.code)
            .eq('attendance_date', attendanceDate);
          
          const markedStudentIds = new Set(existingAttendance?.map(a => a.student_id) || []);
          
          // Create attendance records for unmarked students
          const attendanceRecords = studentsData
            .filter(student => !markedStudentIds.has(student.student_id))
            .map(student => ({
              student_id: student.student_id,
              student_name: student.name,
              matric_number: student.matric_number,
              course_code: selectedCourseData.code,
              course_title: selectedCourseData.title,
              level: student.level || selectedCourseData.level,
              attendance_date: attendanceDate,
              check_in_time: new Date().toISOString(),
              status: 'present',
              verification_method: 'batch',
              score: 2.00,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          
          if (attendanceRecords.length > 0) {
            const { error } = await supabase
              .from('student_attendance')
              .insert(attendanceRecords);
            
            if (error) throw error;
          }
          
          message.success(`Marked ${attendanceRecords.length} students as present`);
          fetchAttendanceRecords();
          
        } catch (error: any) {
          console.error('Mark all error:', error);
          message.error('Failed to mark all students: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Handle manual mark present
  const handleManualMarkPresent = (record: any) => {
    setSelectedStudent(record);
    setScoreInputValue(record.score || 2.00);
    setScoreModalVisible(true);
  };

  // Save manual attendance
  const saveManualAttendance = async () => {
    if (!selectedStudent || !selectedCourseData) {
      message.error('No student or course selected');
      return;
    }
    
    const score = Math.min(Math.max(scoreInputValue, 0), 2.00);
    
    try {
      const attendanceDate = selectedDate;
      
      // Check if attendance record exists
      const { data: existingAttendance, error: fetchError } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', selectedStudent.student_id)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      
      if (existingAttendance) {
        // Update existing record
        const { error } = await supabase
          .from('student_attendance')
          .update({ 
            score: score,
            check_in_time: new Date().toISOString(),
            verification_method: 'manual',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
        message.success(`Attendance updated for ${selectedStudent.student_name}`);
      } else {
        // Create new record
        const attendanceData = {
          student_id: selectedStudent.student_id,
          student_name: selectedStudent.student_name,
          matric_number: selectedStudent.matric_number,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: selectedStudent.level || selectedCourseData.level,
          attendance_date: attendanceDate,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'manual',
          score: score,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
        message.success(`Manual attendance recorded for ${selectedStudent.student_name}`);
      }
      
      fetchAttendanceRecords();
      
    } catch (error: any) {
      console.error('Manual attendance error:', error);
      message.error('Failed to record attendance: ' + error.message);
    } finally {
      setScoreModalVisible(false);
      setSelectedStudent(null);
      setScoreInputValue(0);
    }
  };

  const columns = [
    {
      title: 'Student ID',
      dataIndex: 'student_id',
      key: 'student_id',
    },
    {
      title: 'Name',
      dataIndex: 'student_name',
      key: 'student_name',
    },
    {
      title: 'Matric Number',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => level ? `Level ${level}` : 'N/A',
    },
    {
      title: 'Check-in Time',
      dataIndex: 'check_in_time',
      key: 'check_in_time',
      render: (time: string) => time ? dayjs(time).format('HH:mm:ss') : 'N/A',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <div>
          <span style={{ fontWeight: 'bold' }}>{score?.toFixed(2) || '0.00'} / 2.00</span>
          <Progress 
            percent={((score || 0) / 2.00) * 100} 
            size="small" 
            strokeColor={score >= 1.00 ? '#52c41a' : '#fa8c16'}
            showInfo={false}
          />
        </div>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'verification_method',
      key: 'verification_method',
      render: (method: string) => (
        <Tag color={method === 'face_recognition' ? 'green' : 'blue'}>
          {method === 'face_recognition' ? 'Face' : method === 'manual' ? 'Manual' : method}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            type="primary"
            onClick={() => handleManualMarkPresent(record)}
          >
            Edit Score
          </Button>
        </Space>
      ),
    },
  ];

  // Load face recognition models on component mount
  useEffect(() => {
    const loadFaceModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
        console.log('Face recognition models pre-loaded');
      } catch (error) {
        console.warn('Failed to pre-load face models:', error);
      }
    };
    
    loadFaceModels();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAttendanceRecords();
    }
  }, [selectedCourse, selectedDate]);

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Take Attendance</Title>
      <Text type="secondary">
        Select a course, capture student's face, and attendance will be automatically marked.
      </Text>

      <Card style={{ marginBottom: 20 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Take Attendance" key="attendance">
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={6}>
                <Text strong>Select Date:</Text>
                <DatePicker
                  style={{ width: '100%', marginTop: 8 }}
                  value={dayjs(selectedDate)}
                  onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                  size="large"
                  allowClear={false}
                />
              </Col>
              
              <Col xs={24} md={12}>
                <Text strong>Select Course:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Choose a course to mark attendance"
                  value={selectedCourse}
                  onChange={(value) => setSelectedCourse(value)}
                  loading={loading}
                  size="large"
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={courses.map(course => ({
                    value: course.id,
                    label: `${course.code} - ${course.title} (Level ${course.level})`,
                    course: course
                  }))}
                />
              </Col>
              
              <Col xs={24} md={6}>
                <Statistic
                  title="Attendance Rate"
                  value={stats.attendanceRate.toFixed(1)}
                  suffix="%"
                  prefix={<Users size={16} />}
                  valueStyle={{ color: stats.attendanceRate >= 70 ? '#3f8600' : '#cf1322' }}
                />
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>

      {selectedCourse ? (
        <>
          <Card style={{ marginBottom: 20 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Enrolled Students"
                    value={stats.totalStudents}
                    prefix={<Users size={16} />}
                  />
                </Card>
              </Col>
              
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic
                    title="Present Today"
                    value={stats.presentToday}
                    prefix={<CheckCircle size={16} color="#52c41a" />}
                    suffix={`/ ${stats.totalStudents}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic
                    title="Absent Today"
                    value={stats.totalStudents - stats.presentToday}
                    prefix={<XCircle size={16} color="#f5222d" />}
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Card>
              </Col>
            </Row>
            
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Space direction={isMobile ? "vertical" : "horizontal"} size="large">
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera />}
                  onClick={startFaceAttendance}
                  loading={loading}
                  disabled={isCameraActive || !selectedCourseData}
                >
                  Start Face Attendance
                </Button>
                
                <Button
                  type="default"
                  size="large"
                  onClick={handleMarkAllPresent}
                  loading={loading}
                  disabled={!selectedCourseData}
                >
                  Mark All Present
                </Button>
                
                <Button
                  type="dashed"
                  size="large"
                  icon={<RefreshCw size={16} />}
                  onClick={processMissingEmbeddings}
                  loading={loading}
                >
                  Process Face Data
                </Button>
              </Space>
              
              {selectedCourseData && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="blue">{selectedCourseData.code}</Tag>
                  <Tag color="green">{selectedCourseData.title}</Tag>
                  <Tag color="purple">Level {selectedCourseData.level}</Tag>
                  <Tag color="orange">{dayjs(selectedDate).format('DD/MM/YYYY')}</Tag>
                  <Tag color={faceModelsLoaded ? "green" : "orange"}>
                    {faceModelsLoaded ? 'Face Recognition Ready' : 'Loading Face Models...'}
                  </Tag>
                </div>
              )}
            </div>
          </Card>

          {/* Result Section */}
          {isCameraActive && (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <Alert
                  message="Face Attendance Active"
                  description={`Position student in front of camera. System will automatically mark attendance for ${selectedCourseData?.title}.`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
                
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleAttendanceComplete}
                  onCaptureStatus={handleFaceCaptureStatus}
                />
                
                <Divider>Result</Divider>
                
                <Card 
                  style={{ 
                    maxWidth: 600, 
                    margin: '0 auto 20px',
                    backgroundColor: faceResult?.success ? '#f6ffed' : '#fff2f0',
                    borderColor: faceResult?.success ? '#b7eb8f' : '#ffccc7'
                  }}
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Status">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {faceResult?.success ? (
                          <>
                            <CheckCircle color="#52c41a" size={16} />
                            <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                              {captureStatus}
                            </span>
                          </>
                        ) : faceResult ? (
                          <>
                            <XCircle color="#f5222d" size={16} />
                            <span style={{ color: '#f5222d' }}>{captureStatus}</span>
                          </>
                        ) : (
                          <>
                            <Camera color="#1890ff" size={16} />
                            <span>{captureStatus}</span>
                          </>
                        )}
                      </div>
                    </Descriptions.Item>
                    
                    {faceResult?.student && (
                      <>
                        <Descriptions.Item label="Student Name">
                          <Text strong>{faceResult.student.name}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Matric Number">
                          <Text strong>{faceResult.student.matric_number}</Text>
                        </Descriptions.Item>
                        
                        {/* Display stored photo if available */}
                        {matchedStudentData?.photo_url && (
                          <Descriptions.Item label="Stored Photo">
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                              <Image
                                width={80}
                                height={80}
                                src={matchedStudentData.photo_url}
                                style={{ 
                                  borderRadius: '8px', 
                                  objectFit: 'cover',
                                  border: '2px solid #1890ff'
                                }}
                                fallback="/placeholder-avatar.jpg"
                                placeholder={
                                  <div style={{
                                    width: 80,
                                    height: 80,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#f0f0f0',
                                    borderRadius: '8px'
                                  }}>
                                    <User size={24} color="#999" />
                                  </div>
                                }
                              />
                              <div>
                                <Text strong style={{ fontSize: '12px' }}>Enrollment Date:</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  {dayjs(matchedStudentData.enrollment_date).format('DD/MM/YYYY')}
                                </Text>
                                <br />
                                <Text strong style={{ fontSize: '12px' }}>Level:</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  {matchedStudentData.level || 'N/A'}
                                </Text>
                              </div>
                            </div>
                          </Descriptions.Item>
                        )}
                        
                        {faceResult.confidence && (
                          <Descriptions.Item label="Confidence">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Progress 
                                percent={Number((faceResult.confidence * 100).toFixed(1))} 
                                size="small" 
                                style={{ flex: 1 }}
                                strokeColor={
                                  faceResult.confidence > 0.8 ? '#52c41a' : 
                                  faceResult.confidence > 0.6 ? '#faad14' : '#f5222d'
                                }
                                format={() => `${(faceResult.confidence * 100).toFixed(1)}%`}
                              />
                              <Tag 
                                color={
                                  faceResult.confidence > 0.8 ? 'success' : 
                                  faceResult.confidence > 0.6 ? 'warning' : 'error'
                                }
                              >
                                {faceResult.confidence > 0.8 ? 'High' : 
                                 faceResult.confidence > 0.6 ? 'Medium' : 'Low'}
                              </Tag>
                            </div>
                          </Descriptions.Item>
                        )}
                        
                        <Descriptions.Item label="Course">
                          <Tag color="blue">{selectedCourseData?.code}</Tag>
                          <Text style={{ marginLeft: '8px' }}>{selectedCourseData?.title}</Text>
                        </Descriptions.Item>
                        
                        <Descriptions.Item label="Time">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={14} />
                            <Text>{dayjs().format('HH:mm:ss')}</Text>
                          </div>
                        </Descriptions.Item>
                        
                        <Descriptions.Item label="Method">
                          <Tag color="green">Face Recognition</Tag>
                        </Descriptions.Item>
                      </>
                    )}
                  </Descriptions>
                </Card>
                
                {/* Captured Photo Preview (if available) */}
                {faceResult?.photoUrl && (
                  <Card size="small" style={{ marginBottom: 20 }}>
                    <Title level={5} style={{ textAlign: 'center' }}>Captured Photo</Title>
                    <div style={{ textAlign: 'center' }}>
                      <Image
                        src={faceResult.photoUrl}
                        alt="Captured face"
                        style={{
                          maxWidth: '200px',
                          borderRadius: '8px',
                          border: '2px solid #52c41a'
                        }}
                      />
                      <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
                        {dayjs(faceResult.timestamp).format('HH:mm:ss')}
                      </Text>
                    </div>
                  </Card>
                )}
                
                <div style={{ marginTop: 20 }}>
                  <Button 
                    type="default" 
                    size="large"
                    onClick={stopCamera}
                    danger={isCapturing}
                    disabled={isCapturing}
                    loading={isCapturing}
                  >
                    {isCapturing ? 'Processing...' : 'Stop Camera'}
                  </Button>
                </div>
              </div>
              
              <Divider />
              <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9em' }}>
                <Text type="secondary">
                  AFE Babalola University Face Authentication System © 2025
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '0.8em' }}>
                  Developed for Daily Student Attendance with Offline Support
                  <br />
                  Database Connected • {faceModelsLoaded ? 'Face Recognition Active ✓' : 'Loading Face Recognition...'}
                </Text>
              </div>
            </Card>
          )}

          <Card title={
            <div>
              <span>Attendance Records</span>
              <Badge 
                count={stats.presentToday} 
                showZero 
                style={{ marginLeft: 10, backgroundColor: '#52c41a' }} 
              />
            </div>
          }>
            <Table
              columns={columns}
              dataSource={attendanceRecords}
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: true }}
              locale={{
                emptyText: 'No attendance records yet for this course'
              }}
            />
          </Card>
        </>
      ) : (
        <Card style={{ marginTop: 20 }}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Camera size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={4}>Select a Course</Title>
            <Text type="secondary">
              Please select a course from the dropdown above to start marking attendance.
            </Text>
            <div style={{ marginTop: 20 }}>
              <Text strong>How it works:</Text>
              <ol style={{ textAlign: 'left', maxWidth: 500, margin: '20px auto' }}>
                <li>Select a course and date</li>
                <li>Click "Start Face Attendance" to activate camera</li>
                <li>Student faces the camera</li>
                <li>System automatically identifies student and marks attendance</li>
                <li>Use "Process Face Data" button if students aren't being recognized</li>
                <li>Or use "Mark All Present" for bulk marking</li>
              </ol>
            </div>
          </div>
        </Card>
      )}

      {/* Score Adjustment Modal */}
      <Modal
        title="Adjust Attendance Score"
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        onOk={saveManualAttendance}
        confirmLoading={loading}
      >
        {selectedStudent && (
          <div>
            <Alert
              message="Manual Attendance"
              description="Adjust score for this student's attendance record."
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <p><strong>Student:</strong> {selectedStudent.student_name}</p>
            <p><strong>Matric:</strong> {selectedStudent.matric_number}</p>
            <p><strong>Course:</strong> {selectedCourseData?.title}</p>
            <p><strong>Date:</strong> {dayjs(selectedDate).format('DD/MM/YYYY')}</p>
            
            <div style={{ marginTop: 20 }}>
              <Text strong>Attendance Score (Max: 2.00):</Text>
              <InputNumber
                min={0}
                max={2.00}
                value={scoreInputValue}
                onChange={(value) => setScoreInputValue(value || 0)}
                style={{ width: '100%', marginTop: 10 }}
                step={0.25}
                precision={2}
              />
              <div style={{ marginTop: 8 }}>
                <Progress 
                  percent={((scoreInputValue || 0) / 2.00) * 100} 
                  strokeColor={scoreInputValue >= 1.00 ? '#52c41a' : '#fa8c16'}
                  format={() => `${scoreInputValue.toFixed(2)} / 2.00`}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;
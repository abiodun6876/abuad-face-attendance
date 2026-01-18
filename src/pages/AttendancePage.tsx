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
  Spin,
  Select,
  Modal,
  Input
} from 'antd';
import { Camera, CheckCircle, XCircle, Play, StopCircle, ArrowLeft, Book, Search } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import faceRecognition from '../utils/faceRecognition';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search: AntSearch } = Input;

interface MatchResult {
  studentId: string;
  name: string;
  matric_number: string;
  confidence: number;
}

interface Course {
  id: string;
  code: string;
  title: string;
  level: number;
  semester: number;
  credit_units: number;
  is_core: boolean;
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        setShowCamera(false);
        
        await faceRecognition.loadModels();
        
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
        
        // Show course selection modal first
        setShowCourseModal(true);
        loadCourses();
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

  // Load courses from database
  const loadCourses = async () => {
    try {
      setLoadingCourses(true);
      console.log('Fetching courses...');
      
      const { data, error } = await supabase
        .from('courses')
        .select('id, code, title, level, semester, credit_units, is_core')
        .eq('is_active', true)
        .order('code');

      if (error) {
        console.error('Error fetching courses:', error);
        message.error('Failed to load courses');
        return;
      }

      console.log('Courses loaded:', data?.length || 0, 'courses');
      const coursesData = data || [];
      setCourses(coursesData);
      setFilteredCourses(coursesData);
      
    } catch (error) {
      console.error('Error loading courses:', error);
      message.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  // Filter courses based on search query
  const filterCourses = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredCourses(courses);
      return;
    }
    
    const filtered = courses.filter(course => 
      course.code.toLowerCase().includes(query.toLowerCase()) ||
      course.title.toLowerCase().includes(query.toLowerCase()) ||
      course.level.toString().includes(query)
    );
    
    setFilteredCourses(filtered);
  };

  const handleAttendanceComplete = async (result: { success: boolean; photoData?: { base64: string } }) => {
    if (!autoScanEnabled) {
      return;
    }

    if (!selectedCourse) {
      message.error('Please select a course first');
      setAutoScanEnabled(false);
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
      if (!selectedCourse) {
        message.error('No course selected');
        return;
      }

      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0];
      const attendanceTime = now.toTimeString().split(' ')[0];
      
      // Get selected course details
      const selectedCourseData = courses.find(c => c.code === selectedCourse);
      if (!selectedCourseData) {
        message.error('Selected course not found');
        return;
      }

      // Check if student already marked attendance for this course today
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('matric_number', match.matric_number)
        .eq('date', attendanceDate)
        .eq('course_code', selectedCourse)
        .maybeSingle();

      if (existingAttendance) {
        message.warning(`${match.name} already marked attendance for ${selectedCourse} today at ${existingAttendance.time}`);
        setAttendanceMarked(true);
        setTimeout(() => resetToCamera(), 3000);
        return;
      }

      // Get additional student info if available
      let studentInfo = {
        faculty: '',
        department: '',
        program: '',
        level: ''
      };

      try {
        const { data: studentData } = await supabase
          .from('students')
          .select('faculty, department, program, level')
          .eq('matric_number', match.matric_number)
          .maybeSingle();

        if (studentData) {
          studentInfo = {
            faculty: studentData.faculty || '',
            department: studentData.department || '',
            program: studentData.program || '',
            level: studentData.level || ''
          };
        }
      } catch (error) {
        console.error('Error fetching student info:', error);
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
          course_code: selectedCourse,
          course_name: selectedCourseData.title,
          faculty: studentInfo.faculty,
          department: studentInfo.department,
          program: studentInfo.program,
          level: studentInfo.level,
          session: `${now.getFullYear()}/${now.getFullYear() + 1}`,
          semester: selectedCourseData.semester || 1,
          created_at: now.toISOString()
        }]);

      if (error) throw error;

      message.success(`✅ ${match.name} marked for ${selectedCourse}`);
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
    if (!selectedCourse) {
      message.error('Please select a course first');
      return;
    }

    const newState = !autoScanEnabled;
    setAutoScanEnabled(newState);
    setIsScanning(false);
    message.info(`Auto-scan ${newState ? 'started' : 'stopped'} for ${selectedCourse}`);
  };

  // Handle course selection
  const handleCourseSelect = (value: string) => {
    setSelectedCourse(value);
    const selected = courses.find(c => c.code === value);
    if (selected) {
      message.info(`Selected: ${selected.code} - ${selected.title}`);
    }
  };

  // Start scanning with selected course
  const startScanning = () => {
    if (!selectedCourse) {
      message.error('Please select a course first');
      return;
    }
    
    setShowCourseModal(false);
    setShowCamera(true);
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

      // Course Selection Modal section - corrected
{showCourseModal && modelsLoaded && (
  <Modal
    title={
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Book size={20} />
        <span>Select Course for Attendance</span>
      </div>
    }
    open={showCourseModal}
    onCancel={() => {
      setShowCourseModal(false);
      window.location.href = '/';
    }}
    footer={[
      <Button 
        key="back" 
        onClick={() => window.location.href = '/'}
        style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: 'white' }}
      >
        Cancel
      </Button>,
      <Button 
        key="submit" 
        type="primary" 
        onClick={startScanning}
        disabled={!selectedCourse || loadingCourses}
        loading={loadingCourses}
      >
        Start Attendance
      </Button>
    ]}
    centered
    width={450}
    styles={{
      body: { 
        backgroundColor: 'rgba(26, 34, 53, 0.95)',
        padding: '24px',
        color: 'white',
        borderRadius: '0 0 12px 12px'
      },
      header: { 
        backgroundColor: 'rgba(26, 34, 53, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        borderRadius: '12px 12px 0 0',
        marginBottom: 0
      },
      footer: { 
        backgroundColor: 'rgba(26, 34, 53, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0 0 12px 12px',
        marginTop: 0
      },
      mask: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)'
      }
    }}
    style={{
      borderRadius: '12px',
      overflow: 'hidden'
    }}
  >
    <div style={{ marginBottom: 20 }}>
      {/* Search Input */}
      <div style={{ marginBottom: 16 }}>
        <AntSearch
          placeholder="Search courses by code or title..."
          allowClear
          onChange={(e) => filterCourses(e.target.value)}
          onSearch={filterCourses}
          style={{ marginBottom: 12 }}
          prefix={<Search size={16} />}
        />
        
        {searchQuery && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
              Found {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
            </Text>
            {filteredCourses.length === 0 && (
              <Button 
                type="link" 
                size="small" 
                onClick={() => filterCourses('')}
                style={{ color: '#1890ff', padding: 0 }}
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>

      <Text style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: 8, display: 'block' }}>
        Select Course
      </Text>
      <Select
        placeholder="Choose a course..."
        style={{ width: '100%' }}
        onChange={handleCourseSelect}
        value={selectedCourse}
        loading={loadingCourses}
        showSearch
        filterOption={false}
        dropdownStyle={{ 
          backgroundColor: '#1a2235',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          maxHeight: 300
        }}
        dropdownRender={(menu) => (
          <>
            <div style={{ 
              padding: '8px 12px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#1a2235'
            }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
                Showing {filteredCourses.length} of {courses.length} courses
              </Text>
            </div>
            {menu}
          </>
        )}
      >
        {filteredCourses.length > 0 ? (
          filteredCourses.map((course) => (
            <Option 
              key={course.id} 
              value={course.code}
              style={{ 
                backgroundColor: '#1a2235',
                color: 'white',
                padding: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text strong style={{ color: 'white', fontSize: 14 }}>
                    {course.code}
                  </Text>
                  <Tag 
                    color={course.is_core ? "blue" : "purple"} 
                    style={{ fontSize: 10, padding: '2px 6px', margin: 0 }}
                  >
                    {course.is_core ? "Core" : "Elective"}
                  </Tag>
                </div>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 12,
                  marginTop: 4
                }}>
                  {course.title}
                </Text>
                <div style={{ 
                  display: 'flex', 
                  gap: 12, 
                  marginTop: 8,
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  <span>Level {course.level}</span>
                  <span>Semester {course.semester}</span>
                  <span>{course.credit_units} CU</span>
                </div>
              </div>
            </Option>
          ))
        ) : (
          <Option disabled value="no-results">
            <div style={{ 
              textAlign: 'center', 
              padding: '20px',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              <Search size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No courses found for "{searchQuery}"</div>
              <Button 
                type="link" 
                onClick={() => filterCourses('')}
                style={{ 
                  color: '#1890ff', 
                  marginTop: 8,
                  fontSize: 12 
                }}
              >
                View all courses
              </Button>
            </div>
          </Option>
        )}
      </Select>
    </div>

    {selectedCourse && (
      <div style={{ 
        backgroundColor: 'rgba(24, 144, 255, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginTop: 16,
        border: '1px solid rgba(24, 144, 255, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ 
            width: 20, 
            height: 20, 
            borderRadius: '50%', 
            backgroundColor: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle size={12} color="white" />
          </div>
          <div>
            <Text strong style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 13, display: 'block' }}>
              Selected: {selectedCourse}
            </Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, marginTop: 4 }}>
              {courses.find(c => c.code === selectedCourse)?.title}
            </Text>
            
          </div>
        </div>
      </div>
    )}
  </Modal>
)}

      {/* Camera View */}
      {showCamera && modelsLoaded && !showCourseModal && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Top Bar */}
          <div style={{ 
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Left - Back Button and Course Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                icon={<ArrowLeft size={18} />}
                onClick={() => window.location.href = '/'}
                style={{ 
                  color: 'white',
                  padding: '4px 8px',
                  minWidth: 'auto'
                }}
              />
              
              {/* Course Info */}
              <div style={{ maxWidth: 120 }}>
                <Text style={{ 
                  color: '#1890ff', 
                  fontSize: 12,
                  fontWeight: 'bold',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {selectedCourse}
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {courses.find(c => c.code === selectedCourse)?.title}
                </Text>
              </div>
            </div>

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
                TODAY
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

          {/* Main Camera Area */}
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
                    {autoScanEnabled ? "SCANNING" : "READY"}
                  </Tag>
                  <Tag color="blue" style={{ margin: 0, fontSize: 11, maxWidth: 60 }}>
                    <span style={{ 
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'block'
                    }}>
                      {selectedCourse || "NO COURSE"}
                    </span>
                  </Tag>
                </Space>

                {/* Center - Instruction */}
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 12,
                  fontWeight: '500',
                  maxWidth: 120,
                  textAlign: 'center'
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

      {/* Processing/Results View */}
      {!showCamera && modelsLoaded && !showCourseModal && (
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
                Recognizing face for {selectedCourse}
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
                  <Tag color="blue" style={{ fontSize: 14, padding: '6px 12px', marginBottom: 8 }}>
                    {bestMatch.matric_number}
                  </Tag>
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="green" style={{ fontSize: 12, padding: '4px 8px' }}>
                      {selectedCourse}
                    </Tag>
                  </div>
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
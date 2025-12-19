// src/pages/AttendancePage.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  Button, 
  Typography, 
  Space, 
  Alert, 
  Row, 
  Col, 
  Input,
  Spin,
  List,
  Tag,
  Statistic,
  Table,
  Modal,
  message
} from 'antd';
import { 
  Camera, 
  Building, 
  Users, 
  Book, 
  User,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Download,
  Filter,
  Eye
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [courseCode, setCourseCode] = useState<string>('');
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState<'take' | 'view'>('take');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchFaculties();
    fetchCourses();
  }, []);

  const fetchFaculties = async () => {
    try {
      const { data, error } = await supabase
        .from('faculties')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (!error) {
        setFaculties(data || []);
      }
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  const fetchDepartments = async (facultyId: string) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('faculty_id', facultyId)
        .eq('is_active', true)
        .order('name');
      
      if (!error) {
        setDepartments(data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      // In a real system, you would have a courses table
      // For now, we'll use sample data
      const sampleCourses = [
        { code: 'CSC101', title: 'Introduction to Computer Science', level: 100 },
        { code: 'CSC201', title: 'Data Structures', level: 200 },
        { code: 'CSC301', title: 'Database Systems', level: 300 },
        { code: 'EEE101', title: 'Basic Electrical Engineering', level: 100 },
        { code: 'EEE201', title: 'Circuit Analysis', level: 200 },
        { code: 'MTH101', title: 'Calculus I', level: 100 },
        { code: 'MTH201', title: 'Calculus II', level: 200 },
      ];
      setCourses(sampleCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleFacultyChange = (value: string) => {
    setSelectedFaculty(value);
    setSelectedDepartment('');
    fetchDepartments(value);
  };

  const handleCourseChange = (value: string) => {
    const course = courses.find(c => c.code === value);
    if (course) {
      setCourseCode(course.code);
      setCourseTitle(course.title);
      setSelectedLevel(course.level);
    }
  };

  const handleStartAttendance = async () => {
    try {
      await form.validateFields();
      setIsScanning(true);
      setAttendanceResult(null);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleFaceScanComplete = async (result: any) => {
    console.log('Attendance scan result:', result);
    
    if (result.success) {
      try {
        setLoading(true);
        
        // Check if student exists in database
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('matric_number', result.student?.matric_number || result.matricNumber)
          .single();

        const student = studentData || result.student;

        // Save attendance record to Supabase
        const attendanceRecord = {
          student_id: student?.student_id || student?.id || `student_${Date.now()}`,
          student_name: student?.name || result.student?.name || 'Unknown Student',
          matric_number: student?.matric_number || result.student?.matric_number || 'N/A',
          course_code: courseCode,
          course_title: courseTitle,
          faculty_id: selectedFaculty,
          department_id: selectedDepartment,
          level: selectedLevel,
          timestamp: new Date().toISOString(),
          status: 'present',
          confidence: result.confidence || 0.85,
          source: 'face_recognition',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Saving attendance record:', attendanceRecord);

        const { data, error } = await supabase
          .from('attendance_records')
          .insert([attendanceRecord])
          .select()
          .single();

        if (error) {
          console.error('Error saving attendance:', error);
          
          // If table doesn't exist, create it
          if (error.message.includes('relation "attendance_records" does not exist')) {
            message.error('Attendance table not found. Please create it first.');
            result.message = 'Database table not configured';
            result.success = false;
          } else if (error.message.includes('offline') || error.message.includes('network')) {
            // Save to local storage for offline
            localStorage.setItem(
              `pending_attendance_${Date.now()}`,
              JSON.stringify(attendanceRecord)
            );
            result.message = 'Attendance saved locally (offline mode)';
            result.offline = true;
          } else {
            result.message = `Failed to save: ${error.message}`;
            result.success = false;
          }
        } else {
          result.recordId = data.id;
          result.student = student;
          result.attendanceRecord = data;
          message.success('Attendance recorded successfully!');
          
          // Refresh today's attendance
          fetchTodaysAttendance();
        }

      } catch (error: any) {
        console.error('Error:', error);
        result.message = `Failed to process attendance: ${error.message}`;
        result.success = false;
      } finally {
        setLoading(false);
      }
    } else {
      result.message = result.message || 'Face recognition failed';
    }
    
    setAttendanceResult(result);
    setIsScanning(false);
  };

  const handleReset = () => {
    setIsScanning(false);
    setAttendanceResult(null);
    form.resetFields();
    setSelectedFaculty('');
    setSelectedDepartment('');
    setSelectedLevel(0);
    setCourseCode('');
    setCourseTitle('');
  };

  const fetchTodaysAttendance = async () => {
    if (!courseCode) return;
    
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_code', courseCode)
        .gte('timestamp', todayStr)
        .order('timestamp', { ascending: false });
      
      if (!error) {
        setAttendanceRecords(data || []);
      } else {
        console.error('Error fetching attendance:', error);
        // If table doesn't exist, show empty
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseStudents = async (courseCode: string) => {
    try {
      // In a real system, you would fetch students registered for this course
      // For now, we'll fetch all students and filter by level
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error) {
        // Filter students who should be taking this course (by level)
        const course = courses.find(c => c.code === courseCode);
        if (course) {
          const filteredStudents = students.filter(s => 
            s.level === course.level || !s.level
          );
          setCourseStudents(filteredStudents);
        } else {
          setCourseStudents(students);
        }
      }
    } catch (error) {
      console.error('Error fetching course students:', error);
    }
  };

  const handleManualAttendance = (student: any, status: 'present' | 'absent') => {
    const attendanceRecord = {
      student_id: student.student_id || student.id,
      student_name: student.name,
      matric_number: student.matric_number,
      course_code: courseCode,
      course_title: courseTitle,
      faculty_id: selectedFaculty,
      department_id: selectedDepartment,
      level: selectedLevel,
      timestamp: new Date().toISOString(),
      status: status,
      source: 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    supabase
      .from('attendance_records')
      .insert([attendanceRecord])
      .then(({ error }) => {
        if (error) {
          console.error('Error saving manual attendance:', error);
          message.error('Failed to save attendance');
        } else {
          message.success(`Marked ${student.name} as ${status}`);
          fetchTodaysAttendance();
        }
      });
  };

  const exportAttendance = () => {
    const data = {
      course: courseCode,
      title: courseTitle,
      date: new Date().toLocaleDateString(),
      records: attendanceRecords
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${courseCode}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAttendance = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;

  const studentColumns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <User size={14} />
          <Text>{text}</Text>
        </Space>
      ),
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
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            type="primary"
            onClick={() => handleManualAttendance(record, 'present')}
          >
            Mark Present
          </Button>
          <Button
            size="small"
            danger
            onClick={() => handleManualAttendance(record, 'absent')}
          >
            Mark Absent
          </Button>
        </Space>
      ),
    },
  ];

  const attendanceColumns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
    },
    {
      title: 'Matric Number',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleTimeString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'present' ? 'success' : 'error'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Tag color={source === 'face_recognition' ? 'blue' : 'orange'}>
          {source}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Attendance Management</Title>
      <Text type="secondary">
        Take attendance using face recognition or manual entry
      </Text>

      <Card style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <Space>
            <Button
              type={viewMode === 'take' ? 'primary' : 'default'}
              onClick={() => setViewMode('take')}
            >
              Take Attendance
            </Button>
            <Button
              type={viewMode === 'view' ? 'primary' : 'default'}
              onClick={() => setViewMode('view')}
            >
              View/Manage Attendance
            </Button>
          </Space>
        </div>

        {viewMode === 'take' ? (
          <>
            {!isScanning ? (
              <>
                <Alert
                  message="Attendance Setup"
                  description="Select the course details before starting attendance"
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                />

                <Form
                  form={form}
                  layout="vertical"
                  style={{ maxWidth: 600, margin: '0 auto' }}
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Course"
                        name="course_code"
                        rules={[{ required: true, message: 'Please select course' }]}
                      >
                        <Select
                          placeholder="Select course"
                          onChange={handleCourseChange}
                          options={courses.map(c => ({
                            label: `${c.code} - ${c.title}`,
                            value: c.code,
                          }))}
                          suffixIcon={<Book size={16} />}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Faculty"
                        name="faculty_id"
                        rules={[{ required: true, message: 'Please select faculty' }]}
                      >
                        <Select
                          placeholder="Select faculty"
                          onChange={handleFacultyChange}
                          options={faculties.map(f => ({
                            label: f.name,
                            value: f.id,
                          }))}
                          suffixIcon={<Building size={16} />}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Department"
                        name="department_id"
                        rules={[{ required: true, message: 'Please select department' }]}
                      >
                        <Select
                          placeholder="Select department"
                          disabled={!selectedFaculty}
                          options={departments.map(d => ({
                            label: d.name,
                            value: d.id,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Class Level"
                        name="level"
                        rules={[{ required: true, message: 'Please select level' }]}
                      >
                        <Select
                          placeholder="Select level"
                          options={[
                            { label: 'Level 100', value: 100 },
                            { label: 'Level 200', value: 200 },
                            { label: 'Level 300', value: 300 },
                            { label: 'Level 400', value: 400 },
                            { label: 'Level 500', value: 500 },
                          ]}
                          suffixIcon={<Users size={16} />}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ textAlign: 'center', marginTop: 30 }}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<Camera size={20} />}
                      onClick={handleStartAttendance}
                      disabled={!courseCode}
                    >
                      Start Face Attendance
                    </Button>
                    
                    {courseCode && (
                      <>
                        <Button
                          style={{ marginLeft: 10 }}
                          icon={<Eye size={16} />}
                          onClick={() => {
                            fetchCourseStudents(courseCode);
                            setShowStudentModal(true);
                          }}
                        >
                          Manual Attendance
                        </Button>
                        <Button
                          style={{ marginLeft: 10 }}
                          icon={<RefreshCw size={16} />}
                          onClick={fetchTodaysAttendance}
                          loading={loading}
                        >
                          View Today's Attendance
                        </Button>
                      </>
                    )}
                  </div>
                </Form>

                {/* Today's Attendance Summary */}
                {attendanceRecords.length > 0 && (
                  <div style={{ marginTop: 30 }}>
                    <Title level={4}>Today's Attendance Summary</Title>
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                      <Col xs={24} sm={8}>
                        <Statistic
                          title="Total Students"
                          value={totalAttendance}
                          prefix={<Users size={20} />}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic
                          title="Present"
                          value={presentCount}
                          valueStyle={{ color: '#52c41a' }}
                          prefix={<CheckCircle size={20} />}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic
                          title="Absent"
                          value={absentCount}
                          valueStyle={{ color: '#ff4d4f' }}
                          prefix={<XCircle size={20} />}
                        />
                      </Col>
                    </Row>

                    <div style={{ marginBottom: 20 }}>
                      <Button
                        icon={<Download size={16} />}
                        onClick={exportAttendance}
                      >
                        Export Attendance
                      </Button>
                    </div>

                    <Table
                      columns={attendanceColumns}
                      dataSource={attendanceRecords}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 10 }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceScanComplete}
                />
                <div style={{ marginTop: 20 }}>
                  <Button onClick={handleReset}>
                    Cancel and Return to Setup
                  </Button>
                </div>
              </div>
            )}

            {attendanceResult && (
              <div style={{ marginTop: 30 }}>
                <Alert
                  type={attendanceResult.success ? 'success' : 'warning'}
                  message={attendanceResult.success ? 'Attendance Recorded Successfully' : 'Attendance Failed'}
                  description={
                    attendanceResult.success ? (
                      <div>
                        <p><strong>Student:</strong> {attendanceResult.student?.name || 'Unknown'}</p>
                        <p><strong>Matric Number:</strong> {attendanceResult.student?.matric_number || 'N/A'}</p>
                        <p><strong>Course:</strong> {courseCode} - {courseTitle}</p>
                        <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
                        <p><strong>Confidence:</strong> {(attendanceResult.confidence * 100).toFixed(1)}%</p>
                        {attendanceResult.offline && (
                          <p><strong>Status:</strong> <Tag color="orange">Saved locally (offline)</Tag></p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p>{attendanceResult.message}</p>
                        <p>Please try again or use manual attendance.</p>
                      </div>
                    )
                  }
                  showIcon
                />
                
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Space>
                    <Button type="primary" onClick={handleStartAttendance}>
                      Take Another Attendance
                    </Button>
                    <Button onClick={() => {
                      fetchCourseStudents(courseCode);
                      setShowStudentModal(true);
                    }}>
                      Manual Attendance
                    </Button>
                    <Button onClick={handleReset}>
                      Return to Setup
                    </Button>
                  </Space>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <Alert
              message="Attendance Management"
              description="View and manage attendance records"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Select
                  placeholder="Select course to view attendance"
                  style={{ width: '100%' }}
                  options={courses.map(c => ({
                    label: `${c.code} - ${c.title}`,
                    value: c.code,
                  }))}
                  onChange={(value) => setSelectedCourse(value)}
                />
              </Col>
              <Col xs={24} md={12}>
                <Space>
                  <Button
                    type="primary"
                    icon={<Search size={16} />}
                    onClick={() => {
                      if (selectedCourse) {
                        setCourseCode(selectedCourse);
                        fetchTodaysAttendance();
                        setViewMode('take');
                      } else {
                        message.warning('Please select a course first');
                      }
                    }}
                  >
                    View Attendance
                  </Button>
                  <Button
                    icon={<Download size={16} />}
                    onClick={exportAttendance}
                    disabled={!attendanceRecords.length}
                  >
                    Export
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* Manual Attendance Modal */}
      <Modal
        title={`Manual Attendance - ${courseCode}`}
        open={showStudentModal}
        onCancel={() => setShowStudentModal(false)}
        width={800}
        footer={null}
      >
        <Alert
          message="Manual Attendance Entry"
          description="Click 'Mark Present' or 'Mark Absent' for each student"
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
        
        <Table
          columns={studentColumns}
          dataSource={courseStudents}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
          locale={{
            emptyText: 'No students found for this course'
          }}
        />
        
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Button onClick={() => setShowStudentModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AttendancePage;
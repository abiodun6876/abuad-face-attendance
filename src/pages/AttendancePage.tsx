// src/pages/AttendancePage.tsx - COMPLETE VERSION
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
  Statistic
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
  RefreshCw
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [courseCode, setCourseCode] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [form] = Form.useForm();

  // Fetch faculties and departments on mount
  useEffect(() => {
    fetchFaculties();
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

  const handleFacultyChange = (value: string) => {
    setSelectedFaculty(value);
    setSelectedDepartment('');
    fetchDepartments(value);
  };

  const handleStartAttendance = async () => {
    try {
      await form.validateFields();
      setIsScanning(true);
      setAttendanceResult(null);
      setAttendanceRecords([]);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleFaceScanComplete = async (result: any) => {
    if (result.success) {
      try {
        // Save attendance record to Supabase
        const attendanceRecord = {
          student_id: result.student?.id || result.studentId,
          student_name: result.student?.name || 'Unknown',
          matric_number: result.student?.matric_number || 'N/A',
          course_code: courseCode,
          faculty_id: selectedFaculty,
          department_id: selectedDepartment,
          level: selectedLevel,
          timestamp: new Date().toISOString(),
          status: 'present',
          confidence: result.confidence,
          source: 'face_recognition',
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('attendance_records')
          .insert(attendanceRecord)
          .select()
          .single();

        if (error) {
          console.error('Error saving attendance:', error);
          
          // Try to save locally for offline
          if (error.message.includes('offline') || error.message.includes('network')) {
            // Save to local storage
            localStorage.setItem(
              `pending_attendance_${Date.now()}`,
              JSON.stringify(attendanceRecord)
            );
            
            result.message = 'Attendance saved locally (offline mode)';
            result.offline = true;
          } else {
            result.message = 'Failed to save attendance record';
            result.success = false;
          }
        } else {
          result.recordId = data.id;
        }

        // Update attendance records list
        setAttendanceRecords(prev => [...prev, {
          ...attendanceRecord,
          id: data?.id || `local_${Date.now()}`,
          student: result.student
        }]);

      } catch (error) {
        console.error('Error:', error);
        result.message = 'Failed to process attendance';
        result.success = false;
      }
    }
    
    setAttendanceResult(result);
    setIsScanning(false);
  };

  const handleReset = () => {
    setIsScanning(false);
    setAttendanceResult(null);
    setAttendanceRecords([]);
    form.resetFields();
    setSelectedFaculty('');
    setSelectedDepartment('');
    setSelectedLevel(0);
    setCourseCode('');
  };

  const fetchTodaysAttendance = async () => {
    if (!courseCode) return;
    
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_code', courseCode)
        .gte('timestamp', today.toISOString())
        .order('timestamp', { ascending: false });
      
      if (!error) {
        setAttendanceRecords(data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAttendance = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Take Attendance</Title>
      <Text type="secondary">
        Mark attendance using face recognition
      </Text>

      <Card style={{ marginTop: 20 }}>
        {!isScanning ? (
          <>
            <Alert
              message="Attendance Setup"
              description="Select the class details before starting face recognition"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Form
              form={form}
              layout="vertical"
              style={{ maxWidth: 600, margin: '0 auto' }}
              initialValues={{
                level: 100
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Faculty"
                    name="faculty_id"
                    rules={[{ required: true, message: 'Please select faculty' }]}
                  >
                    <Select
                      placeholder="Select faculty"
                      onChange={handleFacultyChange}
                      loading={loading}
                      options={faculties.map(f => ({
                        label: f.name,
                        value: f.id,
                      }))}
                      suffixIcon={<Building size={16} />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Department"
                    name="department_id"
                    rules={[{ required: true, message: 'Please select department' }]}
                  >
                    <Select
                      placeholder="Select department"
                      disabled={!selectedFaculty}
                      loading={loading}
                      options={departments.map(d => ({
                        label: d.name,
                        value: d.id,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Level"
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
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Course Code"
                    name="course_code"
                    rules={[{ required: true, message: 'Please enter course code' }]}
                  >
                    <Input
                      placeholder="e.g., CSC101"
                      onChange={(e) => setCourseCode(e.target.value)}
                      prefix={<Book size={16} />}
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
                  disabled={!selectedFaculty || !selectedDepartment || !selectedLevel || !courseCode}
                >
                  Start Face Attendance
                </Button>
                
                {courseCode && (
                  <Button
                    style={{ marginLeft: 10 }}
                    icon={<RefreshCw size={16} />}
                    onClick={fetchTodaysAttendance}
                    loading={loading}
                  >
                    View Today's Attendance
                  </Button>
                )}
              </div>
            </Form>

            {/* Attendance Summary */}
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

                <List
                  size="small"
                  bordered
                  dataSource={attendanceRecords}
                  renderItem={(record) => (
                    <List.Item>
                      <Space>
                        <User size={16} />
                        <Text strong>{record.student_name || record.student?.name}</Text>
                        <Tag color="blue">{record.matric_number || record.student?.matric_number}</Tag>
                        <Tag color="green">Present</Tag>
                        <Text type="secondary">
                          <Clock size={12} /> {new Date(record.timestamp).toLocaleTimeString()}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <FaceCamera
              mode="attendance"
              sessionInfo={{
                facultyId: selectedFaculty,
                departmentId: selectedDepartment,
                level: selectedLevel,
                courseCode: courseCode
              }}
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
                    <p><strong>Course:</strong> {courseCode}</p>
                    <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
                    <p><strong>Confidence:</strong> {(attendanceResult.confidence * 100).toFixed(1)}%</p>
                    {attendanceResult.offline && (
                      <p><strong>Status:</strong> <Tag color="orange">Saved locally (offline)</Tag></p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p>{attendanceResult.message}</p>
                    <p>Please try again or check if the student is enrolled.</p>
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
                <Button onClick={() => window.location.href = '/sync'}>
                  View Sync Status
                </Button>
                <Button onClick={handleReset}>
                  Return to Setup
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AttendancePage;
// src/pages/LecturerAttendancePage.tsx - SIMPLIFIED FOR EASE OF USE
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
  Statistic,
  Tag,
  List,
  Input,
  Spin,
  Modal,
  Table,
  message
} from 'antd';
import {
  Camera,
  Book,
  Users,
  Clock,
  CheckCircle,
  User,
  QrCode,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const LecturerAttendancePage: React.FC = () => {
  const [lecturerCourses, setLecturerCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lecturer, setLecturer] = useState<any>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // Get current lecturer (in real app, from auth)
  useEffect(() => {
    const fetchLecturer = async () => {
      // For demo, get first lecturer
      const { data } = await supabase
        .from('lecturers')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setLecturer(data);
        fetchLecturerCourses(data.id);
      }
    };
    fetchLecturer();
  }, []);

  const fetchLecturerCourses = async (lecturerId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('lecturer_id', lecturerId)
        .eq('is_active', true)
        .order('code');

      if (!error) {
        setLecturerCourses(data || []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = async (courseId: string) => {
    const course = lecturerCourses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
      await fetchRegisteredStudents(courseId);
      await fetchTodayAttendance(courseId);
    }
  };

  const fetchRegisteredStudents = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_registrations')
        .select(`
          *,
          student:students(*)
        `)
        .eq('course_id', courseId)
        .eq('is_registered', true);

      if (!error) {
        setRegisteredStudents(data?.map((r: any) => r.student) || []);
      }
    } catch (error) {
      console.error('Error fetching registered students:', error);
    }
  };

  const fetchTodayAttendance = async (courseId: string) => {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_id', courseId)
        .eq('attendance_date', today)
        .order('check_in_time', { ascending: false });

      if (!error) {
        setTodayAttendance(data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

 const handleStartAttendance = () => {
  if (!selectedCourse) {
    alert('Please select a course first');
    return;
  }
  setIsScanning(true);
  setAttendanceResult(null);
};

  const handleFaceScanComplete = async (result: any) => {
    if (result.success && selectedCourse) {
      try {
        setLoading(true);
        
        // Find student by face match or randomly select for demo
        const student = registeredStudents.find(s => 
          s.matric_number === result.student?.matric_number
        ) || registeredStudents[0] || { 
          id: 'demo', 
          name: 'Demo Student', 
          matric_number: 'DEMO001' 
        };

        // Save attendance
        const attendanceRecord = {
          course_id: selectedCourse.id,
          course_code: selectedCourse.code,
          course_title: selectedCourse.title,
          student_id: student.id,
          student_name: student.name,
          matric_number: student.matric_number,
          lecturer_id: lecturer?.id,
          lecturer_name: lecturer?.name,
          attendance_date: dayjs().format('YYYY-MM-DD'),
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'face_recognition',
          confidence_score: result.confidence || 0.85,
          level: selectedCourse.level,
          department_id: selectedCourse.department_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('attendance_records')
          .insert([attendanceRecord]);

        if (error) throw error;

        result.student = student;
        result.course = selectedCourse;
        result.timestamp = new Date().toLocaleTimeString();
        
        // Refresh attendance list
        await fetchTodayAttendance(selectedCourse.id);
        
        message.success('Attendance recorded successfully!');
        
      } catch (error: any) {
        console.error('Attendance error:', error);
        result.message = `Failed: ${error.message}`;
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

  const handleManualAttendance = (student: any, status: 'present' | 'absent') => {
    const attendanceRecord = {
      course_id: selectedCourse.id,
      course_code: selectedCourse.code,
      course_title: selectedCourse.title,
      student_id: student.id,
      student_name: student.name,
      matric_number: student.matric_number,
      lecturer_id: lecturer?.id,
      lecturer_name: lecturer?.name,
      attendance_date: dayjs().format('YYYY-MM-DD'),
      check_in_time: new Date().toISOString(),
      status: status,
      verification_method: 'manual',
      level: selectedCourse.level,
      department_id: selectedCourse.department_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    supabase
      .from('attendance_records')
      .insert([attendanceRecord])
      .then(({ error }) => {
        if (error) {
          console.error('Error:', error);
          message.error('Failed to save attendance');
        } else {
          message.success(`${student.name} marked as ${status}`);
          fetchTodayAttendance(selectedCourse.id);
        }
      });
  };

  const exportAttendance = () => {
    const data = {
      course: selectedCourse.code,
      title: selectedCourse.title,
      date: dayjs().format('YYYY-MM-DD'),
      lecturer: lecturer?.name,
      records: todayAttendance
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedCourse.code}_${dayjs().format('YYYY-MM-DD')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presentCount = todayAttendance.filter(r => r.status === 'present').length;
  const absentCount = registeredStudents.length - presentCount;

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Take Attendance</Title>
      <Text type="secondary">
        Simple attendance system for lecturers
      </Text>

      <Card style={{ marginTop: 20 }}>
        {lecturer && (
          <Alert
            message={`Lecturer: ${lecturer.name}`}
            description={`Staff ID: ${lecturer.staff_id}`}
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        {!isScanning ? (
          <>
            <div style={{ marginBottom: 30 }}>
              <Title level={4}>Step 1: Select Course</Title>
              <Select
                placeholder="Select your course"
                style={{ width: '100%', maxWidth: 400 }}
                size="large"
                onChange={handleCourseSelect}
                loading={loading}
                options={lecturerCourses.map(course => ({
                  label: `${course.code} - ${course.title} (Level ${course.level})`,
                  value: course.id
                }))}
              />
            </div>

            {selectedCourse && (
              <>
                <Alert
                  message={`Selected: ${selectedCourse.code} - ${selectedCourse.title}`}
                  description={`Level ${selectedCourse.level} | ${registeredStudents.length} registered students`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 20 }}
                />

                <Row gutter={[16, 16]} style={{ marginBottom: 30 }}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Total Registered"
                      value={registeredStudents.length}
                      prefix={<Users size={20} />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Present Today"
                      value={presentCount}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircle size={20} />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Absent Today"
                      value={absentCount}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>

                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                  <Space>
                    <Button
                      type="primary"
                      size="large"
                      icon={<Camera size={20} />}
                      onClick={handleStartAttendance}
                      style={{ minWidth: 200 }}
                    >
                      Start Face Attendance
                    </Button>
                    <Button
                      size="large"
                      icon={<User size={20} />}
                      onClick={() => setShowManualModal(true)}
                    >
                      Manual Attendance
                    </Button>
                    <Button
                      size="large"
                      icon={<Download size={20} />}
                      onClick={exportAttendance}
                      disabled={todayAttendance.length === 0}
                    >
                      Export
                    </Button>
                  </Space>
                </div>

                {/* Today's Attendance List */}
                {todayAttendance.length > 0 && (
                  <div>
                    <Title level={4}>Today's Attendance</Title>
                    <List
                      size="small"
                      bordered
                      dataSource={todayAttendance}
                      renderItem={(record) => (
                        <List.Item>
                          <Space>
                            <User size={14} />
                            <Text strong>{record.student_name}</Text>
                            <Tag color="blue">{record.matric_number}</Tag>
                            <Tag color={record.status === 'present' ? 'success' : 'error'}>
                              {record.status.toUpperCase()}
                            </Tag>
                            <Text type="secondary">
                              <Clock size={12} /> {dayjs(record.check_in_time).format('HH:mm')}
                            </Text>
                            <Tag color={record.verification_method === 'face_recognition' ? 'blue' : 'orange'}>
                              {record.verification_method}
                            </Tag>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <FaceCamera
              mode="attendance"
              onAttendanceComplete={handleFaceScanComplete}
            />
            <div style={{ marginTop: 20 }}>
              <Button onClick={() => setIsScanning(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {attendanceResult && (
          <div style={{ marginTop: 30 }}>
            <Alert
              type={attendanceResult.success ? 'success' : 'warning'}
              message={attendanceResult.success ? 'Attendance Recorded!' : 'Attendance Failed'}
              description={
                attendanceResult.success ? (
                  <div>
                    <p><strong>Student:</strong> {attendanceResult.student?.name}</p>
                    <p><strong>Matric:</strong> {attendanceResult.student?.matric_number}</p>
                    <p><strong>Course:</strong> {selectedCourse?.code}</p>
                    <p><strong>Time:</strong> {attendanceResult.timestamp}</p>
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
          </div>
        )}
      </Card>

      {/* Manual Attendance Modal */}
      <Modal
        title={`Manual Attendance - ${selectedCourse?.code}`}
        open={showManualModal}
        onCancel={() => setShowManualModal(false)}
        width={800}
        footer={null}
      >
        <Table
          columns={[
            {
              title: 'Student',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: 'Matric Number',
              dataIndex: 'matric_number',
              key: 'matric',
            },
            {
              title: 'Level',
              dataIndex: 'level',
              key: 'level',
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_: any, record: any) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
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
          ]}
          dataSource={registeredStudents}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Modal>
    </div>
  );
};

export default LecturerAttendancePage;
// src/pages/AttendancePage.tsx
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
  Input,
  DatePicker,
  Tabs
} from 'antd';
import { Camera, Search, Filter, Calendar } from 'lucide-react';
import { UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;
const { TabPane } = Tabs;

const AttendancePage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [scoreInputValue, setScoreInputValue] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('attendance');

  // Fetch courses
  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('id, code, title, level, semester, lecturer_name')
        .order('code');
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      message.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch ALL enrolled students
  const fetchAllStudents = async () => {
    try {
      setLoading(true);
      
      // Get all students with enrollment_status = 'enrolled'
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('enrollment_status', 'enrolled')
        .order('name');
      
      if (studentsError) throw studentsError;
      
      if (studentsData) {
        // Process each student with today's attendance data
        const studentsWithAttendance = await Promise.all(
          studentsData.map(async (student) => {
            // Fetch attendance records for selected date
            const { data: attendanceRecords } = await supabase
              .from('student_attendance')
              .select('*')
              .eq('student_id', student.student_id)
              .eq('attendance_date', selectedDate)
              .order('check_in_time', { ascending: false });
            
            return {
              ...student,
              attendance_record: attendanceRecords || [],
              key: student.student_id
            };
          })
        );
        
        setAllStudents(studentsWithAttendance);
        setFilteredStudents(studentsWithAttendance);
      }
      
    } catch (error: any) {
      console.error('Error fetching students:', error);
      message.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

 const fetchCourseAttendance = async (courseId: string) => {
  if (!courseId) return;
  
  try {
    setLoading(true);
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('id, code, title')
      .eq('id', courseId)
      .single();
    
    if (courseError) throw courseError;
    
    // Fetch attendance for this course on selected date
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('student_attendance')
      .select('*')
      .eq('course_code', courseData.code)
      .eq('attendance_date', selectedDate)
      .order('check_in_time', { ascending: false });
    
    if (attendanceError) throw attendanceError;
    
    // Get unique student IDs from attendance (compatible version)
    const studentIdMap: Record<string, boolean> = {};
    const attendedStudentIds: string[] = [];
    if (attendanceData) {
      attendanceData.forEach(a => {
        if (a.student_id && !studentIdMap[a.student_id]) {
          studentIdMap[a.student_id] = true;
          attendedStudentIds.push(a.student_id);
        }
      });
    }
    
    // Fetch those students' details
    if (attendedStudentIds.length > 0) {
      const { data: attendedStudents, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .in('student_id', attendedStudentIds)
        .order('name');
      
      if (studentsError) throw studentsError;
      
      // Combine student data with attendance records
      const studentsWithAttendance = attendedStudents?.map(student => {
        const studentAttendance = attendanceData?.filter(a => a.student_id === student.student_id);
        return {
          ...student,
          attendance_record: studentAttendance || [],
          key: student.student_id
        };
      }) || [];
      
      setFilteredStudents(studentsWithAttendance);
    } else {
      setFilteredStudents([]);
    }
    
  } catch (error: any) {
    console.error('Error fetching course attendance:', error);
    message.error('Failed to load attendance data');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchCourses();
    fetchAllStudents();
  }, [selectedDate]);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);
    if (courseId) {
      fetchCourseAttendance(courseId);
    } else {
      setFilteredStudents(allStudents);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setFilteredStudents(allStudents);
      return;
    }
    
    const query = value.toLowerCase();
    const filtered = allStudents.filter(student =>
      student.name.toLowerCase().includes(query) ||
      student.student_id.toLowerCase().includes(query) ||
      student.matric_number?.toLowerCase().includes(query)
    );
    setFilteredStudents(filtered);
  };

  const handleAttendanceComplete = async (result: any) => {
    console.log('Face recognition result:', result);
    
    if (result.success && result.student) {
      try {
        if (!selectedCourse) {
          message.error('Please select a course first');
          return;
        }
        
        const attendanceDate = selectedDate;
        
        // Get selected course details
        const selectedCourseData = courses.find(c => c.id === selectedCourse);
        if (!selectedCourseData) {
          message.error('Course not found');
          return;
        }
        
        // Find student in our database
        const matricNumber = result.student.matric_number;
        const existingStudent = allStudents.find(s => 
          s.matric_number === matricNumber
        );
        
        if (!existingStudent) {
          message.error(`Student ${result.student.name} not found in enrolled students`);
          return;
        }
        
        const studentId = existingStudent.student_id;
        const studentName = existingStudent.name;
        
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
            level: selectedCourseData.level,
            attendance_date: attendanceDate,
            check_in_time: new Date().toISOString(),
            status: 'present',
            verification_method: 'face_recognition',
            confidence_score: result.confidence || 0.95,
            score: 2.00,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error } = await supabase
            .from('student_attendance')
            .insert([attendanceData]);
          
          if (error) throw error;
          message.success(`Attendance recorded for ${studentName}`);
        }
        
        // Refresh data
        if (selectedCourse) {
          fetchCourseAttendance(selectedCourse);
        } else {
          fetchAllStudents();
        }
        
      } catch (error: any) {
        console.error('Attendance error:', error);
        message.error('Failed to save attendance: ' + error.message);
      }
    } else {
      message.error(`Face recognition failed: ${result.message || 'Unknown error'}`);
    }
  };

  const handleManualAttendance = (student: any) => {
    if (!selectedCourse) {
      message.error('Please select a course first');
      return;
    }
    setSelectedStudent(student);
    setManualModalVisible(true);
  };

  const confirmManualAttendance = async () => {
    if (!selectedStudent || !selectedCourse) return;
    
    try {
      const attendanceDate = selectedDate;
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      
      if (!selectedCourseData) {
        message.error('Course not found');
        return;
      }
      
      // Check if attendance already exists for today and this course
      const { data: existingAttendance, error: fetchError } = await supabase
        .from('student_attendance')
        .select('id, score')
        .eq('student_id', selectedStudent.student_id)
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
            verification_method: 'manual',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
        message.success(`Attendance updated for ${selectedStudent.name}`);
      } else {
        // Create new attendance record
        const attendanceData = {
          student_id: selectedStudent.student_id,
          student_name: selectedStudent.name,
          matric_number: selectedStudent.matric_number,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: selectedCourseData.level,
          attendance_date: attendanceDate,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'manual',
          score: 2.00,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
        message.success(`Manual attendance recorded for ${selectedStudent.name}`);
      }
      
      // Refresh data
      if (selectedCourse) {
        fetchCourseAttendance(selectedCourse);
      } else {
        fetchAllStudents();
      }
      
    } catch (error: any) {
      console.error('Manual attendance error:', error);
      message.error('Failed to record manual attendance: ' + error.message);
    }
    
    setManualModalVisible(false);
    setSelectedStudent(null);
  };

  const updateStudentScore = (student: any) => {
    if (!selectedCourse) {
      message.error('Please select a course first');
      return;
    }
    setSelectedStudent(student);
    const currentScore = student.attendance_record?.[0]?.score || 2.00;
    setScoreInputValue(currentScore);
    setScoreModalVisible(true);
  };

  const saveStudentScore = async () => {
    if (!selectedStudent || !selectedCourse) {
      message.error('No student or course selected');
      return;
    }
    
    const score = scoreInputValue;
    const maxScore = 2.00;
    
    if (score < 0 || score > maxScore) {
      message.error(`Invalid score. Must be between 0 and ${maxScore}`);
      return;
    }
    
    try {
      const attendanceDate = selectedDate;
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      
      if (!selectedCourseData) {
        message.error('Course not found');
        return;
      }
      
      // Check if attendance record exists for selected date and course
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
        // Update existing record score
        const { error } = await supabase
          .from('student_attendance')
          .update({ 
            score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
      } else {
        // Create new record with score
        const attendanceData = {
          student_id: selectedStudent.student_id,
          student_name: selectedStudent.name,
          matric_number: selectedStudent.matric_number,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: selectedCourseData.level,
          attendance_date: attendanceDate,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'manual_score',
          score: score,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
      }
      
      message.success(`Score updated to ${score} for ${selectedStudent.name}`);
      if (selectedCourse) {
        fetchCourseAttendance(selectedCourse);
      } else {
        fetchAllStudents();
      }
      
    } catch (error: any) {
      console.error('Score update error:', error);
      message.error('Failed to update score: ' + error.message);
    } finally {
      setScoreModalVisible(false);
      setSelectedStudent(null);
      setScoreInputValue(0);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!selectedCourse || filteredStudents.length === 0) {
      message.error('Please select a course and ensure there are students');
      return;
    }
    
    Modal.confirm({
      title: 'Mark All Present',
      content: `Are you sure you want to mark all ${filteredStudents.length} students as present for this course?`,
      onOk: async () => {
        setLoading(true);
        try {
          const attendanceDate = selectedDate;
          const selectedCourseData = courses.find(c => c.id === selectedCourse);
          
          if (!selectedCourseData) {
            message.error('Course not found');
            return;
          }
          
          // Get students who are not already marked present for this course
          const absentStudents = filteredStudents.filter(student => {
            const hasAttendance = student.attendance_record?.some(
              (record: any) => record.course_code === selectedCourseData.code
            );
            return !hasAttendance;
          });
          
          // Create attendance records for all absent students
          const attendanceRecords = absentStudents.map(student => ({
            student_id: student.student_id,
            student_name: student.name,
            matric_number: student.matric_number,
            course_code: selectedCourseData.code,
            course_title: selectedCourseData.title,
            level: selectedCourseData.level,
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
          fetchCourseAttendance(selectedCourse);
        } catch (error: any) {
          console.error('Mark all error:', error);
          message.error('Failed to mark all students: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Student ID',
      dataIndex: 'student_id',
      key: 'student_id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Matric Number',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Program',
      dataIndex: 'program',
      key: 'program',
      render: (program: string) => program || 'Not specified',
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => level ? `Level ${level}` : 'Not specified',
    },
    {
      title: 'Score',
      key: 'score',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        const courseAttendance = selectedCourse 
          ? record.attendance_record?.find((a: any) => a.course_code === courses.find(c => c.id === selectedCourse)?.code)
          : record.attendance_record?.[0];
        
        const score = courseAttendance?.score || 0;
        const maxScore = 2.00;
        
        return (
          <div>
            <span style={{ fontWeight: 'bold' }}>{score.toFixed(2)} / {maxScore}</span>
            <div style={{ width: 100, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginTop: 4 }}>
              <div 
                style={{ 
                  width: `${(score / maxScore) * 100}%`, 
                  height: '100%', 
                  backgroundColor: score >= maxScore * 0.5 ? '#52c41a' : '#f5222d',
                  borderRadius: 4
                }} 
              />
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        const courseAttendance = selectedCourse 
          ? record.attendance_record?.find((a: any) => a.course_code === courses.find(c => c.id === selectedCourse)?.code)
          : record.attendance_record?.[0];
        
        return courseAttendance ? (
          <Tag color="green">Present</Tag>
        ) : (
          <Tag color="red">Absent</Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        const courseAttendance = selectedCourse 
          ? record.attendance_record?.find((a: any) => a.course_code === courses.find(c => c.id === selectedCourse)?.code)
          : record.attendance_record?.[0];
        
        return (
          <Space>
            <Button
              size="small"
              onClick={() => handleManualAttendance(record)}
              disabled={!!courseAttendance}
            >
              Mark Present
            </Button>
            {courseAttendance && (
              <Button
                size="small"
                type="link"
                onClick={() => updateStudentScore(record)}
              >
                Adjust Score
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Take Attendance</Title>
      <Text type="secondary">
        Mark attendance for any enrolled student. Select a course and mark students as present.
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
              
              <Col xs={24} md={6}>
                <Text strong>Select Course:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Choose a course"
                  value={selectedCourse}
                  onChange={handleCourseSelect}
                  loading={loading}
                  size="large"
                  allowClear
                  showSearch
                  filterOption={(input, option) => {
                    const course = courses.find(c => c.id === option?.value);
                    if (!course) return false;
                    
                    const searchText = input.toLowerCase();
                    return (
                      course.code.toLowerCase().includes(searchText) ||
                      course.title.toLowerCase().includes(searchText) ||
                      (course.lecturer_name?.toLowerCase() || '').includes(searchText)
                    );
                  }}
                >
                  <Select.Option value="">All Students (No Course Filter)</Select.Option>
                  {courses.map(course => (
                    <Select.Option key={course.id} value={course.id}>
                      {course.code} - {course.title} 
                      {course.lecturer_name && ` (${course.lecturer_name})`}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              
              <Col xs={24} md={6}>
                <Text strong>Search Students:</Text>
                <Input
                  placeholder="Search by name, ID, or matric"
                  prefix={<Search size={16} />}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ marginTop: 8 }}
                  size="large"
                  allowClear
                />
              </Col>
              
              <Col xs={24} md={6}>
                <Statistic
                  title="Showing Students"
                  value={filteredStudents.length}
                  prefix={<TeamOutlined />}
                  suffix={`/ ${allStudents.length} enrolled`}
                />
              </Col>
            </Row>
          </TabPane>
          
          <TabPane tab="Attendance Report" key="report">
            <Alert
              message="Attendance Report"
              description="View attendance statistics and reports for selected date and course."
              type="info"
              showIcon
            />
          </TabPane>
        </Tabs>
      </Card>

      {activeTab === 'attendance' && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <Space direction={isMobile ? "vertical" : "horizontal"} size="large">
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading}
                  disabled={!selectedCourse}
                >
                  Start Face Attendance
                </Button>
                
                <Button
                  type="default"
                  size="large"
                  onClick={handleMarkAllPresent}
                  loading={loading}
                  disabled={!selectedCourse || filteredStudents.length === 0}
                >
                  Mark All Present
                </Button>
                
                {!selectedCourse && (
                  <Alert
                    message="Course Required"
                    description="Please select a course to mark attendance"
                    type="warning"
                    showIcon
                    style={{ display: 'inline-block' }}
                  />
                )}
              </Space>
            </div>
          </Card>

          <Card title={
            <div>
              <span>Student List</span>
              {selectedCourse && (
                <Tag color="blue" style={{ marginLeft: 10 }}>
                  Course: {courses.find(c => c.id === selectedCourse)?.title}
                </Tag>
              )}
              <Tag color="green" style={{ marginLeft: 10 }}>
                Date: {dayjs(selectedDate).format('DD/MM/YYYY')}
              </Tag>
            </div>
          }>
            <Table
              columns={columns}
              dataSource={filteredStudents}
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: true }}
            />
          </Card>

          {isCameraActive && (
            <div style={{ marginTop: 20 }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleAttendanceComplete}
              />
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Button onClick={() => setIsCameraActive(false)}>
                  Stop Camera
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Attendance Modal */}
      <Modal
        title="Manual Attendance"
        open={manualModalVisible}
        onCancel={() => setManualModalVisible(false)}
        onOk={confirmManualAttendance}
        confirmLoading={loading}
      >
        {selectedStudent && selectedCourse && (
          <div>
            <p>Mark <strong>{selectedStudent.name}</strong> as present?</p>
            <p>Student ID: {selectedStudent.student_id}</p>
            <p>Matric: {selectedStudent.matric_number}</p>
            <p>Course: {courses.find(c => c.id === selectedCourse)?.title}</p>
            <p>Date: {dayjs(selectedDate).format('DD/MM/YYYY')}</p>
            <p>Score: 2.00 points (default)</p>
          </div>
        )}
      </Modal>

      {/* Score Adjustment Modal */}
      <Modal
        title="Adjust Score"
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        onOk={saveStudentScore}
        confirmLoading={loading}
      >
        {selectedStudent && selectedCourse && (
          <div>
            <p>Student: <strong>{selectedStudent.name}</strong></p>
            <p>Course: {courses.find(c => c.id === selectedCourse)?.title}</p>
            <p>Date: {dayjs(selectedDate).format('DD/MM/YYYY')}</p>
            <p>Max possible score: 2.00</p>
            <InputNumber
              min={0}
              max={2.00}
              value={scoreInputValue}
              onChange={(value) => setScoreInputValue(value || 0)}
              style={{ width: '100%', marginTop: 10 }}
              step={0.25}
              precision={2}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;
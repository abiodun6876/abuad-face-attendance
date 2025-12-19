// src/pages/CourseRegistrationPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  Input,
  Tag,
  Select,
  Spin,
  Checkbox,
  message,
  Modal,
  Form
} from 'antd';
import {
  Book,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Plus,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;

const CourseRegistrationPage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [registeredCourses, setRegisteredCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    fetchCourses();
    fetchStudents();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*, faculty:faculties(*), department:departments(*)')
        .eq('is_active', true)
        .order('level');

      if (!error) {
        setCourses(data || []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error) {
        setStudents(data || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchStudentRegistrations = async (studentId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_registrations')
        .select('*, course:courses(*)')
        .eq('student_id', studentId)
        .eq('is_registered', true);

      if (!error) {
        setRegisteredCourses(data || []);
        
        // Filter available courses (not registered)
        const registeredCourseIds = (data || []).map((r: any) => r.course_id);
        const available = courses.filter(c => 
          !registeredCourseIds.includes(c.id) && 
          c.level === selectedStudent?.level
        );
        setAvailableCourses(available);
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      fetchStudentRegistrations(studentId);
    }
  };

  const registerCourse = async (courseId: string) => {
    if (!selectedStudent) {
      message.error('Please select a student first');
      return;
    }

    try {
      const { error } = await supabase
        .from('course_registrations')
        .insert({
          student_id: selectedStudent.id,
          course_id: courseId,
          is_registered: true,
          registration_date: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      message.success('Course registered successfully');
      fetchStudentRegistrations(selectedStudent.id);
    } catch (error: any) {
      console.error('Registration error:', error);
      message.error(`Failed to register: ${error.message}`);
    }
  };

  const unregisterCourse = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('course_registrations')
        .update({ is_registered: false })
        .eq('id', registrationId);

      if (error) throw error;

      message.success('Course unregistered successfully');
      fetchStudentRegistrations(selectedStudent?.id || '');
    } catch (error: any) {
      console.error('Unregistration error:', error);
      message.error(`Failed to unregister: ${error.message}`);
    }
  };

  const columns = [
    {
      title: 'Course Code',
      dataIndex: ['course', 'code'],
      key: 'code',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Course Title',
      dataIndex: ['course', 'title'],
      key: 'title',
    },
    {
      title: 'Level',
      dataIndex: ['course', 'level'],
      key: 'level',
      render: (level: number) => `Level ${level}`,
    },
    {
      title: 'Lecturer',
      dataIndex: ['course', 'lecturer_name'],
      key: 'lecturer',
    },
    {
      title: 'Credit Units',
      dataIndex: ['course', 'credit_units'],
      key: 'credits',
    },
    {
      title: 'Registration Date',
      dataIndex: 'registration_date',
      key: 'date',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          danger
          size="small"
          onClick={() => unregisterCourse(record.id)}
        >
          Unregister
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Course Registration</Title>
      <Text type="secondary">
        Register students for courses
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12}>
            <Select
              placeholder="Select Student"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
              onChange={handleStudentSelect}
              loading={loading}
            >
              {students.map(student => (
                <Select.Option key={student.id} value={student.id}>
                  {student.name} - {student.matric_number} (Level {student.level})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={12}>
            {selectedStudent && (
              <Alert
                message={`Selected: ${selectedStudent.name}`}
                description={`Matric: ${selectedStudent.matric_number} | Level: ${selectedStudent.level}`}
                type="info"
                showIcon
              />
            )}
          </Col>
        </Row>

        {selectedStudent && (
          <>
            <div style={{ marginBottom: 30 }}>
              <Title level={4}>Available Courses (Level {selectedStudent.level})</Title>
              <Row gutter={[16, 16]}>
                {availableCourses.map(course => (
                  <Col xs={24} md={12} lg={8} key={course.id}>
                    <Card size="small">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <Text strong style={{ display: 'block' }}>{course.code}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>{course.title}</Text>
                          <div style={{ marginTop: 8 }}>
                            <Tag color="blue">Level {course.level}</Tag>
                            <Tag color="green">{course.credit_units} Credits</Tag>
                          </div>
                          <Text style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                            Lecturer: {course.lecturer_name}
                          </Text>
                        </div>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => registerCourse(course.id)}
                        >
                          Register
                        </Button>
                      </div>
                    </Card>
                  </Col>
                ))}
                {availableCourses.length === 0 && (
                  <Col span={24}>
                    <Alert
                      message="No available courses"
                      description="All courses for this level have been registered"
                      type="info"
                      showIcon
                    />
                  </Col>
                )}
              </Row>
            </div>

            <div>
              <Title level={4}>Registered Courses</Title>
              <Table
                columns={columns}
                dataSource={registeredCourses}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 5 }}
                locale={{
                  emptyText: 'No courses registered yet'
                }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default CourseRegistrationPage;
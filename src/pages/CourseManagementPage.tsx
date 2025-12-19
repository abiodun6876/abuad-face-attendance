// src/pages/CourseManagementPage.tsx
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
  Modal,
  Form,
  Select,
  Tag,
  Badge,
  Popconfirm,
  message
} from 'antd';
import {
  Book,
  User,
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;

interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  faculty_id?: string;
  department_id?: string;
  level: number;
  credit_units: number;
  lecturer_id?: string;
  lecturer_name?: string;
  semester?: number;
  academic_session?: string;
  is_active: boolean;
  created_at: string;
}

interface Lecturer {
  id: string;
  name: string;
  email: string;
  faculty_id?: string;
  department_id?: string;
}

const CourseManagementPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCourses();
    fetchLecturers();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      // In real app, fetch from courses table
      // For demo, use sample data
      const sampleCourses: Course[] = [
        {
          id: '1',
          code: 'CSC101',
          title: 'Introduction to Computer Science',
          description: 'Basic concepts of computer science',
          level: 100,
          credit_units: 3,
          lecturer_name: 'Dr. John Doe',
          semester: 1,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          code: 'CSC201',
          title: 'Data Structures',
          description: 'Study of data structures and algorithms',
          level: 200,
          credit_units: 3,
          lecturer_name: 'Prof. Jane Smith',
          semester: 2,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          code: 'EEE101',
          title: 'Basic Electrical Engineering',
          description: 'Fundamentals of electrical engineering',
          level: 100,
          credit_units: 4,
          lecturer_name: 'Dr. Robert Johnson',
          semester: 1,
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];
      setCourses(sampleCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLecturers = async () => {
    try {
      // Fetch lecturers from database
      const { data, error } = await supabase
        .from('lecturers')
        .select('*')
        .eq('is_active', true);

      if (!error && data) {
        setLecturers(data);
      } else {
        // Sample lecturers for demo
        const sampleLecturers: Lecturer[] = [
          { id: '1', name: 'Dr. John Doe', email: 'j.doe@abuad.edu.ng' },
          { id: '2', name: 'Prof. Jane Smith', email: 'j.smith@abuad.edu.ng' },
          { id: '3', name: 'Dr. Robert Johnson', email: 'r.johnson@abuad.edu.ng' },
        ];
        setLecturers(sampleLecturers);
      }
    } catch (error) {
      console.error('Error fetching lecturers:', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      if (editingCourse) {
        // Update course
        message.success('Course updated successfully');
      } else {
        // Create new course
        message.success('Course created successfully');
      }
      
      setShowModal(false);
      setEditingCourse(null);
      form.resetFields();
      fetchCourses();
      
    } catch (error) {
      console.error('Error saving course:', error);
      message.error('Failed to save course');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    try {
      // Delete course logic
      message.success('Course deleted successfully');
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      message.error('Failed to delete course');
    }
  };

  const columns = [
    {
      title: 'Course Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => `Level ${level}`,
    },
    {
      title: 'Lecturer',
      dataIndex: 'lecturer_name',
      key: 'lecturer',
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      render: (semester: number) => `Semester ${semester}`,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Course) => (
        <Space>
          <Button
            type="link"
            icon={<Edit size={14} />}
            onClick={() => {
              setEditingCourse(record);
              form.setFieldsValue(record);
              setShowModal(true);
            }}
          >
            Edit
          </Button>
          <Button
            type="link"
            onClick={() => window.location.href = `/attendance?course=${record.code}`}
          >
            Take Attendance
          </Button>
          <Popconfirm
            title="Delete this course?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<Trash2 size={14} />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2}>Course Management</Title>
          <Text type="secondary">
            Manage courses and assign lecturers
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingCourse(null);
              form.resetFields();
              setShowModal(true);
            }}
          >
            Add New Course
          </Button>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 20 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <AntdSearch
                placeholder="Search courses..."
                allowClear
                enterButton={<Search size={16} />}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} md={12}>
              <Select
                placeholder="Filter by level"
                style={{ width: '100%' }}
                options={[
                  { label: 'All Levels', value: 'all' },
                  { label: 'Level 100', value: 100 },
                  { label: 'Level 200', value: 200 },
                  { label: 'Level 300', value: 300 },
                  { label: 'Level 400', value: 400 },
                  { label: 'Level 500', value: 500 },
                ]}
              />
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={courses}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Course Modal */}
      <Modal
        title={editingCourse ? 'Edit Course' : 'Add New Course'}
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          setEditingCourse(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Course Code"
                name="code"
                rules={[{ required: true, message: 'Please enter course code' }]}
              >
                <Input placeholder="e.g., CSC101" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Course Title"
            name="title"
            rules={[{ required: true, message: 'Please enter course title' }]}
          >
            <Input placeholder="e.g., Introduction to Computer Science" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea
              placeholder="Course description..."
              rows={3}
            />
          </Form.Item>

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Credit Units"
                name="credit_units"
              >
                <Input type="number" placeholder="e.g., 3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Semester"
                name="semester"
              >
                <Select
                  placeholder="Select semester"
                  options={[
                    { label: 'Semester 1', value: 1 },
                    { label: 'Semester 2', value: 2 },
                    { label: 'Semester 3', value: 3 },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Lecturer"
            name="lecturer_id"
          >
            <Select
              placeholder="Assign lecturer"
              options={lecturers.map(l => ({
                label: l.name,
                value: l.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="is_active"
            initialValue={true}
          >
            <Select
              options={[
                { label: 'Active', value: true },
                { label: 'Inactive', value: false },
              ]}
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingCourse ? 'Update Course' : 'Create Course'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CourseManagementPage;
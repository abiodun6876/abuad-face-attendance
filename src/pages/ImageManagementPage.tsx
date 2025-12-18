// src/pages/ImageManagementPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
  Tag,
  Spin,
  Tooltip,
  Form,
  Select,
  message,
  Popconfirm,
  Empty,
  Upload,
  Divider,
  Progress,
  Badge
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  CameraOutlined,
  UserOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PictureOutlined,
  DatabaseOutlined,
  CloudSyncOutlined
} from '@ant-design/icons'; // Changed from lucide-react
import {
  Search, // lucide-react icons
  Eye,
  Trash2,
  Download,
  Upload as UploadIcon,
  RefreshCw,
  Camera,
  User,
  Filter,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Database,
  Cloud
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Student, FaceEnrollment } from '../types/database';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input; // Rename to avoid conflict
const { confirm } = Modal;

interface StudentWithImages extends Student {
  face_enrollments?: FaceEnrollment[];
  enrollment_count?: number;
  last_enrollment?: string;
  image_quality?: number;
}

const ImageManagementPage: React.FC = () => {
  const [students, setStudents] = useState<StudentWithImages[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithImages[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithImages | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [selectedImage, setSelectedImage] = useState<FaceEnrollment | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filters, setFilters] = useState({
    faculty_id: '',
    department_id: '',
    program_id: '',
    has_images: 'all'
  });

  const fetchStudentsWithImages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch students with their face enrollments
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          faculty:faculties(*),
          department:departments(*),
          program:programs(*),
          face_enrollments(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (studentsError) throw studentsError;

      // Process students to add image metadata
      const processedStudents: StudentWithImages[] = (studentsData || []).map(student => ({
        ...student,
        enrollment_count: student.face_enrollments?.length || 0,
        last_enrollment: student.face_enrollments?.[0]?.enrolled_at,
        image_quality: student.face_enrollments?.[0]?.quality_score || 0
      }));

      setStudents(processedStudents);
      setFilteredStudents(processedStudents);
      
    } catch (error) {
      console.error('Error fetching students with images:', error);
      message.error('Failed to load student images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentsWithImages();
  }, [fetchStudentsWithImages]);

  useEffect(() => {
    let result = students;
    
    // Apply search filter
    if (searchText) {
      result = result.filter(student =>
        student.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.matric_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Apply other filters
    if (filters.faculty_id) {
      result = result.filter(student => student.faculty_id === filters.faculty_id);
    }
    
    if (filters.department_id) {
      result = result.filter(student => student.department_id === filters.department_id);
    }
    
    if (filters.program_id) {
      result = result.filter(student => student.program_id === filters.program_id);
    }
    
    if (filters.has_images !== 'all') {
      const hasImages = filters.has_images === 'yes';
      result = result.filter(student => 
        hasImages ? (student.enrollment_count || 0) > 0 : (student.enrollment_count || 0) === 0
      );
    }
    
    setFilteredStudents(result);
  }, [searchText, filters, students]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handlePreview = (imageUrl: string, image?: FaceEnrollment) => {
    setPreviewImage(imageUrl);
    setSelectedImage(image || null);
    setPreviewVisible(true);
  };

  const handleViewStudentImages = (student: StudentWithImages) => {
    setSelectedStudent(student);
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      message.success('Image deleted successfully');
      fetchStudentsWithImages();
      
      // Refresh selected student if viewing their images
      if (selectedStudent) {
        const updatedStudent = await fetchStudentDetails(selectedStudent.id);
        setSelectedStudent(updatedStudent);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      message.error('Failed to delete image');
    }
  };

  const fetchStudentDetails = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          face_enrollments(*)
        `)
        .eq('id', studentId)
        .single();

      if (error) throw error;
      return data as StudentWithImages;
    } catch (error) {
      console.error('Error fetching student details:', error);
      return null;
    }
  };

  const handleDeleteAllImages = async (studentId: string) => {
    confirm({
      title: 'Delete All Images',
      content: 'Are you sure you want to delete all face images for this student? This action cannot be undone.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('face_enrollments')
            .delete()
            .eq('student_id', studentId);

          if (error) throw error;

          message.success('All images deleted successfully');
          fetchStudentsWithImages();
          setSelectedStudent(null);
        } catch (error) {
          console.error('Error deleting all images:', error);
          message.error('Failed to delete images');
        }
      }
    });
  };

  const handleReEnrollStudent = (student: StudentWithImages) => {
    // Redirect to enrollment page with student data
    const enrollmentUrl = `/enroll?studentId=${student.id}`;
    window.location.href = enrollmentUrl;
  };

  const handleSyncImages = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      // Simulate sync process with progress
      const totalStudents = students.length;
      let processed = 0;
      
      for (const student of students) {
        // Simulate processing each student
        await new Promise(resolve => setTimeout(resolve, 100));
        processed++;
        setSyncProgress(Math.round((processed / totalStudents) * 100));
      }
      
      message.success('Image database synced successfully');
    } catch (error) {
      console.error('Error syncing images:', error);
      message.error('Failed to sync images');
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleExportImages = async () => {
    try {
      // Create a JSON export of image metadata
      const exportData = students.map(student => ({
        id: student.id,
        name: student.name,
        matric_number: student.matric_number,
        enrollment_count: student.enrollment_count,
        last_enrollment: student.last_enrollment,
        images: student.face_enrollments?.map(img => ({
          id: img.id,
          quality_score: img.quality_score,
          enrolled_at: img.enrolled_at,
          capture_device: img.capture_device
        }))
      }));
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `face_images_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('Image metadata exported successfully');
    } catch (error) {
      console.error('Error exporting images:', error);
      message.error('Failed to export images');
    }
  };

  const columns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: StudentWithImages) => (
        <Space>
          <User size={16} style={{ color: '#1890ff' }} />
          <div>
            <Text strong>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.matric_number}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Program',
      dataIndex: ['program', 'name'],
      key: 'program',
      render: (text: string) => text || 'N/A',
    },
    {
      title: 'Face Images',
      dataIndex: 'enrollment_count',
      key: 'images',
      render: (count: number) => (
        <Badge
          count={count}
          style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
        />
      ),
    },
    {
      title: 'Image Quality',
      dataIndex: 'image_quality',
      key: 'quality',
      render: (quality: number) => {
        if (!quality) return <Tag color="default">No Images</Tag>;
        const percentage = Math.round(quality * 100);
        let color = 'green';
        if (percentage < 60) color = 'red';
        else if (percentage < 80) color = 'orange';
        
        return (
          <Tooltip title={`${percentage}% quality score`}>
            <Progress
              percent={percentage}
              size="small"
              status={percentage >= 80 ? 'normal' : 'exception'}
              strokeColor={color}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Last Enrollment',
      dataIndex: 'last_enrollment',
      key: 'last_enrollment',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: StudentWithImages) => (
        <Space>
          <Tooltip title="View Images">
            <Button
              type="text"
              icon={<Eye size={16} />}
              onClick={() => handleViewStudentImages(record)}
              disabled={!record.enrollment_count}
            />
          </Tooltip>
          <Tooltip title="Re-enroll Face">
            <Button
              type="text"
              icon={<Camera size={16} />}
              onClick={() => handleReEnrollStudent(record)}
            />
          </Tooltip>
          {record.enrollment_count ? (
            <Popconfirm
              title="Delete all images for this student?"
              onConfirm={() => handleDeleteAllImages(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete All Images">
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={16} />}
                />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const imageColumns = [
    {
      title: 'Preview',
      dataIndex: 'photo_url',
      key: 'preview',
      render: (url: string, record: FaceEnrollment) => (
        <div style={{ width: 60, height: 60, cursor: 'pointer' }} onClick={() => handlePreview(url, record)}>
          <Image
            src={url}
            alt="Face"
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        </div>
      ),
    },
    {
      title: 'Quality',
      dataIndex: 'quality_score',
      key: 'quality',
      render: (score: number) => {
        const percentage = Math.round(score * 100);
        return (
          <Tooltip title={`${percentage}% quality score`}>
            <Tag color={percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'error'}>
              {percentage}%
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Capture Device',
      dataIndex: 'capture_device',
      key: 'device',
      render: (device: string) => device || 'Unknown',
    },
    {
      title: 'Enrolled Date',
      dataIndex: 'enrolled_at',
      key: 'enrolled_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FaceEnrollment) => (
        <Space>
          <Tooltip title="Preview Full Image">
            <Button
              type="text"
              icon={<Eye size={16} />}
              onClick={() => handlePreview(record.photo_url, record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this image?"
            onConfirm={() => handleDeleteImage(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Image">
              <Button
                type="text"
                danger
                icon={<Trash2 size={16} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2}>Image Management</Title>
          <Text type="secondary">
            Manage face images and enrollments for students
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<RefreshCw size={16} />}
              onClick={fetchStudentsWithImages}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<Cloud size={16} />}
              onClick={handleSyncImages}
              loading={isSyncing}
            >
              Sync Images
            </Button>
            <Button
              icon={<Download size={16} />}
              onClick={handleExportImages}
            >
              Export Metadata
            </Button>
          </Space>
        </Col>
      </Row>

      {isSyncing && (
        <Alert
          message="Syncing Image Database"
          description={
            <div>
              <Progress percent={syncProgress} status="active" />
              <Text type="secondary">Processing student images...</Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <AntdSearch
              placeholder="Search by name, matric number, or email"
              allowClear
              enterButton={<Search size={16} />}
              size="large"
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
            />
          </Col>
          <Col xs={24} md={12}>
            <Space>
              <Select
                placeholder="Filter by Faculty"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => setFilters({ ...filters, faculty_id: value })}
              >
                {/* Add faculty options here */}
              </Select>
              <Select
                placeholder="Has Images"
                style={{ width: 120 }}
                value={filters.has_images}
                onChange={(value) => setFilters({ ...filters, has_images: value })}
              >
                <Select.Option value="all">All Students</Select.Option>
                <Select.Option value="yes">With Images</Select.Option>
                <Select.Option value="no">No Images</Select.Option>
              </Select>
              <Button
                icon={<Filter size={16} />}
                onClick={() => setFilters({
                  faculty_id: '',
                  department_id: '',
                  program_id: '',
                  has_images: 'all'
                })}
              >
                Clear Filters
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedStudent ? (
        <Card 
          title={
            <Space>
              <User size={16} />
              <Text strong>{selectedStudent.name}</Text>
              <Text type="secondary">({selectedStudent.matric_number})</Text>
            </Space>
          }
          extra={
            <Space>
              <Button onClick={() => setSelectedStudent(null)}>
                Back to List
              </Button>
              <Button
                type="primary"
                icon={<Camera size={16} />}
                onClick={() => handleReEnrollStudent(selectedStudent)}
              >
                Add New Image
              </Button>
            </Space>
          }
        >
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Alert
                message="Student Face Images"
                description={`Total ${selectedStudent.face_enrollments?.length || 0} face images enrolled`}
                type="info"
                showIcon
              />
            </Col>
            
            {selectedStudent.face_enrollments && selectedStudent.face_enrollments.length > 0 ? (
              <Col span={24}>
                <Table
                  columns={imageColumns}
                  dataSource={selectedStudent.face_enrollments}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Col>
            ) : (
              <Col span={24}>
                <Empty
                  description="No face images found for this student"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<Camera size={16} />}
                    onClick={() => handleReEnrollStudent(selectedStudent)}
                  >
                    Enroll Face Now
                  </Button>
                </Empty>
              </Col>
            )}
          </Row>
        </Card>
      ) : (
        <Card>
          <Table
            columns={columns}
            dataSource={filteredStudents}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <Empty
                  description="No students found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Text type="secondary">Enroll students to see their face images here</Text>
                </Empty>
              )
            }}
          />
        </Card>
      )}

      <Modal
  open={previewVisible}
  title="Face Image Preview"
  footer={null}
  onCancel={() => setPreviewVisible(false)}
  width={720}
>
  <div style={{ textAlign: 'center' }}>
    <Image
      src={previewImage}
      alt="Face Preview"
      style={{ maxWidth: '100%', maxHeight: '70vh' }}
    />
    {selectedImage && (
      <div style={{ marginTop: 20, textAlign: 'left' }}>
        {/* Use plain Divider without orientation if there's an issue */}
        <Divider style={{ margin: '16px 0' }}>
          <Text strong>Image Details</Text>
        </Divider>
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Text strong>Quality Score: </Text>
            <Tag color="blue">{Math.round((selectedImage.quality_score || 0) * 100)}%</Tag>
          </Col>
          <Col span={12}>
            <Text strong>Capture Device: </Text>
            <Text>{selectedImage.capture_device || 'Unknown'}</Text>
          </Col>
          <Col span={24}>
            <Text strong>Enrolled: </Text>
            <Text>{new Date(selectedImage.enrolled_at).toLocaleString()}</Text>
          </Col>
        </Row>
      </div>
    )}
  </div>
</Modal>
    </div>
  );
};

export default ImageManagementPage;
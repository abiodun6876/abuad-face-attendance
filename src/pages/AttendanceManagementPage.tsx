// src/pages/AttendanceManagementPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Alert,
  message,
  Form,
  Modal,
  Descriptions,
  Avatar,
  Tooltip,
  Badge
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
// Remove the wrong import and use this instead:
import { Grid } from 'antd';
const { useBreakpoint } = Grid;
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface AttendanceRecord {
  id: number;
  student_id: string;
  student_name: string;
  matric_number: string;
  course_code: string;
  course_title: string;
  level: number;
  attendance_date: string;
  check_in_time: string;
  status: 'present' | 'absent' | 'late';
  verification_method: 'face_recognition' | 'manual' | 'qr_code';
  confidence_score: number | null;
  score: string;
  created_at: string;
  updated_at: string;
}

const AttendanceManagementPage: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<string[]>([]);
  const [levels, setLevels] = useState<number[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    faceVerified: 0,
    manual: 0
  });
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    course: '',
    level: '',
    status: '',
    verification: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
  });

  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setAttendanceData(data);
        setFilteredData(data);
        
        // Extract unique courses and levels
        const uniqueCourses = Array.from(new Set(data.map((record: any) => record.course_code)));
        const uniqueLevels = Array.from(new Set(data.map((record: any) => record.level))).sort();
        
        setCourses(uniqueCourses as string[]);
        setLevels(uniqueLevels as number[]);
        
        // Calculate statistics
        calculateStats(data);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (data: AttendanceRecord[]) => {
    const present = data.filter(record => record.status === 'present').length;
    const absent = data.filter(record => record.status === 'absent').length;
    const faceVerified = data.filter(record => record.verification_method === 'face_recognition').length;
    const manual = data.filter(record => record.verification_method === 'manual').length;
    
    setStats({
      total: data.length,
      present,
      absent,
      faceVerified,
      manual
    });
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = [...attendanceData];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.student_name.toLowerCase().includes(searchLower) ||
        record.matric_number.toLowerCase().includes(searchLower) ||
        record.course_code.toLowerCase().includes(searchLower) ||
        record.course_title.toLowerCase().includes(searchLower)
      );
    }

    // Course filter
    if (filters.course) {
      filtered = filtered.filter(record => record.course_code === filters.course);
    }

    // Level filter
    if (filters.level) {
      filtered = filtered.filter(record => record.level === parseInt(filters.level));
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    // Verification method filter
    if (filters.verification) {
      filtered = filtered.filter(record => record.verification_method === filters.verification);
    }

    // Date range filter
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.attendance_date);
        return recordDate.isAfter(startDate.subtract(1, 'day')) && 
               recordDate.isBefore(endDate.add(1, 'day'));
      });
    }

    setFilteredData(filtered);
    calculateStats(filtered);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      course: '',
      level: '',
      status: '',
      verification: '',
      dateRange: null
    });
    setFilteredData(attendanceData);
    calculateStats(attendanceData);
  };

  // View record details
  const viewRecordDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // Export data
  const exportToCSV = () => {
    const headers = ['Student ID', 'Name', 'Matric', 'Course', 'Level', 'Date', 'Time', 'Status', 'Method', 'Score'];
    const csvData = filteredData.map(record => [
      record.student_id,
      record.student_name,
      record.matric_number,
      `${record.course_code} - ${record.course_title}`,
      record.level,
      record.attendance_date,
      dayjs(record.check_in_time).format('HH:mm:ss'),
      record.status,
      record.verification_method,
      record.score
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('Data exported successfully');
  };

  // Table columns
  const columns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
      width: isMobile ? 150 : 200,
      render: (text: string, record: AttendanceRecord) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.matric_number}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Course',
      dataIndex: 'course_code',
      key: 'course_code',
      width: isMobile ? 120 : 150,
      render: (code: string, record: AttendanceRecord) => (
        <div>
          <Tag color="blue" style={{ marginBottom: 4 }}>
            {code}
          </Tag>
          <div style={{ fontSize: '12px' }}>{record.course_title}</div>
        </div>
      ),
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: number) => (
        <Tag color="purple">Level {level}</Tag>
      ),
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      width: isMobile ? 140 : 180,
      render: (record: AttendanceRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(record.attendance_date).format('MMM D, YYYY')}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(record.check_in_time).format('h:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: any = {
          present: { color: 'green', icon: <CheckCircleOutlined />, text: 'Present' },
          absent: { color: 'red', icon: <CloseCircleOutlined />, text: 'Absent' },
          late: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Late' }
        };
        const config = statusConfig[status] || statusConfig.present;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Verification',
      dataIndex: 'verification_method',
      key: 'verification_method',
      width: isMobile ? 100 : 120,
      render: (method: string, record: AttendanceRecord) => (
        <Tooltip title={`Confidence: ${record.confidence_score || 'N/A'}`}>
          <Badge
            color={method === 'face_recognition' ? 'green' : 'blue'}
            text={
              method === 'face_recognition' ? 'Face ID' :
              method === 'manual' ? 'Manual' : 'QR Code'
            }
          />
        </Tooltip>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score: string) => (
        <Tag color="gold">{score}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (record: AttendanceRecord) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewRecordDetails(record)}
          size="small"
        />
      ),
    },
  ];

  // Mobile responsive columns
  const mobileColumns = [
    {
      title: 'Details',
      key: 'details',
      render: (record: AttendanceRecord) => (
        <div style={{ padding: '8px 0' }}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 500 }}>{record.student_name}</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {record.matric_number}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col span={24}>
              <Tag color="blue">{record.course_code}</Tag>
              <Tag color="purple" style={{ marginLeft: 4 }}>L{record.level}</Tag>
              {record.status === 'present' ? (
                <Tag color="green" icon={<CheckCircleOutlined />} style={{ marginLeft: 4 }}>
                  Present
                </Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />} style={{ marginLeft: 4 }}>
                  Absent
                </Tag>
              )}
            </Col>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <CalendarOutlined style={{ marginRight: 4 }} />
                {dayjs(record.attendance_date).format('MMM D')} • 
                <ClockCircleOutlined style={{ marginRight: 4, marginLeft: 8 }} />
                {dayjs(record.check_in_time).format('h:mm A')}
              </Text>
            </Col>
            <Col span={24}>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => viewRecordDetails(record)}
                size="small"
                style={{ padding: 0 }}
              >
                View Details
              </Button>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, attendanceData]);

  return (
    <div style={{ padding: isMobile ? '12px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Attendance Management
      </Title>
      <Text type="secondary">
        View, search, and filter attendance records for all courses
      </Text>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Records"
              value={stats.total}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Present"
              value={stats.present}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Absent/Late"
              value={stats.absent}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Face Verified"
              value={stats.faceVerified}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Last Updated"
              value={attendanceData[0] ? dayjs(attendanceData[0].updated_at).format('MMM D, h:mm A') : 'N/A'}
              valueStyle={{ fontSize: '14px', color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters Card */}
      <Card
        title={
          <Space>
            <FilterOutlined />
            <span>Filters & Search</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={resetFilters}
              size={isMobile ? "small" : "middle"}
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              size={isMobile ? "small" : "middle"}
            >
              Export
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search students, courses, or matric numbers..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Course"
              style={{ width: '100%' }}
              value={filters.course || undefined}
              onChange={(value) => setFilters({...filters, course: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              {courses.map(course => (
                <Option key={course} value={course}>
                  {course}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Level"
              style={{ width: '100%' }}
              value={filters.level || undefined}
              onChange={(value) => setFilters({...filters, level: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              {levels.map(level => (
                <Option key={level} value={level.toString()}>
                  Level {level}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters({...filters, status: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              <Option value="present">Present</Option>
              <Option value="absent">Absent</Option>
              <Option value="late">Late</Option>
            </Select>
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Method"
              style={{ width: '100%' }}
              value={filters.verification || undefined}
              onChange={(value) => setFilters({...filters, verification: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              <Option value="face_recognition">Face ID</Option>
              <Option value="manual">Manual</Option>
              <Option value="qr_code">QR Code</Option>
            </Select>
          </Col>
          <Col xs={24} md={9}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs]})}
              size={isMobile ? "small" : "middle"}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Results Alert */}
      <Alert
        message={`Showing ${filteredData.length} of ${attendanceData.length} records`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Button type="link" size="small" onClick={fetchAttendanceData}>
            Refresh
          </Button>
        }
      />

      {/* Attendance Table */}
      <Card>
        <Table
          columns={isMobile ? mobileColumns : columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: isMobile ? 10 : 20,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
            responsive: true
          }}
          scroll={{ x: isMobile ? 400 : 1200 }}
          size={isMobile ? "small" : "middle"}
          expandable={isMobile ? undefined : {
            expandedRowRender: (record) => (
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="Student ID">{record.student_id}</Descriptions.Item>
                <Descriptions.Item label="Course">{record.course_title}</Descriptions.Item>
                <Descriptions.Item label="Attendance Date">
                  {dayjs(record.attendance_date).format('dddd, MMMM D, YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Check-in Time">
                  {dayjs(record.check_in_time).format('h:mm:ss A')}
                </Descriptions.Item>
                <Descriptions.Item label="Verification Method">
                  <Tag color={record.verification_method === 'face_recognition' ? 'green' : 'blue'}>
                    {record.verification_method}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Confidence Score">
                  {record.confidence_score ? `${(record.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Record Created">
                  {dayjs(record.created_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {dayjs(record.updated_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Attendance Record Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={isMobile ? '90%' : 700}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Student">
              <Space>
                <Avatar icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedRecord.student_name}</div>
                  <Text type="secondary">{selectedRecord.matric_number}</Text>
                </div>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Student ID">
              {selectedRecord.student_id}
            </Descriptions.Item>
            <Descriptions.Item label="Course">
              <div>
                <Tag color="blue">{selectedRecord.course_code}</Tag>
                <div style={{ marginTop: 4 }}>{selectedRecord.course_title}</div>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Level">
              <Tag color="purple">Level {selectedRecord.level}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Attendance Date">
              {dayjs(selectedRecord.attendance_date).format('dddd, MMMM D, YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in Time">
              {dayjs(selectedRecord.check_in_time).format('h:mm:ss A')}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedRecord.status === 'present' ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>Present</Tag>
              ) : selectedRecord.status === 'absent' ? (
                <Tag color="red" icon={<CloseCircleOutlined />}>Absent</Tag>
              ) : (
                <Tag color="orange" icon={<ClockCircleOutlined />}>Late</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Verification Method">
              <Tag color={selectedRecord.verification_method === 'face_recognition' ? 'green' : 'blue'}>
                {selectedRecord.verification_method.replace('_', ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Confidence Score">
              {selectedRecord.confidence_score ? (
                <div>
                  <Text strong>{(selectedRecord.confidence_score * 100).toFixed(1)}%</Text>
                  <div style={{ width: '100%', backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${selectedRecord.confidence_score * 100}%`,
                        height: 8,
                        backgroundColor: selectedRecord.confidence_score > 0.8 ? '#52c41a' : 
                                       selectedRecord.confidence_score > 0.6 ? '#faad14' : '#ff4d4f',
                        borderRadius: 4
                      }}
                    />
                  </div>
                </div>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Score">
              <Tag color="gold">{selectedRecord.score}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Record Created">
              {dayjs(selectedRecord.created_at).format('MMM D, YYYY h:mm:ss A')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {dayjs(selectedRecord.updated_at).format('MMM D, YYYY h:mm:ss A')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceManagementPage;
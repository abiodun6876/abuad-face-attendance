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
  Modal,
  Descriptions,
  Avatar,
  Tooltip,
  Badge,
  Spin
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
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface AttendanceRecord {
  id: string;
  student_id: string;
  matric_number: string;
  name: string;
  date: string;
  time: string;
  status: 'present' | 'absent' | 'late';
  method: 'face_recognition' | 'manual' | 'qr_code';
  confidence: number | null;
  course_code: string;
  course_name: string;
  faculty: string;
  department: string;
  program: string;
  level: string;
  session: string;
  semester: number;
  venue: string;
  device_id: string;
  ip_address: string;
  created_at: string;
  updated_at: string;
}

const AttendanceManagementPage: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalUsers: 0,
    present: 0,
    punctual: 0,
    late: 0,
    absent: 0,
    attendanceRate: 0,
    today: 0
  });

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    course: '',
    level: '',
    department: '',
    status: '',
    method: '',
    dateRange: null as [Dayjs, Dayjs] | null
  });

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      // Fetch attendance records
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .order('created_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Fetch total students
      const { count: studentCount, error: studentError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      if (studentError) throw studentError;

      if (attendance) {
        setAttendanceData(attendance);
        setFilteredData(attendance);

        // Extract unique values for filters
        const uniqueCourses = Array.from(new Set(attendance.map(record => record.course_code).filter(Boolean)));
        const uniqueLevels = Array.from(new Set(attendance.map(record => record.level).filter(Boolean)));
        const uniqueDepartments = Array.from(new Set(attendance.map(record => record.department).filter(Boolean)));

        setCourses(uniqueCourses as string[]);
        setLevels(uniqueLevels as string[]);
        setDepartments(uniqueDepartments as string[]);

        // Calculate statistics
        calculateStats(attendance, studentCount || 0);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (data: AttendanceRecord[], studentCount: number) => {
    const today = dayjs().format('YYYY-MM-DD');
    const todayRecords = data.filter(record => record.date === today);

    // For a specific session/day, we usually want stats for that day.
    // If no date filter is applied, these stats are overall.
    // Let's calculate based on unique students in the current dataset or overall.

    const presentCount = data.filter(record => record.status === 'present').length;
    const lateCount = data.filter(record => record.status === 'late').length;
    const absentCount = data.filter(record => record.status === 'absent').length;

    // Total present = present + late
    const totalPresent = presentCount + lateCount;
    const rate = studentCount > 0 ? (totalPresent / studentCount) * 100 : 0;

    setStats({
      totalRecords: data.length,
      totalUsers: studentCount,
      present: totalPresent,
      punctual: presentCount,
      late: lateCount,
      absent: absentCount,
      attendanceRate: Math.round(rate),
      today: todayRecords.length
    });
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = [...attendanceData];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.name?.toLowerCase().includes(searchLower) ||
        record.matric_number?.toLowerCase().includes(searchLower) ||
        record.course_code?.toLowerCase().includes(searchLower) ||
        record.course_name?.toLowerCase().includes(searchLower)
      );
    }

    // Course filter
    if (filters.course) {
      filtered = filtered.filter(record => record.course_code === filters.course);
    }

    // Level filter
    if (filters.level) {
      filtered = filtered.filter(record => record.level === filters.level);
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(record => record.department === filters.department);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    // Method filter
    if (filters.method) {
      filtered = filtered.filter(record => record.method === filters.method);
    }

    // Date range filter
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.date);
        return recordDate.isAfter(startDate.subtract(1, 'day')) &&
          recordDate.isBefore(endDate.add(1, 'day'));
      });
    }

    setFilteredData(filtered);
    // Note: We don't update studentCount here because it's global
    calculateStats(filtered, stats.totalUsers);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      course: '',
      level: '',
      department: '',
      status: '',
      method: '',
      dateRange: null
    });
    setFilteredData(attendanceData);
    calculateStats(attendanceData, stats.totalUsers);
  };

  // View record details
  const viewRecordDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // Export data
  const exportToCSV = () => {
    const headers = ['Matric Number', 'Name', 'Course Code', 'Course Name', 'Date', 'Time', 'Status', 'Method', 'Confidence', 'Faculty', 'Department', 'Program', 'Level', 'Session', 'Semester', 'Venue'];

    const csvData = filteredData.map(record => [
      record.matric_number,
      record.name,
      record.course_code,
      record.course_name,
      record.date,
      record.time,
      record.status,
      record.method,
      record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : '',
      record.faculty,
      record.department,
      record.program,
      record.level,
      record.session,
      record.semester,
      record.venue
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
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: AttendanceRecord) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#000' }}>
            {text?.charAt(0) || 'S'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</div>
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
      width: 150,
      render: (code: string, record: AttendanceRecord) => (
        <div>
          <Tag color="default" style={{ marginBottom: 4, fontWeight: 500 }}>
            {code}
          </Tag>
          <div style={{ fontSize: '12px' }}>{record.course_name}</div>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      width: 150,
      render: (record: AttendanceRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            <CalendarOutlined style={{ marginRight: 4, fontSize: '12px' }} />
            {dayjs(record.date).format('MMM D, YYYY')}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined style={{ marginRight: 4, fontSize: '11px' }} />
            {record.time}
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
          <Tag color={config.color} icon={config.icon} style={{ borderRadius: '4px' }}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 120,
      render: (method: string) => (
        <Badge
          status={method === 'face_recognition' ? 'success' : 'default'}
          text={
            method === 'face_recognition' ? 'Face ID' :
              method === 'manual' ? 'Manual' : 'QR Code'
          }
        />
      ),
    },
    {
      title: 'Level/Dept',
      key: 'level_dept',
      width: 150,
      render: (record: AttendanceRecord) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            <Tag style={{ fontSize: '11px', padding: '0 6px' }}>L{record.level}</Tag>
            {record.department && (
              <Text type="secondary" style={{ marginLeft: 4, fontSize: '11px' }}>
                {record.department}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (record: AttendanceRecord) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => viewRecordDetails(record)}
          size="small"
        />
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
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', background: '#fff' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
          Attendance Management
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Real-time tracking and reporting for student attendance
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<UserOutlined style={{ fontSize: '16px', color: '#8c8c8c' }} />}
              valueStyle={{ fontWeight: 700, fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Present"
              value={stats.present}
              prefix={<CheckCircleOutlined style={{ fontSize: '16px', color: '#52c41a' }} />}
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Punctual"
              value={stats.punctual}
              prefix={<ClockCircleOutlined style={{ fontSize: '16px', color: '#1890ff' }} />}
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Late"
              value={stats.late}
              prefix={<ClockCircleOutlined style={{ fontSize: '16px', color: '#faad14' }} />}
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="Absent"
              value={stats.absent}
              prefix={<CloseCircleOutlined style={{ fontSize: '16px', color: '#ff4d4f' }} />}
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="stat-card" style={{ background: '#000' }}>
            <Statistic
              title={<span style={{ color: '#fff' }}>Attendance Rate</span>}
              value={stats.attendanceRate}
              suffix={<span style={{ color: '#fff', fontSize: '14px' }}>%</span>}
              valueStyle={{ fontWeight: 700, fontSize: '24px', color: '#fff' }}
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
              size="middle"
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              size="middle"
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
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              size="middle"
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Course"
              style={{ width: '100%' }}
              value={filters.course || undefined}
              onChange={(value) => setFilters({ ...filters, course: value })}
              size="middle"
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
              onChange={(value) => setFilters({ ...filters, level: value })}
              size="middle"
              allowClear
            >
              {levels.map(level => (
                <Option key={level} value={level}>
                  {level}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Department"
              style={{ width: '100%' }}
              value={filters.department || undefined}
              onChange={(value) => setFilters({ ...filters, department: value })}
              size="middle"
              allowClear
            >
              {departments.map(dept => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value })}
              size="middle"
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
              value={filters.method || undefined}
              onChange={(value) => setFilters({ ...filters, method: value })}
              size="middle"
              allowClear
            >
              <Option value="face_recognition">Face ID</Option>
              <Option value="manual">Manual</Option>
              <Option value="qr_code">QR Code</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] })}
              size="middle"
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading attendance records...</div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
              responsive: true
            }}
            scroll={{ x: 1200 }}
            size="middle"
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="Student ID">{record.student_id}</Descriptions.Item>
                  <Descriptions.Item label="Course">{record.course_name}</Descriptions.Item>
                  <Descriptions.Item label="Attendance Date">
                    {dayjs(record.date).format('dddd, MMMM D, YYYY')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Check-in Time">
                    {record.time}
                  </Descriptions.Item>
                  <Descriptions.Item label="Faculty">
                    {record.faculty || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    {record.department || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Program">
                    {record.program || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Session">
                    {record.session || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Semester">
                    {record.semester || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Venue">
                    {record.venue || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Device ID">
                    {record.device_id || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="IP Address">
                    {record.ip_address || 'N/A'}
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
        )}
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
        width={700}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Student">
              <Space>
                <Avatar style={{ backgroundColor: '#1890ff' }}>
                  {selectedRecord.name?.charAt(0) || 'S'}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedRecord.name}</div>
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
                <div style={{ marginTop: 4 }}>{selectedRecord.course_name}</div>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Attendance Date">
              {dayjs(selectedRecord.date).format('dddd, MMMM D, YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in Time">
              {selectedRecord.time}
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
              <Tag color={selectedRecord.method === 'face_recognition' ? 'green' : 'blue'}>
                {selectedRecord.method.replace('_', ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Confidence Score">
              {selectedRecord.confidence ? (
                <div>
                  <Text strong>{(selectedRecord.confidence * 100).toFixed(1)}%</Text>
                  <div style={{ width: '100%', backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${selectedRecord.confidence * 100}%`,
                        height: 8,
                        backgroundColor: selectedRecord.confidence > 0.8 ? '#52c41a' :
                          selectedRecord.confidence > 0.6 ? '#faad14' : '#ff4d4f',
                        borderRadius: 4
                      }}
                    />
                  </div>
                </div>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Academic Info">
              <div>
                <div><strong>Faculty:</strong> {selectedRecord.faculty || 'N/A'}</div>
                <div><strong>Department:</strong> {selectedRecord.department || 'N/A'}</div>
                <div><strong>Program:</strong> {selectedRecord.program || 'N/A'}</div>
                <div><strong>Level:</strong> {selectedRecord.level || 'N/A'}</div>
                <div><strong>Session:</strong> {selectedRecord.session || 'N/A'}</div>
                <div><strong>Semester:</strong> {selectedRecord.semester || 'N/A'}</div>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Venue">
              {selectedRecord.venue || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Technical Info">
              <div>
                <div><strong>Device ID:</strong> {selectedRecord.device_id || 'N/A'}</div>
                <div><strong>IP Address:</strong> {selectedRecord.ip_address || 'N/A'}</div>
              </div>
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
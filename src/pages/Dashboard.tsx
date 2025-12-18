// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Table,
  Space,
  Button,
  DatePicker,
  Select,
  Alert,
  Progress,
  Tag,
  Badge
} from 'antd';
import {
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  BarChart as BarChartIcon,
  Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface AttendanceStats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
  totalEvents: number;
  activeEvents: number;
}

interface RecentAttendance {
  id: string;
  student_name: string;
  matric_number: string;
  course_code: string;
  status: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AttendanceStats>({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0,
    totalEvents: 0,
    activeEvents: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch total students
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch today's attendance
      const today = dayjs().startOf('day').toISOString();
      const { data: todayAttendance } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('created_at', today);

      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const absentToday = todayAttendance?.filter(a => a.status === 'absent').length || 0;
      const attendanceRate = totalStudents ? (presentToday / totalStudents) * 100 : 0;

      // Fetch events
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: activeEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString());

      // Fetch recent attendance
      const { data: recentAtt } = await supabase
        .from('attendance_records')
        .select(`
          *,
          student:students(name, matric_number)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const formattedRecent = recentAtt?.map(record => ({
        id: record.id,
        student_name: record.student?.name || 'Unknown',
        matric_number: record.student?.matric_number || 'N/A',
        course_code: record.course_code || 'N/A',
        status: record.status,
        timestamp: record.created_at
      })) || [];

      setStats({
        totalStudents: totalStudents || 0,
        presentToday,
        absentToday,
        attendanceRate,
        totalEvents: totalEvents || 0,
        activeEvents: activeEvents || 0
      });

      setRecentAttendance(formattedRecent);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const columns = [
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
      title: 'Course',
      dataIndex: 'course_code',
      key: 'course_code',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'present' ? 'success' : status === 'absent' ? 'error' : 'warning'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => dayjs(timestamp).format('HH:mm'),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2}>Dashboard</Title>
          <Text type="secondary">Attendance System Overview</Text>
        </Col>
        <Col>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
            <Select
              placeholder="Filter by Faculty"
              style={{ width: 150 }}
              value={selectedFaculty}
              onChange={setSelectedFaculty}
            >
              <Option value="all">All Faculties</Option>
              {/* Add faculty options dynamically */}
            </Select>
            <Button
              icon={<RefreshCw size={16} />}
              onClick={fetchDashboardData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 30 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents}
              prefix={<Users size={20} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Present Today"
              value={stats.presentToday}
              prefix={<CheckCircle size={20} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Absent Today"
              value={stats.absentToday}
              prefix={<XCircle size={20} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Attendance Rate"
              value={stats.attendanceRate.toFixed(1)}
              suffix="%"
              prefix={<TrendingUp size={20} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Total Events"
              value={stats.totalEvents}
              prefix={<Calendar size={20} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Active Events"
              value={stats.activeEvents}
              prefix={<Activity size={20} />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Attendance Rate Progress */}
      <Card style={{ marginBottom: 30 }}>
        <Title level={4}>Overall Attendance Rate</Title>
        <div style={{ marginTop: 20 }}>
          <Progress
            percent={Math.round(stats.attendanceRate)}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <Text type="secondary">Target: 95%</Text>
            <Text type="secondary">Current: {stats.attendanceRate.toFixed(1)}%</Text>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <Clock size={18} />
                <Text strong>Recent Attendance</Text>
              </Space>
            }
            extra={
              <Button
                type="link"
                icon={<Download size={16} />}
                onClick={() => {/* Add export functionality */}}
              >
                Export
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={recentAttendance}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BarChartIcon size={18} />
                <Text strong>Quick Actions</Text>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                block
                size="large"
                onClick={() => window.location.href = '/attendance'}
              >
                Take Attendance Now
              </Button>
              <Button
                block
                size="large"
                onClick={() => window.location.href = '/enroll'}
              >
                Enroll New Student
              </Button>
              <Button
                block
                size="large"
                onClick={() => window.location.href = '/events'}
              >
                Schedule Event
              </Button>
              <Button
                block
                size="large"
                onClick={() => window.location.href = '/sync'}
              >
                Sync Data
              </Button>
            </Space>

            <Alert
              message="System Status"
              description="All systems operational"
              type="success"
              showIcon
              style={{ marginTop: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Stats by Time Period */}
      <Card style={{ marginTop: 30 }}>
        <Title level={4}>Attendance Trends</Title>
        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={12}>
            <Card size="small">
              <Text strong>This Week</Text>
              <div style={{ marginTop: 10 }}>
                <Progress
                  percent={75}
                  status="active"
                  size="small"
                />
                <Text type="secondary">Average: 75%</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small">
              <Text strong>This Month</Text>
              <div style={{ marginTop: 10 }}>
                <Progress
                  percent={82}
                  status="active"
                  size="small"
                />
                <Text type="secondary">Average: 82%</Text>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;
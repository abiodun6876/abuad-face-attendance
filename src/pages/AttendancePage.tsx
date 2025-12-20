// src/pages/AttendancePage.tsx - ENHANCED WITH FULL CRUD OPERATIONS
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
  message,
  Popconfirm,
  Drawer,
  Tabs,
  Upload,
  Tooltip,
  Switch
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
  Eye,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  UserPlus,
  FileText,
  Upload as UploadIcon,
  Check,
  AlertCircle,
  BarChart3,
  Database,
  HardDrive
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

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
  const [viewMode, setViewMode] = useState<'take' | 'view' | 'manage'>('take');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [localRecords, setLocalRecords] = useState<any[]>([]);
  const [useLocalStorage, setUseLocalStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('online'); // CORRECT

  // Fetch initial data
  useEffect(() => {
    fetchFaculties();
    fetchCourses();
    loadLocalRecords();
  }, []);

  // Load records from localStorage
  const loadLocalRecords = () => {
    try {
      const keys = Object.keys(localStorage);
      const localAttendanceKeys = keys.filter(key => key.startsWith('attendance_'));
      const records: any[] = [];
      
      localAttendanceKeys.forEach(key => {
        const record = JSON.parse(localStorage.getItem(key) || '{}');
        records.push({
          ...record,
          id: key,
          source: 'local_storage',
          is_local: true
        });
      });
      
      setLocalRecords(records);
    } catch (error) {
      console.error('Error loading local records:', error);
    }
  };

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
      // Fetch from database if available, otherwise use sample data
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (!error && data && data.length > 0) {
        setCourses(data);
      } else {
        // Fallback to sample data
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
      }
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

  // CRUD Operations for Database
  const createAttendanceRecord = async (record: any, isLocal = false) => {
    try {
      if (isLocal || useLocalStorage) {
        // Save to localStorage
        const key = `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const localRecord = {
          ...record,
          id: key,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'local_manual',
          is_local: true
        };
        
        localStorage.setItem(key, JSON.stringify(localRecord));
        setLocalRecords(prev => [...prev, localRecord]);
        message.success('Attendance saved locally');
        return { data: localRecord, error: null };
      } else {
        // Save to database
        const { data, error } = await supabase
          .from('attendance_records')
          .insert([record])
          .select()
          .single();

        if (!error) {
          message.success('Attendance saved to database');
        }
        return { data, error };
      }
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      return { data: null, error };
    }
  };

  const updateAttendanceRecord = async (id: string, updates: any, isLocal = false) => {
    try {
      if (isLocal) {
        // Update in localStorage
        const key = id;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        const updated = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString()
        };
        
        localStorage.setItem(key, JSON.stringify(updated));
        loadLocalRecords(); // Refresh local records
        message.success('Local record updated');
        return { data: updated, error: null };
      } else {
        // Update in database
        const { data, error } = await supabase
          .from('attendance_records')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (!error) {
          message.success('Record updated successfully');
        }
        return { data, error };
      }
    } catch (error: any) {
      console.error('Error updating record:', error);
      return { data: null, error };
    }
  };

  const deleteAttendanceRecord = async (id: string, isLocal = false) => {
    try {
      if (isLocal) {
        // Delete from localStorage
        localStorage.removeItem(id);
        setLocalRecords(prev => prev.filter(record => record.id !== id));
        message.success('Local record deleted');
        return { error: null };
      } else {
        // Delete from database
        const { error } = await supabase
          .from('attendance_records')
          .delete()
          .eq('id', id);

        if (!error) {
          message.success('Record deleted successfully');
        }
        return { error };
      }
    } catch (error: any) {
      console.error('Error deleting record:', error);
      return { error };
    }
  };

  // Sync local records to database
  const syncLocalToDatabase = async () => {
    setLoading(true);
    try {
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('attendance_'));
      let successCount = 0;
      let errorCount = 0;

      for (const key of localKeys) {
        const record = JSON.parse(localStorage.getItem(key) || '{}');
        
        // Remove local-only fields
        const { id, is_local, source, ...dbRecord } = record;
        
        const { error } = await supabase
          .from('attendance_records')
          .insert([dbRecord]);

        if (!error) {
          localStorage.removeItem(key);
          successCount++;
        } else {
          errorCount++;
        }
      }

      loadLocalRecords();
      
      if (successCount > 0) {
        message.success(`Synced ${successCount} records to database`);
      }
      if (errorCount > 0) {
        message.error(`Failed to sync ${errorCount} records`);
      }
      
    } catch (error) {
      console.error('Error syncing records:', error);
      message.error('Failed to sync records');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceScanComplete = async (result: any) => {
    console.log('Attendance scan result:', result);
    
    if (result.success) {
      try {
        setLoading(true);
        
        // Check if student exists
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('matric_number', result.student?.matric_number || result.matricNumber)
          .single();

        const student = studentData || result.student;

        // Create attendance record
        const attendanceRecord = {
          student_id: student?.student_id || student?.id || `student_${Date.now()}`,
          student_name: student?.name || result.student?.name || 'Unknown Student',
          matric_number: student?.matric_number || result.student?.matric_number || 'N/A',
          course_code: courseCode,
          course_title: courseTitle,
          faculty_id: selectedFaculty,
          department_name: departments.find(d => d.id === selectedDepartment)?.name || '',
          level: selectedLevel,
          attendance_date: new Date().toISOString().split('T')[0],
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'face_recognition',
          confidence_score: result.confidence || 0.85,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Saving attendance record:', attendanceRecord);

        const { data, error } = await createAttendanceRecord(attendanceRecord, useLocalStorage);

        if (error) {
          console.error('Error saving attendance:', error);
          result.message = `Failed to save: ${error.message}`;
          result.success = false;
        } else {
          result.recordId = data?.id;
          result.student = student;
          result.attendanceRecord = data;
          result.isLocal = useLocalStorage;
          message.success(`Attendance recorded ${useLocalStorage ? 'locally' : 'to database'}!`);
          
          // Refresh attendance
          if (!useLocalStorage) {
            fetchTodaysAttendance();
          } else {
            loadLocalRecords();
          }
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
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_code', courseCode)
        .eq('attendance_date', today)
        .order('check_in_time', { ascending: false });
      
      if (!error) {
        setAttendanceRecords(data || []);
      } else {
        console.error('Error fetching attendance:', error);
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
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error) {
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

  const handleManualAttendance = (student: any, status: 'present' | 'absent' | 'late' | 'excused') => {
    const attendanceRecord = {
      student_id: student.student_id || student.id,
      student_name: student.name,
      matric_number: student.matric_number,
      course_code: courseCode,
      course_title: courseTitle,
      faculty_id: selectedFaculty,
      department_id: selectedDepartment,
      level: selectedLevel,
      attendance_date: new Date().toISOString().split('T')[0],
      check_in_time: new Date().toISOString(),
      status: status,
      verification_method: 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    createAttendanceRecord(attendanceRecord, useLocalStorage)
      .then(({ error }) => {
        if (error) {
          console.error('Error saving manual attendance:', error);
          message.error('Failed to save attendance');
        } else {
          message.success(`Marked ${student.name} as ${status}`);
          if (!useLocalStorage) {
            fetchTodaysAttendance();
          } else {
            loadLocalRecords();
          }
        }
      });
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  const handleDeleteRecord = async (record: any) => {
    await deleteAttendanceRecord(record.id, record.is_local);
    if (!record.is_local) {
      fetchTodaysAttendance();
    } else {
      loadLocalRecords();
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updates = {
        status: editingRecord.status,
        remarks: editingRecord.remarks || ''
      };

      await updateAttendanceRecord(editingRecord.id, updates, editingRecord.is_local);
      
      if (!editingRecord.is_local) {
        fetchTodaysAttendance();
      } else {
        loadLocalRecords();
      }
      
      setShowEditModal(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error saving edit:', error);
      message.error('Failed to update record');
    }
  };

  const exportAttendance = () => {
    const data = {
      course: courseCode,
      title: courseTitle,
      date: new Date().toLocaleDateString(),
      records: [...attendanceRecords, ...localRecords]
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${courseCode}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAttendance = [...attendanceRecords, ...localRecords].length;
  const presentCount = [...attendanceRecords, ...localRecords].filter(r => r.status === 'present').length;
  const absentCount = [...attendanceRecords, ...localRecords].filter(r => r.status === 'absent').length;

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
        <Space wrap>
          <Tooltip title="Mark Present">
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={12} />}
              onClick={() => handleManualAttendance(record, 'present')}
            />
          </Tooltip>
          <Tooltip title="Mark Absent">
            <Button
              size="small"
              danger
              icon={<XCircle size={12} />}
              onClick={() => handleManualAttendance(record, 'absent')}
            />
          </Tooltip>
          <Tooltip title="Mark Late">
            <Button
              size="small"
              type="default"
              icon={<Clock size={12} />}
              onClick={() => handleManualAttendance(record, 'late')}
            />
          </Tooltip>
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
      title: 'Matric',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Time',
      dataIndex: 'check_in_time',
      key: 'check_in_time',
      render: (time: string) => new Date(time).toLocaleTimeString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => (
        <Tag color={
          status === 'present' ? 'success' :
          status === 'late' ? 'warning' :
          status === 'excused' ? 'blue' : 'error'
        }>
          {status.toUpperCase()}
          {record.is_local && ' (Local)'}
        </Tag>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'verification_method',
      key: 'verification_method',
      render: (method: string) => (
        <Tag color={method === 'face_recognition' ? 'blue' : 'orange'}>
          {method}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Edit Record">
            <Button
              size="small"
              icon={<Edit size={12} />}
              onClick={() => handleEditRecord(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this record?"
            description="Are you sure you want to delete this attendance record?"
            onConfirm={() => handleDeleteRecord(record)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Record">
              <Button
                size="small"
                danger
                icon={<Trash2 size={12} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const localColumns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
    },
    {
      title: 'Matric',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Course',
      dataIndex: 'course_code',
      key: 'course_code',
    },
    {
      title: 'Date',
      dataIndex: 'attendance_date',
      key: 'attendance_date',
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
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<Edit size={12} />}
              onClick={() => handleEditRecord(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Delete local record?"
              onConfirm={() => handleDeleteRecord(record)}
            >
              <Button
                size="small"
                danger
                icon={<Trash2 size={12} />}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Sync to DB">
            <Button
              size="small"
              type="primary"
              icon={<Database size={12} />}
              onClick={async () => {
                // Remove local-only fields
                const { id, is_local, ...dbRecord } = record;
                const { error } = await supabase
                  .from('attendance_records')
                  .insert([dbRecord]);

                if (!error) {
                  localStorage.removeItem(id);
                  loadLocalRecords();
                  message.success('Record synced to database');
                }
              }}
            />
          </Tooltip>
        </Space>
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
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              type={viewMode === 'take' ? 'primary' : 'default'}
              icon={<Camera size={16} />}
              onClick={() => setViewMode('take')}
            >
              Take Attendance
            </Button>
            <Button
              type={viewMode === 'view' ? 'primary' : 'default'}
              icon={<Eye size={16} />}
              onClick={() => setViewMode('view')}
            >
              View Records
            </Button>
            <Button
              type={viewMode === 'manage' ? 'primary' : 'default'}
              icon={<Edit size={16} />}
              onClick={() => setViewMode('manage')}
            >
              Manage Records
            </Button>
          </Space>

          <Space>
            <Tooltip title="Toggle Local/Database Storage">
              <Switch
                checkedChildren={<Database size={12} />}
                unCheckedChildren={<HardDrive size={12} />}
                checked={useLocalStorage}
                onChange={setUseLocalStorage}
              />
            </Tooltip>
            <Text type="secondary">
              {useLocalStorage ? 'Local Storage' : 'Database'}
            </Text>
          </Space>
        </div>

        {viewMode === 'take' ? (
          <>
            {!isScanning ? (
              <>
                <Alert
                  message="Attendance Setup"
                  description={
                    <div>
                      <p>Select course details to start attendance</p>
                      <p>
                        <Tag color={useLocalStorage ? 'orange' : 'blue'} icon={useLocalStorage ? <HardDrive /> : <Database />}>
                          {useLocalStorage ? 'Saving to Local Storage' : 'Saving to Database'}
                        </Tag>
                      </p>
                    </div>
                  }
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
                      <Space style={{ marginLeft: 10 }}>
                        <Button
                          icon={<UserPlus size={16} />}
                          onClick={() => {
                            fetchCourseStudents(courseCode);
                            setShowStudentModal(true);
                          }}
                        >
                          Manual Entry
                        </Button>
                        <Button
                          icon={<RefreshCw size={16} />}
                          onClick={fetchTodaysAttendance}
                          loading={loading}
                        >
                          Refresh
                        </Button>
                        <Button
                          icon={<BarChart3 size={16} />}
                          onClick={() => setShowStats(true)}
                        >
                          Stats
                        </Button>
                      </Space>
                    )}
                  </div>
                </Form>

                {/* Today's Attendance Summary */}
                {(attendanceRecords.length > 0 || localRecords.length > 0) && (
                  <div style={{ marginTop: 30 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <Title level={4}>Today's Attendance Summary</Title>
                      <Space>
                        <Button
                          icon={<Download size={16} />}
                          onClick={exportAttendance}
                        >
                          Export
                        </Button>
                        <Button
                          icon={<UploadIcon size={16} />}
                          onClick={() => setShowUploadModal(true)}
                        >
                          Import
                        </Button>
                      </Space>
                    </div>
                    
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                      <Col xs={24} sm={6}>
                        <Statistic
                          title="Total Records"
                          value={totalAttendance}
                          prefix={<FileText size={20} />}
                        />
                      </Col>
                      <Col xs={24} sm={6}>
                        <Statistic
                          title="Present"
                          value={presentCount}
                          valueStyle={{ color: '#52c41a' }}
                          prefix={<CheckCircle size={20} />}
                        />
                      </Col>
                      <Col xs={24} sm={6}>
                        <Statistic
                          title="Absent"
                          value={absentCount}
                          valueStyle={{ color: '#ff4d4f' }}
                          prefix={<XCircle size={20} />}
                        />
                      </Col>
                      <Col xs={24} sm={6}>
                        <Statistic
                          title="Local Records"
                          value={localRecords.length}
                          valueStyle={{ color: '#fa8c16' }}
                          prefix={<HardDrive size={20} />}
                        />
                      </Col>
                    </Row>

                    <Tabs 
  activeKey={activeTab} 
  onChange={(key: string) => setActiveTab(key)}
>
  <TabPane tab="Database Records" key="online">
    <Table
      columns={attendanceColumns}
      dataSource={attendanceRecords}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10 }}
    />
  </TabPane>
  <TabPane tab="Local Records" key="offline">
    <Alert
      message="Local Storage Records"
      description="These records are saved in your browser. Sync them to the database when online."
      type="warning"
      showIcon
      style={{ marginBottom: 20 }}
      action={
        <Button
          type="primary"
          size="small"
          icon={<Database size={12} />}
          onClick={syncLocalToDatabase}
          loading={loading}
        >
          Sync All to DB
        </Button>
      }
    />
    <Table
      columns={localColumns}
      dataSource={localRecords}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10 }}
      locale={{
        emptyText: 'No local records found'
      }}
    />
  </TabPane>
</Tabs>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Alert
                  message="Face Recognition Mode"
                  description={
                    <div>
                      <p>Students should face the camera clearly</p>
                      <p>
                        <Tag color={useLocalStorage ? 'orange' : 'blue'} icon={useLocalStorage ? <HardDrive /> : <Database />}>
                          {useLocalStorage ? 'Saving to Local Storage' : 'Saving to Database'}
                        </Tag>
                      </p>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
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
                        <p><strong>Storage:</strong> 
                          <Tag color={attendanceResult.isLocal ? 'orange' : 'blue'} style={{ marginLeft: 8 }}>
                            {attendanceResult.isLocal ? 'Local Storage' : 'Database'}
                          </Tag>
                        </p>
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
        ) : viewMode === 'view' ? (
          <div>
            <Alert
              message="Attendance Records"
              description="View and search attendance records"
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
                  onChange={(value) => {
                    setSelectedCourse(value);
                    setCourseCode(value);
                  }}
                />
              </Col>
              <Col xs={24} md={12}>
                <Space>
                  <Button
                    type="primary"
                    icon={<Search size={16} />}
                    onClick={() => {
                      if (selectedCourse) {
                        fetchTodaysAttendance();
                      } else {
                        message.warning('Please select a course first');
                      }
                    }}
                  >
                    Search
                  </Button>
                  <Button
                    icon={<Filter size={16} />}
                    onClick={() => {
                      // Filter functionality
                      Modal.info({
                        title: 'Filter Options',
                        content: 'Filter functionality will be implemented here',
                      });
                    }}
                  >
                    Filter
                  </Button>
                </Space>
              </Col>
            </Row>
            
            <div style={{ marginTop: 20 }}>
              <Tabs 
  activeKey={activeTab} 
  onChange={(key: string) => setActiveTab(key)}
>
  <TabPane tab="Database Records" key="online">
    <Table
      columns={attendanceColumns}
      dataSource={attendanceRecords}
      rowKey="id"
      pagination={{ pageSize: 15 }}
      loading={loading}
    />
  </TabPane>
  <TabPane tab="Local Records" key="offline">
    <Table
      columns={localColumns}
      dataSource={localRecords}
      rowKey="id"
      pagination={{ pageSize: 15 }}
    />
  </TabPane>
</Tabs>
            </div>
          </div>
        ) : (
          <div>
            <Alert
              message="Record Management"
              description="Edit, delete, and manage attendance records"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <div style={{ marginBottom: 20 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<Plus size={16} />}
                  onClick={() => {
                    // Add new record functionality
                    setViewMode('take');
                  }}
                >
                  Add New Record
                </Button>
                <Button
                  icon={<UploadIcon size={16} />}
                  onClick={() => setShowUploadModal(true)}
                >
                  Bulk Import
                </Button>
                <Button
                  icon={<Download size={16} />}
                  onClick={exportAttendance}
                >
                  Export All
                </Button>
                {localRecords.length > 0 && (
                  <Button
                    type="primary"
                    icon={<Database size={16} />}
                    onClick={syncLocalToDatabase}
                    loading={loading}
                  >
                    Sync Local to DB ({localRecords.length})
                  </Button>
                )}
              </Space>
            </div>
            
            <Tabs 
  activeKey={activeTab} 
  onChange={(key: string) => setActiveTab(key)}
>
  <TabPane tab="Database Records" key="online">
    <Table
      columns={attendanceColumns}
      dataSource={attendanceRecords}
      rowKey="id"
      pagination={{ pageSize: 15 }}
      loading={loading}
      size="middle"
    />
  </TabPane>
  <TabPane tab="Local Records" key="offline">
    <Table
      columns={localColumns}
      dataSource={localRecords}
      rowKey="id"
      pagination={{ pageSize: 15 }}
    />
  </TabPane>
</Tabs>
          </div>
        )}
      </Card>

      {/* Manual Attendance Modal */}
      <Modal
        title={`Manual Attendance - ${courseCode}`}
        open={showStudentModal}
        onCancel={() => setShowStudentModal(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setShowStudentModal(false)}>
            Close
          </Button>
        ]}
      >
        <Alert
          message="Manual Attendance Entry"
          description="Click the action buttons to mark attendance status"
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
      </Modal>

      {/* Edit Record Modal */}
      <Modal
        title="Edit Attendance Record"
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          setEditingRecord(null);
        }}
        onOk={handleSaveEdit}
      >
        {editingRecord && (
          <Form layout="vertical">
            <Form.Item label="Student">
              <Input value={editingRecord.student_name} disabled />
            </Form.Item>
            <Form.Item label="Matric Number">
              <Input value={editingRecord.matric_number} disabled />
            </Form.Item>
            <Form.Item label="Course">
              <Input value={editingRecord.course_code} disabled />
            </Form.Item>
            <Form.Item label="Status" required>
              <Select
                value={editingRecord.status}
                onChange={(value) => setEditingRecord({...editingRecord, status: value})}
                options={[
                  { label: 'Present', value: 'present' },
                  { label: 'Absent', value: 'absent' },
                  { label: 'Late', value: 'late' },
                  { label: 'Excused', value: 'excused' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Remarks">
              <Input.TextArea
                value={editingRecord.remarks}
                onChange={(e) => setEditingRecord({...editingRecord, remarks: e.target.value})}
                placeholder="Add remarks if any"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Upload/Import Modal */}
      <Modal
        title="Import Attendance Records"
        open={showUploadModal}
        onCancel={() => setShowUploadModal(false)}
        footer={null}
      >
        <Upload.Dragger
          accept=".json,.csv"
          beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const content = e.target?.result as string;
                const records = JSON.parse(content);
                
                if (Array.isArray(records)) {
                  records.forEach(record => {
                    createAttendanceRecord(record, useLocalStorage);
                  });
                  message.success(`Imported ${records.length} records`);
                } else {
                  message.error('Invalid file format');
                }
              } catch (error) {
                message.error('Failed to parse file');
              }
              setShowUploadModal(false);
            };
            reader.readAsText(file);
            return false; // Prevent auto upload
          }}
        >
          <p className="ant-upload-drag-icon">
            <UploadIcon size={48} />
          </p>
          <p className="ant-upload-text">Click or drag file to upload</p>
          <p className="ant-upload-hint">
            Supports JSON files with attendance records
          </p>
        </Upload.Dragger>
      </Modal>

      {/* Statistics Drawer */}
      <Drawer
        title="Attendance Statistics"
        open={showStats}
        onClose={() => setShowStats(false)}
        width={400}
      >
        {courseCode && (
          <>
            <Statistic
              title="Total Students Today"
              value={totalAttendance}
              prefix={<Users size={20} />}
            />
            <Statistic
              title="Present"
              value={presentCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircle size={20} />}
              style={{ marginTop: 20 }}
            />
            <Statistic
              title="Absent"
              value={absentCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<XCircle size={20} />}
              style={{ marginTop: 20 }}
            />
            <Statistic
              title="Attendance Rate"
              value={totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) : 0}
              suffix="%"
              style={{ marginTop: 20 }}
            />
            <Statistic
              title="Local Records"
              value={localRecords.length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<HardDrive size={20} />}
              style={{ marginTop: 20 }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default AttendancePage;
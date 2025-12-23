// src/pages/EnrollmentPage.tsx - SIMPLIFIED VERSION FOR ATTENDANCE
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Typography, 
  Space,
  Alert,
  message,
  Row,
  Col,
  Steps,
  Tag,
  Input as AntdInput,
  Spin
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, GraduationCap, Calendar } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

// Local storage function - defined outside component
const saveImageToLocalStorage = (studentId: string, imageId: string, imageData: string) => {
  try {
    const key = `face_images_${studentId}_${imageId}`;
    
    // Compress image if needed
    if (imageData.length > 100000) {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Resize
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedData = canvas.toDataURL('image/jpeg', 0.7);
        localStorage.setItem(key, compressedData);
        console.log('Image saved to localStorage (compressed)');
      };
      img.src = imageData;
    } else {
      localStorage.setItem(key, imageData);
      console.log('Image saved to localStorage');
    }
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentData, setStudentData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [matricNumber, setMatricNumber] = useState<string>('');
  
  // State for fetched data - SIMPLIFIED
  const [programs, setPrograms] = useState<any[]>([]);
  const [levels, setLevels] = useState([
    { value: 100, label: '100 Level' },
    { value: 200, label: '200 Level' },
    { value: 300, label: '300 Level' },
    { value: 400, label: '400 Level' },
    { value: 500, label: '500 Level' },
  ]);

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ABU/${currentYear}/${randomNum}`;
  };

  // Fetch programs only
  const fetchPrograms = async () => {
    try {
      // Fetch programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, code, name, short_name')
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;
      setPrograms(programsData || []);

      console.log('Fetched programs:', programsData?.length || 0);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      // If programs table doesn't exist, use default options
      message.warning('Programs not loaded. Using default options.');
      setPrograms([
        { id: '1', code: 'CSC', name: 'Computer Science', short_name: 'CS' },
        { id: '2', code: 'EEE', name: 'Electrical Engineering', short_name: 'EE' },
        { id: '3', code: 'MED', name: 'Medicine', short_name: 'MD' },
        { id: '4', code: 'LAW', name: 'Law', short_name: 'LW' },
      ]);
    }
  };

  // Generate matric number when component mounts
  useEffect(() => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
    form.setFieldValue('matric_number', newMatric);
    
    // Fetch programs
    fetchPrograms();
  }, [form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        // Ensure matric number is set
        if (!values.matric_number?.trim()) {
          const newMatric = generateMatricNumber();
          values.matric_number = newMatric;
          setMatricNumber(newMatric);
          form.setFieldValue('matric_number', newMatric);
        }

        console.log('Proceeding with values:', values);
        setStudentData(values);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error('Error in handleNext:', error);
      const errorMessages = error.errorFields?.map((f: any) => f.errors.join(', ')).join('; ');
      message.error(errorMessages || 'Please fix form errors');
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleRegenerateMatric = () => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
    form.setFieldValue('matric_number', newMatric);
    message.success('New matric number generated');
  };

  const handleEnrollmentComplete = async (result: any) => {
    console.log('Face capture result:', {
      success: result.success,
      hasEmbedding: !!result.embedding,
      embeddingLength: result.embedding?.length,
      hasPhoto: !!result.photoUrl,
      message: result.message
    });
    
    if (result.success) {
      try {
        setLoading(true);
        
        // Use studentData from state
        const studentName = studentData.name?.trim();
        const studentId = matricNumber; // Use the generated matric number
        
        if (!studentName) {
          throw new Error('Student name is required');
        }

        // Check if student already exists
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('student_id', studentId)
          .maybeSingle();

        if (existingStudent) {
          // If matric number exists, generate a new one
          const newMatric = generateMatricNumber();
          setMatricNumber(newMatric);
          form.setFieldValue('matric_number', newMatric);
          message.warning('Matric number already exists, generating new one...');
          setLoading(false);
          return;
        }

        // Find selected program details
        const selectedProgram = studentData.program_id 
          ? programs.find(p => p.id === studentData.program_id)
          : null;

        // Get current academic year
        const currentYear = new Date().getFullYear();
        const academicSession = `${currentYear}/${currentYear + 1}`;

        // Prepare student data - SIMPLIFIED for attendance
        const studentRecord: any = {
          student_id: studentId,
          name: studentName,
          matric_number: studentId,
          // Removed email and phone as they're not needed for attendance
          gender: studentData.gender || 'male',
          enrollment_status: 'enrolled',
          face_match_threshold: 0.7,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Add academic fields - ESSENTIAL for attendance
        if (studentData.level) {
          studentRecord.level = parseInt(studentData.level);
        }
        if (selectedProgram) {
          studentRecord.program_id = selectedProgram.id;
          studentRecord.program = selectedProgram.name;
          studentRecord.program_name = selectedProgram.name;
          studentRecord.program_code = selectedProgram.code;
        }
        // Add academic session
        studentRecord.academic_session = academicSession;
        studentRecord.year_of_entry = currentYear;

        // Handle face data - ESSENTIAL for attendance
        if (result.embedding && result.embedding.length > 0) {
          console.log('Saving face embedding with length:', result.embedding.length);
          
          // Store embedding as JSON string (PostgreSQL friendly)
          studentRecord.face_embedding = JSON.stringify(result.embedding);
          studentRecord.face_enrolled_at = new Date().toISOString();
          
          if (result.photoUrl) {
            // Compress photo URL if too long
            studentRecord.photo_url = result.photoUrl.length > 100000 
              ? result.photoUrl.substring(0, 100000) 
              : result.photoUrl;
          }
        } else if (result.photoUrl) {
          // If no embedding but has photo
          console.log('No embedding, saving photo only');
          studentRecord.photo_url = result.photoUrl;
          studentRecord.face_enrolled_at = new Date().toISOString();
        }

        console.log('Saving student record:', {
          name: studentRecord.name,
          level: studentRecord.level,
          program: selectedProgram?.name,
          academic_session: studentRecord.academic_session,
          hasFaceData: !!studentRecord.face_embedding || !!studentRecord.photo_url
        });

        // Save to database
        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert([studentRecord])
          .select()
          .single();

        if (studentError) {
          console.error('Database error:', studentError);
          
          // Try without embedding if that's the issue
          if (studentError.message.includes('embedding')) {
            console.log('Trying without embedding...');
            const simpleRecord = { ...studentRecord };
            delete simpleRecord.face_embedding;
            
            const { data: student2, error: studentError2 } = await supabase
              .from('students')
              .insert([simpleRecord])
              .select()
              .single();
              
            if (studentError2) {
              throw new Error(`Failed to save student: ${studentError2.message}`);
            }
            
            // Save image to localStorage after database save
            if (result.photoUrl && student2) {
              saveImageToLocalStorage(student2.id, student2.id, result.photoUrl);
            }
            
            setEnrollmentResult({ 
              success: true, 
              student: student2,
              localStorageSaved: !!result.photoUrl
            });
          } else {
            throw new Error(`Database error: ${studentError.message}`);
          }
        } else {
          // Save image to localStorage after database save
          if (result.photoUrl && student) {
            saveImageToLocalStorage(student.id, student.id, result.photoUrl);
          }
          
          setEnrollmentResult({ 
            success: true, 
            student,
            faceCaptured: !!result.embedding,
            photoCaptured: !!result.photoUrl,
            localStorageSaved: !!result.photoUrl,
            program: selectedProgram?.name || 'Not specified',
            level: studentRecord.level,
            academic_session: academicSession
          });
        }

        setEnrollmentComplete(true);
        message.success('Student enrolled successfully!');

      } catch (error: any) {
        console.error('Enrollment error:', error);
        message.error(`Error: ${error.message}`);
        
        setEnrollmentResult({
          success: false,
          message: error.message
        });
      } finally {
        setLoading(false);
      }
    } else {
      message.error(`Face capture failed: ${result.message}`);
      setEnrollmentResult(result);
    }
  };

  const [academicForm] = Form.useForm();

  const handleAcademicSubmit = async () => {
    try {
      const values = await academicForm.validateFields();
      setStudentData((prev: any) => ({ ...prev, ...values }));
      message.success('Academic information saved');
      handleNext();
    } catch (error) {
      console.error('Academic form error:', error);
    }
  };

  const stepItems = [
    {
      title: 'Basic Information',
      icon: <User />,
      content: (
        <div>
          <Alert
            message="Student Information"
            description="Fill in the student's basic details. Matric number will be auto-generated."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 600, margin: '0 auto' }}
            initialValues={{ gender: 'male' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Full Name *"
                  name="name"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please enter student name',
                      whitespace: true
                    },
                    { 
                      min: 3, 
                      message: 'Name must be at least 3 characters' 
                    }
                  ]}
                  validateTrigger={['onChange', 'onBlur']}
                >
                  <Input 
                    placeholder="Enter student full name" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Matriculation Number *"
                  name="matric_number"
                  tooltip="This will also be used as Student ID"
                >
                  <Input.Group compact>
                    <AntdInput
                      value={matricNumber}
                      readOnly
                      size="large"
                      style={{ 
                        width: 'calc(100% - 120px)',
                        textTransform: 'uppercase',
                        backgroundColor: '#fafafa',
                        cursor: 'not-allowed'
                      }}
                      prefix={<GraduationCap size={16} />}
                    />
                    <Button
                      type="default"
                      size="large"
                      onClick={handleRegenerateMatric}
                      style={{ width: '120px' }}
                    >
                      Regenerate
                    </Button>
                  </Input.Group>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    Matric number is auto-generated. Click "Regenerate" for a new number.
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item label="Gender" name="gender">
                  <Select placeholder="Select gender" size="large">
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ),
    },
    {
      title: 'Academic Details',
      icon: <BookOpen />,
      content: (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Alert
            message="Academic Information"
            description="Select the student's academic program and level (Required for attendance tracking)"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {programs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Text style={{ display: 'block', marginTop: 16 }}>
                Loading programs...
              </Text>
            </div>
          ) : (
            <Form
              form={academicForm}
              layout="vertical"
              initialValues={{ level: 100 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item 
                    label="Level *" 
                    name="level"
                    rules={[{ required: true, message: 'Please select level' }]}
                    help="Required for course filtering in attendance"
                  >
                    <Select 
                      placeholder="Select level" 
                      size="large"
                      options={levels.map(level => ({
                        value: level.value,
                        label: level.label
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item 
                    label="Program *" 
                    name="program_id"
                    rules={[{ required: true, message: 'Please select program' }]}
                    help="Required for attendance reporting"
                  >
                    <Select 
                      placeholder="Select program" 
                      size="large"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={programs.map(program => ({
                        value: program.id,
                        label: `${program.code} - ${program.name}${program.short_name ? ` (${program.short_name})` : ''}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: 30, textAlign: 'center' }}>
                <Alert
                  type="warning"
                  message="Important for Attendance"
                  description="Level and Program information are required for attendance tracking and reporting. These cannot be changed easily after enrollment."
                  showIcon
                />
              </div>
            </Form>
          )}
        </div>
      ),
    },
    {
      title: 'Face Enrollment',
      icon: <Camera />,
      content: enrollmentComplete ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          {enrollmentResult?.success ? (
            <>
              <CheckCircle size={64} color="#52c41a" />
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Complete!
              </Title>
              
              <Card style={{ maxWidth: 500, margin: '20px auto', textAlign: 'left' }}>
                <Title level={4}>Student Summary</Title>
                <p><strong>Name:</strong> {enrollmentResult.student?.name}</p>
                <p><strong>Student ID:</strong> 
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.student_id}
                  </Tag>
                </p>
                <p><strong>Matric Number:</strong> 
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.matric_number}
                  </Tag>
                </p>
                <p><strong>Level:</strong> 
                  <Tag color="purple" style={{ marginLeft: 8 }}>
                    Level {enrollmentResult.level}
                  </Tag>
                </p>
                <p><strong>Program:</strong> {enrollmentResult.program}</p>
                <p><strong>Academic Session:</strong> {enrollmentResult.academic_session}</p>
                <p><strong>Status:</strong> <Tag color="success">Enrolled</Tag></p>
                <p><strong>Face Data:</strong> 
                  <Tag color={enrollmentResult?.faceCaptured ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceCaptured ? 'Embedding + Photo' : 'Photo Only'}
                  </Tag>
                </p>
                <p><strong>Local Storage:</strong> 
                  <Tag color={enrollmentResult?.localStorageSaved ? "green" : "gray"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.localStorageSaved ? 'Saved Locally' : 'Not Saved'}
                  </Tag>
                </p>
                <p><strong>Enrollment Date:</strong> {new Date().toLocaleDateString()}</p>
              </Card>
            </>
          ) : (
            <>
              <div style={{ color: '#ff4d4f', marginBottom: 20 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="30" stroke="#ff4d4f" strokeWidth="2"/>
                  <path d="M22 22L42 42M42 22L22 42" stroke="#ff4d4f" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Failed
              </Title>
              <Alert
                message="Error"
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type="error"
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
            </>
          )}
          
          <Space style={{ marginTop: 30 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                // Generate new matric number for next student
                const newMatric = generateMatricNumber();
                setMatricNumber(newMatric);
                form.setFieldValue('matric_number', newMatric);
                
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                form.resetFields();
                academicForm.resetFields();
                setStudentData({});
                setIsCameraActive(false);
                
                // Reset to initial values
                form.setFieldsValue({
                  gender: 'male',
                  matric_number: newMatric
                });
                
                // Reset academic form
                academicForm.setFieldsValue({
                  level: 100
                });
              }}
            >
              {enrollmentResult?.success ? 'Enroll Another Student' : 'Try Again'}
            </Button>
            {enrollmentResult?.success && (
              <>
                <Button 
                  size="large"
                  onClick={() => window.location.href = '/students'}
                >
                  View All Students
                </Button>
                <Button 
                  size="large"
                  type="primary"
                  onClick={() => window.location.href = '/attendance'}
                >
                  Take Attendance
                </Button>
              </>
            )}
          </Space>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Face Enrollment"
            description="Capture facial data for biometric authentication. Ensure good lighting and face the camera directly."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {studentData.name && (
            <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Text strong>Student: </Text>
                  <br />
                  <Text>{studentData.name}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>Student ID: </Text>
                  <br />
                  <Tag color="blue">{matricNumber}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>Status: </Text>
                  <br />
                  <Tag color="orange">Pending Face Enrollment</Tag>
                </Col>
              </Row>
              {studentData.level && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Text strong>Level: </Text>
                    <br />
                    <Tag color="purple">Level {studentData.level}</Tag>
                  </Col>
                  <Col span={12}>
                    <Text strong>Program: </Text>
                    <br />
                    <Text>
                      {programs.find(p => p.id === studentData.program_id)?.name || 'Not selected'}
                    </Text>
                  </Col>
                </Row>
              )}
            </Card>
          )}
          
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {isCameraActive ? (
              <FaceCamera
                mode="enrollment"
                student={studentData}
                onEnrollmentComplete={handleEnrollmentComplete}
              />
            ) : (
              <Card>
                <Camera size={48} style={{ marginBottom: 20, color: '#1890ff' }} />
                <Title level={4}>Ready for Face Capture</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                  Ensure good lighting and face the camera directly. Click below to start.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera size={20} />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading}
                  style={{ marginBottom: 10 }}
                >
                  Start Face Enrollment
                </Button>
                
                <div style={{ marginTop: 20 }}>
                  <Alert
                    type="warning"
                    message="Important for Attendance"
                    description="Face data is required for biometric attendance marking. Please ensure good lighting."
                    style={{ marginBottom: 20 }}
                  />
                  
                  <div style={{ marginTop: 20 }}>
                    <Button onClick={handleBack}>
                      Back to Previous Step
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Face Enrollment</Title>
      <Text type="secondary">
        AFE Babalola University - Biometric Face Enrollment System
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Steps 
          current={currentStep} 
          style={{ marginBottom: 40 }}
          items={stepItems.map((item, index) => ({
            key: index,
            title: window.innerWidth < 768 ? '' : item.title,
            icon: item.icon,
          }))}
        />

        <div style={{ minHeight: 400 }}>
          {stepItems[currentStep].content}
        </div>

        {!enrollmentComplete && currentStep < 2 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={handleBack} size="large">
                  Back
                </Button>
              )}
              <Button 
                type="primary" 
                onClick={currentStep === 1 ? handleAcademicSubmit : handleNext} 
                size="large"
                loading={loading}
              >
                {currentStep === 1 ? 'Proceed to Face Enrollment' : 'Next'}
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnrollmentPage;
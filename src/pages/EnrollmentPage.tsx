// src/pages/EnrollmentPage.tsx - UPDATED FOR ACTUAL DATABASE
import React, { useState } from 'react';
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
  Spin,
  Tag
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, Mail, Phone, GraduationCap } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentData, setStudentData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ABU${currentYear}${randomNum}`;
  };

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['name', 'matric_number']);
        const values = form.getFieldsValue();
        
        if (!values.matric_number) {
          values.matric_number = generateMatricNumber();
          form.setFieldValue('matric_number', values.matric_number);
        }

        setStudentData(values);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error('Form validation failed:', error);
      if (error.errorFields) {
        const errorMessages = error.errorFields.map((field: any) => field.errors[0]).join(', ');
        message.error(`Please fix: ${errorMessages}`);
      } else {
        message.error('Please fill all required fields');
      }
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleEnrollmentComplete = async (result: any) => {
    console.log('Face capture result:', result);
    
    if (result.success) {
      try {
        setLoading(true);
        const formValues = form.getFieldsValue();
        
        // Prepare student data for database - using correct column names
        const studentRecord = {
          student_id: formValues.matric_number, // This is what your database expects
          name: formValues.name,
          email: formValues.email || null,
          phone: formValues.phone || null,
          gender: formValues.gender || null,
          matric_number: formValues.matric_number, // Also store in new column
          enrollment_status: 'enrolled',
          face_enrolled_at: new Date().toISOString(),
          face_embedding: result.embedding || [],
          photo_url: result.photoUrl || '',
          face_match_threshold: 0.7,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Saving student:', studentRecord);

        // Save to database
        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert([studentRecord])
          .select()
          .single();

        if (studentError) {
          console.error('Database error:', studentError);
          
          // Try without student_id if it fails
          if (studentError.message.includes('student_id')) {
            const studentRecordAlt = {
              name: formValues.name,
              email: formValues.email || null,
              phone: formValues.phone || null,
              gender: formValues.gender || null,
              matric_number: formValues.matric_number,
              enrollment_status: 'enrolled',
              face_enrolled_at: new Date().toISOString(),
              face_embedding: result.embedding || [],
              photo_url: result.photoUrl || '',
              face_match_threshold: 0.7,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            const { data: student2, error: studentError2 } = await supabase
              .from('students')
              .insert([studentRecordAlt])
              .select()
              .single();
              
            if (studentError2) {
              throw new Error(`Database error: ${studentError2.message}`);
            }
            
            // Save face enrollment
            if (student2) {
              await saveFaceEnrollment(student2.id, result);
            }
            
            setEnrollmentResult(result);
            setEnrollmentComplete(true);
            message.success('Student enrolled successfully!');
            return;
          }
          
          throw new Error(`Database error: ${studentError.message}`);
        }

        console.log('Student saved successfully:', student);

        // Save face enrollment
        if (student) {
          await saveFaceEnrollment(student.id, result);
        }

        setEnrollmentResult(result);
        setEnrollmentComplete(true);
        message.success('Student enrolled successfully!');

      } catch (error: any) {
        console.error('Enrollment error:', error);
        message.error(`Failed to save student: ${error.message || 'Unknown error'}`);
        
        setEnrollmentResult({
          success: false,
          message: error.message || 'Failed to save student data'
        });
      } finally {
        setLoading(false);
      }
    } else {
      message.error(`Face capture failed: ${result.message}`);
      setEnrollmentResult(result);
    }
  };

  const saveFaceEnrollment = async (studentId: string, result: any) => {
    try {
      const faceEnrollmentRecord = {
        student_id: studentId,
        embedding: result.embedding || [],
        photo_url: result.photoUrl || '',
        quality_score: result.quality || 0.8,
        enrolled_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: faceError } = await supabase
        .from('face_enrollments')
        .insert([faceEnrollmentRecord]);

      if (faceError) {
        console.error('Face enrollment save error:', faceError);
      }
    } catch (error) {
      console.error('Error saving face enrollment:', error);
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
            description="Fill in the student's basic details"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 600, margin: '0 auto' }}
            initialValues={{
              gender: 'male'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Full Name *"
                  name="name"
                  rules={[{ required: true, message: 'Please enter student name' }]}
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
                  rules={[{ required: true, message: 'Please enter matric number' }]}
                >
                  <Input 
                    placeholder="e.g., ABU24001" 
                    prefix={<GraduationCap size={16} />}
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24} md={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Please enter valid email' }
                  ]}
                >
                  <Input 
                    placeholder="student@abuad.edu.ng" 
                    prefix={<Mail size={16} />}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col span={24} md={12}>
                <Form.Item
                  label="Phone Number"
                  name="phone"
                >
                  <Input 
                    placeholder="+234 800 000 0000" 
                    prefix={<Phone size={16} />}
                    size="large"
                  />
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
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Alert
            message="Academic Information"
            description="Academic details can be added later. For now, let's capture the student's face."
            type="info"
            showIcon
            style={{ maxWidth: 600, margin: '0 auto' }}
          />
          
          <div style={{ marginTop: 30 }}>
            <Text type="secondary">
              You can update academic information later from the student management page.
            </Text>
          </div>
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
                <p><strong>Name:</strong> {studentData.name}</p>
                <p><strong>Matric Number:</strong> 
                  <Tag color="blue" style={{ marginLeft: 8 }}>{studentData.matric_number}</Tag>
                </p>
                {studentData.email && (
                  <p><strong>Email:</strong> {studentData.email}</p>
                )}
                <p><strong>Status:</strong> <Tag color="success">Enrolled</Tag></p>
                <p><strong>Enrollment Date:</strong> {new Date().toLocaleDateString()}</p>
              </Card>
            </>
          ) : (
            <>
              <CheckCircle size={64} color="#ff4d4f" />
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
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                form.resetFields();
                setStudentData({});
                setIsCameraActive(false);
              }}
            >
              {enrollmentResult?.success ? 'Enroll Another Student' : 'Try Again'}
            </Button>
            {enrollmentResult?.success && (
              <Button 
                size="large"
                onClick={() => window.location.href = '/students'}
              >
                View All Students
              </Button>
            )}
          </Space>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Face Enrollment"
            description="Capture facial data for biometric authentication"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {studentData.name && (
            <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>Student: </Text>
                  <Text>{studentData.name}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Matric: </Text>
                  <Tag color="blue">{studentData.matric_number}</Tag>
                </Col>
              </Row>
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
                  Click below to start the face enrollment process
                </Text>
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera size={20} />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading}
                >
                  Start Face Enrollment
                </Button>
                <div style={{ marginTop: 20 }}>
                  <Button onClick={handleBack}>
                    Back to Previous Step
                  </Button>
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
        AFE Babalola University - Face Authentication System
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
                onClick={handleNext} 
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
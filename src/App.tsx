// src/App.tsx - WITH BACK BUTTONS (MODIFIED)
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Spin, Alert, Typography, Space, ConfigProvider, theme, Card, Row, Col, Button } from 'antd';
import {
  UserPlus,
  Camera,
  Book,
  Home,
  ArrowLeft
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import { supabase } from './lib/supabase';
import './App.css';

const { Title, Text } = Typography;

interface ConnectionStatus {
  status: 'testing' | 'connected' | 'error';
  message: string;
  details?: any;
}

// Wrapper component to add back button to pages
const PageWrapper = ({ children, showBackButton = true }: { children: React.ReactNode, showBackButton?: boolean }) => {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--darker-bg)'
    }}>
      {/* Header with back button */}
      {showBackButton && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#fff',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={() => window.location.href = '/'}
            style={{
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 'auto'
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 500 }}>Back to Home</Text>
          </Button>
          <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>ABUAD_BIO_SYS</div>
        </div>
      )}

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

const HomeCards = () => {
  const cards = [
    {
      key: 'enroll',
      title: 'Biometric Enrollment',
      description: 'Register new students into the system with face recognition',
      icon: <UserPlus size={28} />,
      path: '/enroll',
      color: '#000',
    },
    {
      key: 'attendance',
      title: 'Face Attendance',
      description: 'Mark daily attendance using high-speed face authentication',
      icon: <Camera size={28} />,
      path: '/attendance',
      color: '#000',
    },
    {
      key: 'attendance-management',
      title: 'Records Management',
      description: 'Access detailed attendance logs, analytics and reports',
      icon: <Book size={28} />,
      path: '/attendance-management',
      color: '#000',
    },
  ];

  const navigate = (path: string) => {
    window.location.href = path;
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      backgroundColor: '#fff'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 64
      }}>
        <Title level={1} style={{ marginBottom: 16, fontWeight: 900, letterSpacing: '-1px' }}>
          ABUAD BIO_STATS
        </Title>
        <Text type="secondary" style={{ fontSize: '18px', display: 'block', maxWidth: '500px' }}>
          Intelligent Face Recognition Attendance System
        </Text>
      </div>

      <Row gutter={[32, 32]} justify="center" style={{ maxWidth: 1100, width: '100%' }}>
        {cards.map((card) => (
          <Col xs={24} md={8} key={card.key}>
            <Card
              hoverable
              onClick={() => navigate(card.path)}
              variant="outlined"
              style={{
                height: '100%',
                borderRadius: 16,
                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                border: '1px solid #eee',
                padding: '20px 10px'
              }}
              bodyStyle={{
                padding: '24px',
                textAlign: 'left',
              }}
              className="stat-card"
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {React.cloneElement(card.icon, { color: '#fff' })}
              </div>
              <Title level={3} style={{ margin: '0 0 12px 0', fontWeight: 700 }}>
                {card.title}
              </Title>
              <Text type="secondary" style={{ fontSize: '15px', lineHeight: '1.6', display: 'block' }}>
                {card.description}
              </Text>
              <div style={{ marginTop: 24 }}>
                <Button
                  type="text"
                  style={{ padding: 0, fontWeight: 600, fontSize: '13px' }}
                >
                  START_MODULE →
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{
        position: 'absolute',
        bottom: 40,
        textAlign: 'center'
      }}>
        <Text style={{ fontSize: '12px', color: '#bfbfbf', fontWeight: 600, letterSpacing: '1px' }}>
          AFE BABALOLA UNIVERSITY • BIOMETRIC UNIT
        </Text>
      </div>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing',
    message: 'Initializing...'
  });

  useEffect(() => {
    async function testConnection() {
      try {
        const { data: faculties, error } = await supabase
          .from('faculties')
          .select('*')
          .limit(1);

        if (error) {
          console.error('Connection test failed:', error);
          setConnectionStatus({
            status: 'error',
            message: 'Database Connection Failed',
            details: error.message
          });
        } else {
          setConnectionStatus({
            status: 'connected',
            message: 'Connected',
            details: null
          });
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);
        setConnectionStatus({
          status: 'error',
          message: 'Network Error',
          details: error.message
        });
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  if (connectionStatus.status === 'error') {
    return (
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: 20,
          maxWidth: 500,
          margin: '0 auto'
        }}>
          <Alert
            message="Connection Error"
            description={
              <div>
                <p>Failed to connect to database.</p>
                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      </ConfigProvider>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 20 }}>
          {connectionStatus.message}
        </Text>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#000000',
          borderRadius: 4,
          fontFamily: 'Outfit, sans-serif',
        },
        components: {
          Button: {
            borderRadius: 4,
            fontWeight: 600,
          },
          Card: {
            borderRadius: 12,
          }
        }
      }}
    >
      <Router>
        <div style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<HomeCards />} />
            <Route path="/enroll" element={
              <PageWrapper>
                <EnrollmentPage />
              </PageWrapper>
            } />
            {/* Attendance page renders without PageWrapper */}
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/attendance-management" element={
              <PageWrapper>
                <AttendanceManagementPage />
              </PageWrapper>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
}

export default App;
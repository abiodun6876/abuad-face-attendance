// src/pages/ImageManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Space, 
  Alert, 
  Row, 
  Col,
  Statistic,
  List,
  Progress,
  Modal,
  message
} from 'antd';
import { 
  Image, 
  Database, 
  Trash2, 
  Download,
  Eye,
  Smartphone,
  Server
} from 'lucide-react';
import { imageStorage } from '../utiles/imageStorage';

const { Title, Text } = Typography;

const ImageManagementPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const storageStats = await imageStorage.getStorageStats();
      setStats(storageStats);
    } catch (error) {
      console.error('Error loading stats:', error);
      message.error('Failed to load storage statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClearAllImages = async () => {
    try {
      await imageStorage.clearAllImages();
      message.success('All images cleared successfully');
      setConfirmClear(false);
      loadStats();
    } catch (error) {
      console.error('Error clearing images:', error);
      message.error('Failed to clear images');
    }
  };

  const getStorageColor = (sizeKB: number) => {
    if (sizeKB < 1000) return '#52c41a'; // Green
    if (sizeKB < 5000) return '#faad14'; // Yellow
    return '#ff4d4f'; // Red
  };

  const getStoragePercentage = (sizeKB: number) => {
    const maxSizeKB = 50000; // 50MB limit
    return Math.min((sizeKB / maxSizeKB) * 100, 100);
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Image Storage Management</Title>
      <Text type="secondary">
        Manage face images stored locally on your device
      </Text>

      <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 20 }}>
        {/* Storage Overview */}
        <Card title="Storage Overview" loading={loading}>
          {stats ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Total Images"
                  value={stats.totalImages}
                  prefix={<Image size={20} />}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Students with Images"
                  value={stats.studentsWithImages}
                  prefix={<Smartphone size={20} />}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Storage Used"
                  value={`${stats.totalSize} KB`}
                  prefix={<Database size={20} />}
                  valueStyle={{ color: getStorageColor(stats.totalSize) }}
                />
              </Col>
            </Row>
          ) : (
            <Text type="secondary">Loading statistics...</Text>
          )}
        </Card>

        {/* Storage Progress */}
        {stats && (
          <Card title="Storage Usage">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Local Device Storage</Text>
                <Text strong>{stats.totalSize} KB / 50,000 KB</Text>
              </div>
              <Progress
                percent={getStoragePercentage(stats.totalSize)}
                strokeColor={getStorageColor(stats.totalSize)}
                status={stats.totalSize > 45000 ? 'exception' : 'normal'}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {stats.totalSize < 1000 ? 'Storage is good' : 
                 stats.totalSize < 5000 ? 'Storage is getting full' : 
                 'Storage is almost full - consider cleaning up'}
              </Text>
            </Space>
          </Card>
        )}

        {/* Management Actions */}
        <Card title="Management Actions">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              message="Local Storage Information"
              description={
                <div>
                  <Text>Images are stored in your browser's IndexedDB storage. This allows:</Text>
                  <ul style={{ marginTop: 8 }}>
                    <li>Offline access to face images</li>
                    <li>Fast face recognition</li>
                    <li>Privacy - images stay on your device</li>
                    <li>Automatic cleanup of old images</li>
                  </ul>
                  <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
                    Note: Clearing browser data will delete all stored images
                  </Text>
                </div>
              }
              type="info"
              showIcon
            />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  onClick={loadStats}
                >
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <Eye size={32} color="#1890ff" />
                    <Text strong>Refresh Statistics</Text>
                    <Text type="secondary" style={{ textAlign: 'center' }}>
                      Update storage information and check usage
                    </Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  onClick={() => setConfirmClear(true)}
                >
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <Trash2 size={32} color="#ff4d4f" />
                    <Text strong>Clear All Images</Text>
                    <Text type="secondary" style={{ textAlign: 'center' }}>
                      Delete all stored images from device
                    </Text>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Space>
        </Card>

        {/* Tips */}
        <Card title="Storage Tips">
          <List
            size="small"
            dataSource={[
              'Each student can store up to 10 images',
              'Old images are automatically deleted when limit is reached',
              'Compressed thumbnails are used for gallery display',
              'Original images are stored for face recognition',
              'Storage is managed per device - not synced across devices'
            ]}
            renderItem={(item) => (
              <List.Item>
                <Text>{item}</Text>
              </List.Item>
            )}
          />
        </Card>
      </Space>

      {/* Clear Confirmation Modal */}
      <Modal
        title="Confirm Clear All Images"
        open={confirmClear}
        onCancel={() => setConfirmClear(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfirmClear(false)}>
            Cancel
          </Button>,
          <Button key="clear" type="primary" danger onClick={handleClearAllImages}>
            Clear All Images
          </Button>
        ]}
      >
        <Alert
          type="warning"
          message="Warning: This action cannot be undone!"
          description={
            <div>
              <Text>This will delete:</Text>
              <ul style={{ marginTop: 8 }}>
                <li>All face enrollment images</li>
                <li>All attendance verification images</li>
                <li>All thumbnails and metadata</li>
              </ul>
              <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                Face recognition will not work until new images are captured
              </Text>
            </div>
          }
          showIcon
        />
      </Modal>
    </div>
  );
};

export default ImageManagementPage;
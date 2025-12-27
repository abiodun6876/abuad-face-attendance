// src/components/StudentPhotoManager.tsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Image, Upload, message, Modal, Row, Col } from 'antd';
import { UploadOutlined, CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs'; // ADD THIS IMPORT

interface StudentPhotoManagerProps {
  studentId: string;
  studentName: string;
  onPhotoUpdated?: () => void;
}

const StudentPhotoManager: React.FC<StudentPhotoManagerProps> = ({
  studentId,
  studentName,
  onPhotoUpdated
}) => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);

  // Add compressImage function locally
  const compressImage = async (base64String: string, maxWidth = 640, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
     const img = new window.Image(); // Instead of just new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            const ratio = maxWidth / width;
            height = Math.floor(height * ratio);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64String); // Fallback to original
            return;
          }
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (error) {
          resolve(base64String); // Fallback to original on error
        }
      };
      img.onerror = () => resolve(base64String); // Fallback to original
      img.src = base64String;
    });
  };

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('student_photos')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPhotos(data || []);
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      message.error('Failed to load photos');
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [studentId]);

  const handleUpload = async (file: File) => {
    try {
      setLoading(true);
      
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      // Compress image
      const compressed = await compressImage(base64);
      
      // Upload to storage
      const fileName = `photo_${studentId}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(fileName);
      
      // Save to database
      const { error: dbError } = await supabase
        .from('student_photos')
        .insert([{
          student_id: studentId,
          photo_url: urlData.publicUrl,
          photo_data: compressed.replace(/^data:image\/\w+;base64,/, ''),
          is_primary: photos.length === 0
        }]);
      
      if (dbError) throw dbError;
      
      // Update student record
      const { error: updateError } = await supabase
        .from('students')
        .update({
          photo_url: urlData.publicUrl,
          photo_updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId);
      
      if (updateError) throw updateError;
      
      message.success('Photo uploaded successfully');
      fetchPhotos();
      onPhotoUpdated?.();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      message.error('Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const setAsPrimary = async (photoId: string) => {
    try {
      // Reset all photos to non-primary
      await supabase
        .from('student_photos')
        .update({ is_primary: false })
        .eq('student_id', studentId);
      
      // Set selected photo as primary
      const { error } = await supabase
        .from('student_photos')
        .update({ is_primary: true })
        .eq('id', photoId);
      
      if (error) throw error;
      
      // Update student record
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        await supabase
          .from('students')
          .update({
            photo_url: photo.photo_url,
            photo_updated_at: new Date().toISOString()
          })
          .eq('student_id', studentId);
      }
      
      message.success('Primary photo updated');
      fetchPhotos();
      onPhotoUpdated?.();
      
    } catch (error: any) {
      console.error('Set primary error:', error);
      message.error('Failed to update primary photo');
    }
  };

  // Delete photo function
  const handleDeletePhoto = async (photoId: string) => {
    Modal.confirm({
      title: 'Delete Photo',
      content: 'Are you sure you want to delete this photo?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('student_photos')
            .delete()
            .eq('id', photoId);
          
          if (error) throw error;
          
          message.success('Photo deleted successfully');
          fetchPhotos();
          onPhotoUpdated?.();
        } catch (error: any) {
          console.error('Delete error:', error);
          message.error('Failed to delete photo');
        }
      }
    });
  };

  return (
    <Card title="Student Photos" size="small">
      <Row gutter={[16, 16]}>
        {photos.map(photo => (
          <Col key={photo.id} xs={12} sm={8} md={6}>
            <Card
              size="small"
              cover={
                <Image
                  src={photo.photo_url || `data:image/jpeg;base64,${photo.photo_data}`}
                  alt="Student photo"
                  height={120}
                  style={{ objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => {
                    setPreviewImage(photo.photo_url || `data:image/jpeg;base64,${photo.photo_data}`);
                    setPreviewVisible(true);
                  }}
                  preview={false}
                />
              }
              actions={[
                <Button
                  type="link"
                  size="small"
                  disabled={photo.is_primary}
                  onClick={() => setAsPrimary(photo.id)}
                >
                  {photo.is_primary ? 'Primary' : 'Set Primary'}
                </Button>,
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeletePhoto(photo.id)}
                >
                  Delete
                </Button>
              ]}
            >
              <small>{dayjs(photo.created_at).format('DD/MM/YYYY')}</small>
            </Card>
          </Col>
        ))}
        
        <Col xs={12} sm={8} md={6}>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={loading}
            customRequest={({ file, onSuccess }) => {
              if (onSuccess) onSuccess('ok');
              return false;
            }}
          >
            <Card
              size="small"
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderStyle: 'dashed'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <UploadOutlined style={{ fontSize: 24 }} />
                <div>Add Photo</div>
              </div>
            </Card>
          </Upload>
        </Col>
      </Row>

      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        <img 
          alt="Preview" 
          style={{ 
            width: '100%',
            maxHeight: '80vh',
            objectFit: 'contain'
          }} 
          src={previewImage} 
        />
      </Modal>
    </Card>
  );
};

export default StudentPhotoManager;
// src/utils/imageUtils.ts
export const compressImage = async (
  base64String: string, 
  maxWidth = 640, 
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!base64String || typeof base64String !== 'string') {
      reject(new Error('Invalid base64 string'));
      return;
    }
    
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          height = Math.floor(height * ratio);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Draw image with better quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with specified quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(new Error('Failed to load image for compression'));
    };
    
    img.src = base64String;
  });
};

export const getImageInfo = (base64String: string): {
  format: string;
  sizeKB: number;
  dimensions?: { width: number; height: number };
} => {
  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const sizeBytes = (base64Data.length * 3) / 4;
    const sizeKB = Math.round(sizeBytes / 1024);
    
    const formatMatch = base64String.match(/^data:image\/(\w+);base64,/);
    const format = formatMatch ? formatMatch[1] : 'unknown';
    
    return {
      format,
      sizeKB,
      dimensions: undefined // Can be extracted if needed
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    return { format: 'unknown', sizeKB: 0 };
  }
};
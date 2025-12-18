// src/utils/faceRecognition.ts
export interface FaceEmbedding {
  descriptor: number[];
  studentId: string;
  timestamp: number;
}

export interface FaceMatchResult {
  studentId: string;
  confidence: number;
  match: boolean;
  name?: string;
  matricNumber?: string;
}

class FaceRecognitionSystem {
  private readonly LOCAL_STORAGE_KEY = 'face_embeddings';
  private readonly MATCH_THRESHOLD = 0.65; // 65% confidence threshold
  private readonly INDEXED_DB_NAME = 'face_images_db';
  private readonly STORE_NAME = 'face_images';

  // Calculate Euclidean distance between two embeddings
  private calculateDistance(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      return Infinity;
    }
    
    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      sum += Math.pow(embedding1[i] - embedding2[i], 2);
    }
    return Math.sqrt(sum);
  }

  // Convert distance to confidence score (0-1)
  private distanceToConfidence(distance: number): number {
    // Normalize distance to 0-1 scale, where 0 = perfect match
    const maxDistance = 2; // Adjust based on your embedding scale
    const confidence = 1 - Math.min(distance / maxDistance, 1);
    return Math.max(0, Math.min(1, confidence));
  }

  // Generate mock embedding for testing (remove this in production)
  generateMockEmbedding(): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < 128; i++) {
      embedding.push(Math.random());
    }
    return embedding;
  }

  // Save face embedding to local storage
  saveEmbeddingToLocal(studentId: string, embedding: number[]): void {
    try {
      const embeddings = this.getEmbeddingsFromLocal();
      const existingIndex = embeddings.findIndex(e => e.studentId === studentId);
      
      const faceEmbedding: FaceEmbedding = {
        studentId,
        descriptor: embedding,
        timestamp: Date.now()
      };

      if (existingIndex >= 0) {
        embeddings[existingIndex] = faceEmbedding;
      } else {
        embeddings.push(faceEmbedding);
      }

      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(embeddings));
      console.log(`Saved embedding for student ${studentId} to local storage`);
    } catch (error) {
      console.error('Error saving embedding to local storage:', error);
    }
  }

  // Get embeddings from local storage
  getEmbeddingsFromLocal(): FaceEmbedding[] {
    try {
      const data = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading embeddings from local storage:', error);
      return [];
    }
  }

  // Match a face against stored embeddings
  matchFace(inputEmbedding: number[]): FaceMatchResult[] {
    const embeddings = this.getEmbeddingsFromLocal();
    const results: FaceMatchResult[] = [];

    for (const embedding of embeddings) {
      const distance = this.calculateDistance(inputEmbedding, embedding.descriptor);
      const confidence = this.distanceToConfidence(distance);
      
      results.push({
        studentId: embedding.studentId,
        confidence,
        match: confidence >= this.MATCH_THRESHOLD
      });
    }

    // Sort by confidence (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  // Save image to IndexedDB
  async saveImageToIndexedDB(studentId: string, imageData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.INDEXED_DB_NAME, 1);

      request.onerror = () => reject('Failed to open IndexedDB');
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'studentId' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const imageRecord = {
          studentId,
          imageData,
          timestamp: Date.now()
        };

        const putRequest = store.put(imageRecord);
        
        putRequest.onsuccess = () => {
          console.log(`Image saved to IndexedDB for student ${studentId}`);
          resolve();
        };
        
        putRequest.onerror = () => reject('Failed to save image');
      };
    });
  }

  // Get image from IndexedDB
  async getImageFromIndexedDB(studentId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.INDEXED_DB_NAME, 1);

      request.onerror = () => reject('Failed to open IndexedDB');
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const getRequest = store.get(studentId);
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result?.imageData || null);
        };
        
        getRequest.onerror = () => reject('Failed to get image');
      };
    });
  }

  // Clear all data
  clearAllData(): void {
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    
    // Clear IndexedDB
    const request = indexedDB.deleteDatabase(this.INDEXED_DB_NAME);
    request.onsuccess = () => console.log('Cleared all face data');
    request.onerror = () => console.error('Failed to clear IndexedDB');
  }

  // Get statistics
  getStats(): { totalEmbeddings: number; totalImages: number } {
    const embeddings = this.getEmbeddingsFromLocal();
    return {
      totalEmbeddings: embeddings.length,
      totalImages: 0 // Would need to query IndexedDB for actual count
    };
  }
}

export const faceRecognition = new FaceRecognitionSystem();
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  
  // Add this for local storage
  private readonly EMBEDDINGS_KEY = 'face_embeddings';
  
  private constructor() {}
  
  public static getInstance(): FaceRecognition {
    if (!FaceRecognition.instance) {
      FaceRecognition.instance = new FaceRecognition();
    }
    return FaceRecognition.instance;
  }
  
  async loadModels() {
    if (this.modelsLoaded) return;
    
    try {
      console.log('Loading face recognition models...');
      
      // Load face-api.js models
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      // Initialize TensorFlow.js backend
      await tf.ready();
      
      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
      
    } catch (error) {
      console.error('Failed to load face recognition models:', error);
      throw error;
    }
  }
  
  // Extract face descriptor from image
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Convert base64 to HTMLImageElement
      const img = await this.base64ToImage(imageData);
      
      // Detect face and extract descriptor
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        console.log('No face detected in image');
        return null;
      }
      
      return detection.descriptor;
      
    } catch (error) {
      console.error('Error extracting face descriptor:', error);
      return null;
    }
  }
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    // Calculate Euclidean distance (lower = more similar)
    let distance = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      distance += Math.pow(descriptor1[i] - descriptor2[i], 2);
    }
    distance = Math.sqrt(distance);
    
    // Convert distance to similarity score (0-1)
    const similarity = Math.max(0, 1 - (distance / 2));
    
    return similarity;
  }
  
  // Find best match from database
  async findBestMatch(
    capturedDescriptor: Float32Array, 
    storedDescriptors: Array<{studentId: string, descriptor: Float32Array}>
  ): Promise<{studentId: string | null, confidence: number}> {
    let bestMatch = { studentId: null as string | null, confidence: 0 };
    const MATCH_THRESHOLD = 0.65;
    
    for (const stored of storedDescriptors) {
      const similarity = this.compareFaces(capturedDescriptor, stored.descriptor);
      
      if (similarity > MATCH_THRESHOLD && similarity > bestMatch.confidence) {
        bestMatch = {
          studentId: stored.studentId,
          confidence: similarity
        };
      }
    }
    
    return bestMatch;
  }
  
  // Helper: Convert base64 to Image
  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = base64;
    });
  }
  
  // Optimized face matching for attendance
  async matchFaceForAttendance(
    capturedImage: string,
    maxMatches: number = 5
  ): Promise<Array<{studentId: string, name: string, confidence: number}>> {
    try {
      // 1. Extract face from captured image
      const capturedDescriptor = await this.extractFaceDescriptor(capturedImage);
      
      if (!capturedDescriptor) {
        throw new Error('No face detected in captured image');
      }
      
      // 2. Get all enrolled students with face data
      const { data: students } = await supabase
        .from('students')
        .select('student_id, name, photo_data, face_embedding')
        .eq('enrollment_status', 'enrolled')
        .not('photo_data', 'is', null)
        .limit(100);
      
      if (!students || students.length === 0) {
        return [];
      }
      
      // 3. Extract or load descriptors for each student
      const matches = [];
      
      for (const student of students) {
        try {
          let storedDescriptor: Float32Array;
          
          if (student.face_embedding) {
            // Use pre-computed embedding if available
            storedDescriptor = new Float32Array(Object.values(student.face_embedding));
          } else if (student.photo_data) {
            // Extract descriptor from photo
            storedDescriptor = await this.extractFaceDescriptor(
              `data:image/jpeg;base64,${student.photo_data}`
            );
            
            if (storedDescriptor) {
              // Store the descriptor for future use
              await this.updateFaceEmbedding(student.student_id, storedDescriptor);
            }
          }
          
          if (storedDescriptor) {
            const similarity = this.compareFaces(capturedDescriptor, storedDescriptor);
            
            if (similarity > 0.6) {
              matches.push({
                studentId: student.student_id,
                name: student.name,
                confidence: similarity
              });
            }
          }
        } catch (error) {
          console.error(`Error processing student ${student.student_id}:`, error);
          continue;
        }
      }
      
      // 4. Sort by confidence and return top matches
      return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxMatches);
      
    } catch (error) {
      console.error('Error in face matching:', error);
      return [];
    }
  }
  
  // Update face embedding in database
  async updateFaceEmbedding(studentId: string, descriptor: Float32Array) {
    try {
      // Convert Float32Array to array for JSON storage
      const embeddingArray = Array.from(descriptor);
      
      await supabase
        .from('students')
        .update({
          face_embedding: embeddingArray,
          face_enrolled_at: new Date().toISOString()
        })
        .eq('student_id', studentId);
        
    } catch (error) {
      console.error('Error updating face embedding:', error);
    }
  }
  
  // === ADD THESE METHODS FOR SYNC SERVICE ===
  
  // Save an embedding to localStorage
  saveEmbeddingToLocal(studentId: string, descriptor: Float32Array): void {
    const embeddings = this.getEmbeddingsFromLocal();
    
    // Remove existing embedding for this student
    const filtered = embeddings.filter(e => e.studentId !== studentId);
    
    // Add new embedding (convert Float32Array to regular array for localStorage)
    const descriptorArray = Array.from(descriptor);
    filtered.push({ 
      studentId, 
      descriptor: descriptorArray,
      timestamp: new Date().toISOString() 
    });
    
    localStorage.setItem(this.EMBEDDINGS_KEY, JSON.stringify(filtered));
  }
  
  // Get all embeddings from localStorage (what syncService.ts expects)
  getEmbeddingsFromLocal(): Array<{
    studentId: string;
    descriptor: number[];
    timestamp: string;
  }> {
    const data = localStorage.getItem(this.EMBEDDINGS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  // Convert number[] back to Float32Array
  getEmbeddingForStudent(studentId: string): Float32Array | null {
    const embeddings = this.getEmbeddingsFromLocal();
    const found = embeddings.find(e => e.studentId === studentId);
    return found ? new Float32Array(found.descriptor) : null;
  }
  
  // Clear all local embeddings
  clearLocalEmbeddings(): void {
    localStorage.removeItem(this.EMBEDDINGS_KEY);
  }
  
  // Check if student has local embedding
  hasLocalEmbedding(studentId: string): boolean {
    return this.getEmbeddingForStudent(studentId) !== null;
  }
  
  // Sync local embeddings to Supabase
  async syncLocalEmbeddingsToDatabase(): Promise<Array<{
    studentId: string;
    descriptor: number[];
  }>> {
    const localEmbeddings = this.getEmbeddingsFromLocal();
    const syncedEmbeddings: Array<{studentId: string; descriptor: number[]}> = [];
    
    for (const embedding of localEmbeddings) {
      try {
        await this.updateFaceEmbedding(embedding.studentId, new Float32Array(embedding.descriptor));
        syncedEmbeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to sync embedding for student ${embedding.studentId}:`, error);
      }
    }
    
    return syncedEmbeddings;
  }
}

export default FaceRecognition.getInstance();
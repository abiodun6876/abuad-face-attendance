// utils/enrollmentUtils.ts
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';

export interface EnrollmentData {
  student_id: string;
  name: string;
  gender: string;
  program_id?: string;
  program_name: string;
  program_code: string;
  level: number;
  photoData: string;
}

export interface EnrollmentResult {
  success: boolean;
  student?: {
    id: string;
    student_id: string;
    name: string;
    matric_number: string;
    gender: string;
    program_name: string;
    program_code: string;
    level: number;
    enrollment_status: string;
    enrollment_date: string;
    has_face_embedding?: boolean;
  };
  error?: string;
  faceDetected?: boolean;
  message?: string;  // Add this line
  embeddingDimensions?: number;
}

export const enrollStudent = async (enrollmentData: EnrollmentData): Promise<EnrollmentResult> => {
  try {
    console.log('Starting enrollment for:', enrollmentData.name);
    
    // First, check if student already exists
    const { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('*')
      .or(`matric_number.eq.${enrollmentData.student_id},student_id.eq.${enrollmentData.student_id}`)
      .single();

    if (existingStudent) {
      return {
        success: false,
        error: 'Student with this matric number or student ID already exists.'
      };
    }

    // Insert new student using Supabase client
    const { data: student, error: insertError } = await supabase
      .from('students')
      .insert([
        {
          student_id: enrollmentData.student_id,
          matric_number: enrollmentData.student_id,
          name: enrollmentData.name,
          gender: enrollmentData.gender,
          program: enrollmentData.program_code,
          program_name: enrollmentData.program_name,
          level: enrollmentData.level,
          photo_url: enrollmentData.photoData || null,
          face_detected: true,
          face_enrolled_at: new Date().toISOString(),
          enrollment_status: 'enrolled',
          enrollment_date: new Date().toISOString().split('T')[0], // Just the date part
          is_active: true
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      
      // Handle duplicate key errors
      if (insertError.code === '23505') {
        if (insertError.message.includes('students_matric_number_key')) {
          return {
            success: false,
            error: 'Matric number already exists. Please generate a new one.'
          };
        }
        if (insertError.message.includes('students_student_id_key')) {
          return {
            success: false,
            error: 'Student ID already exists.'
          };
        }
      }
      
      return {
        success: false,
        error: `Database error: ${insertError.message}`
      };
    }

    if (!student) {
      return {
        success: false,
        error: 'Student record was not created.'
      };
    }

    console.log('Student enrolled successfully:', student);

    return {
      success: true,
      student: {
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        matric_number: student.matric_number,
        gender: student.gender,
        program_name: student.program_name,
        program_code: student.program,
        level: student.level,
        enrollment_status: student.enrollment_status,
        enrollment_date: student.enrollment_date,
        has_face_embedding: student.face_embedding ? true : false
      },
      faceDetected: student.face_detected || false,
      message: 'Student enrolled successfully'
    };
    
  } catch (error: any) {
    console.error('Enrollment error:', error);
    
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

// Helper function to check if enrollment is working
export const testEnrollment = async (): Promise<boolean> => {
  try {
    console.log('Testing enrollment connection...');
    
    // Test database connection using Supabase
    const { data, error } = await supabase
      .from('students')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database test failed:', error);
      return false;
    }
    
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
};

// Optional: Function to test with a sample student
export const testEnrollmentWithSample = async (): Promise<EnrollmentResult> => {
  const sampleData: EnrollmentData = {
    student_id: 'TEST/2026/9999',
    name: 'Test Student',
    gender: 'male',
    program_code: 'CSC',
    program_name: 'Computer Science',
    level: 100,
    photoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  };
  
  return await enrollStudent(sampleData);
};
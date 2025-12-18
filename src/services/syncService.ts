// src/services/syncService.ts
import { supabase } from '../lib/supabase';
import { faceRecognition } from '../utils/faceRecognition';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  timestamp: string;
}

class SyncService {
  private readonly SYNC_STATUS_KEY = 'last_sync_status';
  private readonly PENDING_UPLOADS_KEY = 'pending_uploads';

  // Get sync status
  getSyncStatus(): { lastSync: string | null; pendingCount: number } {
    const status = localStorage.getItem(this.SYNC_STATUS_KEY);
    const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
    
    const pendingData = pending ? JSON.parse(pending) : [];
    
    return {
      lastSync: status ? JSON.parse(status).timestamp : null,
      pendingCount: pendingData.length
    };
  }

  // Save attendance to local storage (for offline)
  saveAttendanceLocally(studentId: string, eventId?: string): void {
    const attendance = {
      studentId,
      eventId,
      timestamp: new Date().toISOString(),
      status: 'pending_sync'
    };

    const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
    const pendingArray = pending ? JSON.parse(pending) : [];
    
    pendingArray.push(attendance);
    localStorage.setItem(this.PENDING_UPLOADS_KEY, JSON.stringify(pendingArray));
    
    console.log('Attendance saved locally:', attendance);
  }

  // Sync pending data to Supabase
  async syncPendingData(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get pending attendance records
      const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
      const pendingArray = pending ? JSON.parse(pending) : [];

      if (pendingArray.length === 0) {
        result.success = true;
        result.syncedCount = 0;
        return result;
      }

      const synced: any[] = [];
      const errors: any[] = [];

      // Sync each attendance record
      for (const record of pendingArray) {
        try {
          const { error } = await supabase
            .from('attendance_records')
            .insert({
              student_id: record.studentId,
              event_id: record.eventId,
              timestamp: record.timestamp,
              status: 'present',
              source: 'face_recognition',
              synced_at: new Date().toISOString()
            });

          if (error) {
            errors.push({ record, error: error.message });
          } else {
            synced.push(record);
          }
        } catch (error: any) {
          errors.push({ record, error: error.message });
        }
      }

      // Update local storage
      const remaining = pendingArray.filter((r: any) => 
        !synced.find(s => s.timestamp === r.timestamp && s.studentId === r.studentId)
      );

      localStorage.setItem(this.PENDING_UPLOADS_KEY, JSON.stringify(remaining));

      // Save sync status
      localStorage.setItem(this.SYNC_STATUS_KEY, JSON.stringify({
        timestamp: result.timestamp,
        syncedCount: synced.length,
        errorCount: errors.length
      }));

      result.success = errors.length === 0;
      result.syncedCount = synced.length;
      result.errors = errors.map(e => e.error);

      console.log(`Sync completed: ${synced.length} records synced, ${errors.length} errors`);

    } catch (error: any) {
      console.error('Sync failed:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // Sync face embeddings to Supabase (for backup)
  async syncFaceEmbeddings(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      const embeddings = faceRecognition.getEmbeddingsFromLocal();
      
      for (const embedding of embeddings) {
        try {
          const { error } = await supabase
            .from('students')
            .update({
              face_embedding: embedding.descriptor,
              last_face_update: new Date().toISOString()
            })
            .eq('id', embedding.studentId)
            .eq('matric_number', embedding.studentId);

          if (error) {
            result.errors.push(`Student ${embedding.studentId}: ${error.message}`);
          } else {
            result.syncedCount++;
          }
        } catch (error: any) {
          result.errors.push(`Student ${embedding.studentId}: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0;

    } catch (error: any) {
      console.error('Face embeddings sync failed:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // Clear all pending data
  clearPendingData(): void {
    localStorage.removeItem(this.PENDING_UPLOADS_KEY);
    localStorage.removeItem(this.SYNC_STATUS_KEY);
    console.log('Cleared all pending sync data');
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Auto-sync when online
  setupAutoSync(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored. Starting auto-sync...');
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost. Working offline...');
    });
  }
}

export const syncService = new SyncService();
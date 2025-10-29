/**
 * Phase 5: File Validation Utilities
 * Shared validation functions for image and video uploads
 */

export const FILE_VALIDATION = {
  IMAGE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  VIDEO: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_TYPES: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ],
    ALLOWED_EXTENSIONS: ['mp4', 'mov', 'avi', 'webm']
  }
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): FileValidationResult {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  if (!FILE_VALIDATION.IMAGE.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${FILE_VALIDATION.IMAGE.ALLOWED_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > FILE_VALIDATION.IMAGE.MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${FILE_VALIDATION.IMAGE.MAX_SIZE / 1024 / 1024}MB`
    };
  }

  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !FILE_VALIDATION.IMAGE.ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${FILE_VALIDATION.IMAGE.ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): FileValidationResult {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  if (!FILE_VALIDATION.VIDEO.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${FILE_VALIDATION.VIDEO.ALLOWED_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > FILE_VALIDATION.VIDEO.MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${FILE_VALIDATION.VIDEO.MAX_SIZE / 1024 / 1024}MB`
    };
  }

  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !FILE_VALIDATION.VIDEO.ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${FILE_VALIDATION.VIDEO.ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFileName(originalName: string): string {
  const ext = originalName.split('.').pop();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomStr}.${ext}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string | null {
  const ext = filename.split('.').pop();
  return ext ? ext.toLowerCase() : null;
}

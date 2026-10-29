const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_MAGIC_BYTES = '%PDF-'; // First 5 bytes of a valid PDF

/**
 * Validates a binary buffer or Uint8Array to ensure:
 * 1. Not empty
 * 2. Does not exceed 10 MB
 * 3. Has the valid PDF magic byte header (%PDF-)
 */
export function validatePdfBuffer(buffer: Uint8Array): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds maximum allowed size of 10 MB' };
  }
  const header = String.fromCharCode(...buffer.subarray(0, 5));
  if (header !== PDF_MAGIC_BYTES) {
    return { valid: false, error: 'File is not a valid PDF document' };
  }
  return { valid: true };
}

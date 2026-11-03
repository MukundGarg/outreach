import 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

const MAX_PDF_TEXT_LENGTH = 30000; // Cap extracted text to ~30k characters

/**
 * Strips PDF page break markers like "\n\n-- 1 of 1 --\n\n" produced by pdf-parse
 * to determine if the document has actual readable textual content.
 */
function cleanExtractedText(text: string): string {
  return text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim();
}

/**
 * Extracts raw text from a PDF Buffer using pdf-parse.
 */
export async function parsePdfBufferToText(buffer: Buffer): Promise<string> {
  const hasPdfSignature = buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';

  let parser: InstanceType<typeof PDFParse> | null = null;
  let stage = 'init';

  try {
    stage = 'instantiate_parser';
    parser = new PDFParse({ data: buffer });

    stage = 'get_text';
    const textResult = await parser.getText();
    const rawText = textResult && typeof textResult.text === 'string' ? textResult.text.trim() : '';
    const meaningfulText = cleanExtractedText(rawText);

    if (!meaningfulText || meaningfulText.length < 20) {
      throw new Error('PDF contains no readable text layer. It may be image-only (scanned) or encrypted.');
    }

    return rawText.slice(0, MAX_PDF_TEXT_LENGTH);
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : 'UnknownError';
    const errMessage = err instanceof Error ? err.message : String(err);

    // Safe diagnostic logging: only technical metadata, never user text, tokens, or contents
    console.error('[PDF Parser Diagnostic]', {
      stage,
      errorName: errName,
      errorMessage: errMessage,
      nodeVersion: process.version,
      bufferSizeBytes: buffer.length,
      hasPdfSignature,
    });

    if (err instanceof Error) {
      if (err.message.includes('no readable text layer')) {
        throw err;
      }
      if (err.name === 'PasswordException' || err.message.toLowerCase().includes('password')) {
        throw new Error('PDF document is password-protected or encrypted. Please upload an unprotected PDF.');
      }
      if (err.name === 'InvalidPDFException' || !hasPdfSignature) {
        throw new Error('Invalid PDF format or corrupted document.');
      }
    }

    throw new Error('Failed to extract text from PDF document. Please verify the file format.');
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch (destroyErr: unknown) {
        console.error('[PDF Parser Cleanup Error]', {
          errorName: destroyErr instanceof Error ? destroyErr.name : 'UnknownError',
          nodeVersion: process.version,
        });
      }
    }
  }
}


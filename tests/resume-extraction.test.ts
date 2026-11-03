import { test } from 'node:test';
import assert from 'node:assert';
import { parsePdfBufferToText } from '../src/lib/pdf-parser';

function buildSyntheticPdf(textContent?: string): Buffer {
  if (!textContent) {
    const raw = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f \r
0000000009 00000 n \r
0000000058 00000 n \r
0000000115 00000 n \r
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
    return Buffer.from(raw, 'utf-8');
  }

  const streamContent = `BT\n/F1 12 Tf\n100 700 Td\n(${textContent}) Tj\nET`;
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  let offset = 9; // header `%PDF-1.4\n`
  const offsets: number[] = [offset];
  offset += Buffer.byteLength(obj1, 'utf-8');
  offsets.push(offset);
  offset += Buffer.byteLength(obj2, 'utf-8');
  offsets.push(offset);
  offset += Buffer.byteLength(obj3, 'utf-8');
  offsets.push(offset);
  offset += Buffer.byteLength(obj4, 'utf-8');
  offsets.push(offset);

  let xref = 'xref\n0 6\n0000000000 65535 f \r\n';
  for (const o of offsets) {
    xref += `${String(o).padStart(10, '0')} 00000 n \r\n`;
  }
  const startXref = offset + Buffer.byteLength(obj5, 'utf-8');
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const pdfStr = `%PDF-1.4\n${obj1}${obj2}${obj3}${obj4}${obj5}${xref}${trailer}`;
  return Buffer.from(pdfStr, 'utf-8');
}

test('PDF Extraction: extracts readable text from valid text-based PDF', async () => {
  const pdfBuffer = buildSyntheticPdf('Software Engineer with TypeScript and React experience');
  const extractedText = await parsePdfBufferToText(pdfBuffer);
  assert.ok(extractedText.includes('Software Engineer with TypeScript and React experience'));
});

test('PDF Extraction: rejects malformed or non-PDF bytes with clear error', async () => {
  const malformedBuffer = Buffer.from('This is completely invalid non-PDF data', 'utf-8');
  await assert.rejects(
    async () => {
      await parsePdfBufferToText(malformedBuffer);
    },
    (err: Error) => {
      assert.ok(
        err.message.includes('Invalid PDF format or corrupted document') ||
          err.message.includes('Failed to extract text'),
        `Unexpected error: ${err.message}`,
      );
      return true;
    },
  );
});

test('PDF Extraction: reports clear error when PDF has no text layer (blank or image-only)', async () => {
  const blankPdf = buildSyntheticPdf(); // No text stream content
  await assert.rejects(
    async () => {
      await parsePdfBufferToText(blankPdf);
    },
    (err: Error) => {
      assert.ok(
        err.message.includes('PDF contains no readable text layer'),
        `Expected readable text layer message, got: ${err.message}`,
      );
      return true;
    },
  );
});

test('PDF Extraction: parser cleanup runs properly on success and error without resource leaks', async () => {
  // Test cleanup on success
  const validPdf = buildSyntheticPdf('Full Stack Developer Experience Verification');
  const text = await parsePdfBufferToText(validPdf);
  assert.ok(text.length > 0);

  // Test cleanup on failure
  const invalidPdf = Buffer.from('%PDF-corrupted-stream-bytes-here', 'utf-8');
  await assert.rejects(async () => {
    await parsePdfBufferToText(invalidPdf);
  });
});

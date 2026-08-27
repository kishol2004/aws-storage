/**
 * fileValidation.test.ts — Unit tests for file validation
 */
import { describe, it, expect } from '@jest/globals';
import { validateFileMetadata } from '../../../src/utils/fileValidation.js';

describe('validateFileMetadata', () => {
  const validInput = {
    filename: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024, // 1MB
  };

  it('accepts valid PDF metadata', () => {
    expect(() => validateFileMetadata(validInput)).not.toThrow();
  });

  it('rejects executable files by extension', () => {
    expect(() =>
      validateFileMetadata({ ...validInput, filename: 'virus.exe' })
    ).toThrow();
  });

  it('rejects script files', () => {
    expect(() =>
      validateFileMetadata({ ...validInput, filename: 'script.sh' })
    ).toThrow();
  });

  it('rejects path traversal in filename', () => {
    expect(() =>
      validateFileMetadata({ ...validInput, filename: '../secret.pdf' })
    ).toThrow();
  });

  it('rejects files exceeding size limit', () => {
    expect(() =>
      validateFileMetadata({
        ...validInput,
        fileSize: 300 * 1024 * 1024, // 300MB — exceeds 200MB limit
      })
    ).toThrow();
  });

  it('rejects zero-size files', () => {
    expect(() =>
      validateFileMetadata({ ...validInput, fileSize: 0 })
    ).toThrow();
  });

  it('rejects empty filename', () => {
    expect(() =>
      validateFileMetadata({ ...validInput, filename: '' })
    ).toThrow();
  });

  it('accepts PNG image', () => {
    expect(() =>
      validateFileMetadata({
        filename: 'photo.png',
        mimeType: 'image/png',
        fileSize: 500 * 1024,
      })
    ).not.toThrow();
  });

  it('accepts DOCX file', () => {
    expect(() =>
      validateFileMetadata({
        filename: 'report.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 2 * 1024 * 1024,
      })
    ).not.toThrow();
  });
});

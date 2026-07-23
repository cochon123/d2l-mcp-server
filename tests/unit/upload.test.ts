import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildDropboxMultipartBody, inferContentType, validateUpload } from '../../src/utils/upload.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env.D2L_UPLOAD_ROOTS;
  delete process.env.D2L_MAX_UPLOAD_BYTES;
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true })
  ));
});

describe('upload utilities', () => {
  it('infers common content types', () => {
    expect(inferContentType('submission.zip')).toBe('application/zip');
    expect(inferContentType('report.PDF')).toBe('application/pdf');
    expect(inferContentType('unknown.bin')).toBe('application/octet-stream');
  });

  it('builds the D2L multipart/mixed format with JSON first', () => {
    const fileData = Buffer.from([0x00, 0x01, 0xff]);
    const { body, boundary } = buildDropboxMultipartBody({
      filename: 'project.zip',
      contentType: 'application/zip',
      data: fileData,
    }, 'Final submission', 'fixed-boundary');

    expect(boundary).toBe('fixed-boundary');
    expect(body.subarray(0, body.indexOf(fileData)).toString()).toBe(
      '--fixed-boundary\r\n'
      + 'Content-Type: application/json\r\n\r\n'
      + '{"Text":"Final submission","Html":null}\r\n'
      + '--fixed-boundary\r\n'
      + 'Content-Disposition: form-data; name=""; filename="project.zip"\r\n'
      + 'Content-Type: application/zip\r\n\r\n'
    );
    expect(body.subarray(body.indexOf(fileData), body.indexOf(fileData) + fileData.length))
      .toEqual(fileData);
    expect(body.subarray(body.indexOf(fileData) + fileData.length).toString())
      .toBe('\r\n--fixed-boundary--\r\n');
  });

  it('sanitizes header-breaking filename characters', () => {
    const { body } = buildDropboxMultipartBody({
      filename: 'bad"\r\nname.zip',
      contentType: 'application/zip',
      data: Buffer.from('data'),
    }, '', 'fixed-boundary');

    expect(body.toString()).toContain('filename="bad___name.zip"');
    expect(body.toString()).not.toContain('filename="bad"\r\n');
  });

  it('validates a regular file inside an allowed upload root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'd2l-upload-root-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'project.zip');
    await writeFile(filePath, 'zip data');
    process.env.D2L_UPLOAD_ROOTS = root;

    const upload = await validateUpload(filePath);

    expect(upload).toMatchObject({
      path: filePath,
      filename: 'project.zip',
      size: 8,
      contentType: 'application/zip',
      sha256: 'f078f2cbd0fdccee9dc73ec62d24626ce1cdb3154015fa8324c8802ad3cb2330',
    });
  });

  it('rejects a symlink that escapes the configured upload root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'd2l-upload-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'd2l-upload-outside-'));
    temporaryDirectories.push(root, outside);
    const outsideFile = join(outside, 'secret.txt');
    const linkedFile = join(root, 'linked.txt');
    await writeFile(outsideFile, 'secret');
    await symlink(outsideFile, linkedFile);
    process.env.D2L_UPLOAD_ROOTS = root;

    await expect(validateUpload(linkedFile)).rejects.toThrow('outside D2L_UPLOAD_ROOTS');
  });

  it('enforces the configured upload size limit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'd2l-upload-root-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'large.zip');
    await writeFile(filePath, '12345');
    process.env.D2L_UPLOAD_ROOTS = root;
    process.env.D2L_MAX_UPLOAD_BYTES = '4';

    await expect(validateUpload(filePath)).rejects.toThrow('exceeding D2L_MAX_UPLOAD_BYTES');
  });
});

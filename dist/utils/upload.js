import { createHash, randomBytes } from 'crypto';
import { readFile, realpath, stat } from 'fs/promises';
import { basename, delimiter, extname, isAbsolute, relative, resolve, sep } from 'path';
const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const CONTENT_TYPES = {
    '.zip': 'application/zip',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
};
function configuredMaxUploadBytes() {
    const configured = process.env.D2L_MAX_UPLOAD_BYTES;
    if (!configured)
        return DEFAULT_MAX_UPLOAD_BYTES;
    const parsed = Number(configured);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error('D2L_MAX_UPLOAD_BYTES must be a positive integer');
    }
    return parsed;
}
async function allowedUploadRoots() {
    const configured = process.env.D2L_UPLOAD_ROOTS;
    const roots = configured
        ? configured.split(delimiter).filter(Boolean)
        : [process.cwd()];
    if (roots.length === 0) {
        throw new Error('D2L_UPLOAD_ROOTS does not contain any directories');
    }
    return Promise.all(roots.map(async (root) => {
        const resolved = await realpath(resolve(root));
        const rootStat = await stat(resolved);
        if (!rootStat.isDirectory()) {
            throw new Error(`Configured upload root is not a directory: ${resolved}`);
        }
        return resolved;
    }));
}
function isWithinRoot(filePath, root) {
    const pathFromRoot = relative(root, filePath);
    return pathFromRoot !== ''
        && pathFromRoot !== '..'
        && !pathFromRoot.startsWith(`..${sep}`)
        && !isAbsolute(pathFromRoot);
}
export function inferContentType(filename) {
    return CONTENT_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}
export async function validateUpload(filePath) {
    const resolvedPath = await realpath(resolve(filePath));
    const roots = await allowedUploadRoots();
    if (!roots.some((root) => isWithinRoot(resolvedPath, root))) {
        throw new Error(`Upload path is outside D2L_UPLOAD_ROOTS: ${resolvedPath}`);
    }
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) {
        throw new Error(`Upload path is not a regular file: ${resolvedPath}`);
    }
    const maxBytes = configuredMaxUploadBytes();
    if (fileStat.size > maxBytes) {
        throw new Error(`Upload is ${fileStat.size} bytes, exceeding D2L_MAX_UPLOAD_BYTES (${maxBytes})`);
    }
    const data = await readFile(resolvedPath);
    const filename = basename(resolvedPath);
    return {
        path: resolvedPath,
        filename,
        size: fileStat.size,
        contentType: inferContentType(filename),
        sha256: createHash('sha256').update(data).digest('hex'),
        data,
    };
}
export function buildDropboxMultipartBody(upload, comment, boundary = `d2l-mcp-${randomBytes(18).toString('hex')}`) {
    const safeFilename = upload.filename.replace(/["\r\n]/g, '_');
    const richText = JSON.stringify({ Text: comment, Html: null });
    const jsonPart = Buffer.from(`--${boundary}\r\n`
        + 'Content-Type: application/json\r\n\r\n'
        + `${richText}\r\n`);
    const fileHeaders = Buffer.from(`--${boundary}\r\n`
        + `Content-Disposition: form-data; name=""; filename="${safeFilename}"\r\n`
        + `Content-Type: ${upload.contentType}\r\n\r\n`);
    const closingBoundary = Buffer.from(`\r\n--${boundary}--\r\n`);
    return {
        boundary,
        body: Buffer.concat([jsonPart, fileHeaders, upload.data, closingBoundary]),
    };
}

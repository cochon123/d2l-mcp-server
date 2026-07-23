export interface ValidatedUpload {
    path: string;
    filename: string;
    size: number;
    contentType: string;
    sha256: string;
    data: Buffer;
}
export declare function inferContentType(filename: string): string;
export declare function validateUpload(filePath: string): Promise<ValidatedUpload>;
export declare function buildDropboxMultipartBody(upload: Pick<ValidatedUpload, 'filename' | 'contentType' | 'data'>, comment: string, boundary?: string): {
    boundary: string;
    body: Buffer;
};

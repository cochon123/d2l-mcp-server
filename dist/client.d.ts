export declare class D2LClient {
    private request;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    put<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
    private postMultipart;
    getDropboxFolders(orgUnitId: number): Promise<unknown>;
    getDropboxFolder(orgUnitId: number, folderId: number): Promise<unknown>;
    getDropboxSubmissions(orgUnitId: number, folderId: number): Promise<unknown>;
    getMyDropboxSubmissions(orgUnitId: number, folderId: number): Promise<unknown>;
    submitDropboxAssignment(orgUnitId: number, folderId: number, body: Buffer, boundary: string): Promise<unknown>;
    getContentToc(orgUnitId: number): Promise<unknown>;
    getContentTopic(orgUnitId: number, topicId: number): Promise<unknown>;
    getContentModules(orgUnitId: number): Promise<unknown>;
    getContentModule(orgUnitId: number, moduleId: number): Promise<unknown>;
    whoami(): Promise<unknown>;
    getMyGradeValues(orgUnitId: number): Promise<unknown>;
    getGradeObjects(orgUnitId: number): Promise<unknown>;
    getMyCalendarEvents(orgUnitId: number, startDateTime: string, endDateTime: string): Promise<unknown>;
    getNews(orgUnitId: number): Promise<unknown>;
    getMyEnrollments(): Promise<unknown>;
}
export declare const client: D2LClient;

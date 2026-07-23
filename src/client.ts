import { getAuthenticatedContext } from './auth.js';

const D2L_HOST = process.env.D2L_HOST || 'learn.ul.ie';
const BASE_URL = `https://${D2L_HOST}`;
const API_VERSION = '1.57';

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

export class D2LClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const options: {
      method: string;
      headers: Record<string, string>;
      data?: unknown;
    } = {
      method,
      headers,
    };

    if (body) {
      options.data = body;
    }

    const context = await getAuthenticatedContext();
    try {
      const response = await context.request.fetch(url, options);

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`D2L API error ${response.status()}: ${errorText}`);
      }

      const data = await response.json() as T;
      return { data, status: response.status() };
    } finally {
      await context.close();
    }
  }

  async get<T>(path: string): Promise<T> {
    const { data } = await this.request<T>('GET', path);
    return data;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await this.request<T>('POST', path, body);
    return data;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await this.request<T>('PUT', path, body);
    return data;
  }

  async delete<T>(path: string): Promise<T> {
    const { data } = await this.request<T>('DELETE', path);
    return data;
  }

  private async postMultipart(path: string, body: Buffer, boundary: string): Promise<unknown> {
    const url = `${BASE_URL}${path}`;
    const context = await getAuthenticatedContext();
    try {
      const response = await context.request.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/mixed; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        data: body,
      });

      const responseText = await response.text();
      if (!response.ok()) {
        throw new Error(`D2L API error ${response.status()}: ${responseText}`);
      }

      if (!responseText.trim()) return null;
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText;
      }
    } finally {
      await context.close();
    }
  }

  // Dropbox/Assignment endpoints
  async getDropboxFolders(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/`);
  }

  async getDropboxFolder(orgUnitId: number, folderId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}`);
  }

  async getDropboxSubmissions(orgUnitId: number, folderId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/`);
  }

  async getMyDropboxSubmissions(orgUnitId: number, folderId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/mysubmissions/`);
  }

  async submitDropboxAssignment(
    orgUnitId: number,
    folderId: number,
    body: Buffer,
    boundary: string
  ) {
    return this.postMultipart(
      `/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/mysubmissions/`,
      body,
      boundary
    );
  }

  // Content endpoints
  async getContentToc(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/toc`);
  }

  async getContentTopic(orgUnitId: number, topicId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/topics/${topicId}`);
  }

  async getContentModules(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/root/`);
  }

  async getContentModule(orgUnitId: number, moduleId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/modules/${moduleId}/structure/`);
  }

  // User info
  async whoami() {
    return this.get(`/d2l/api/lp/1.43/users/whoami`);
  }

  // Grades endpoints
  async getMyGradeValues(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/grades/values/myGradeValues/`);
  }

  async getGradeObjects(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/grades/`);
  }

  // Calendar endpoints
  async getMyCalendarEvents(orgUnitId: number, startDateTime: string, endDateTime: string) {
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
    });
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/calendar/events/myEvents/?${params}`);
  }

  // News/Announcements endpoints
  async getNews(orgUnitId: number) {
    return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/news/`);
  }

  // Enrollments endpoints (uses LP API v1.43)
  async getMyEnrollments() {
    return this.get(`/d2l/api/lp/1.43/enrollments/myenrollments/`);
  }

}

export const client = new D2LClient();

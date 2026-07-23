import { getAuthenticatedContext } from './auth.js';
const D2L_HOST = process.env.D2L_HOST || 'learn.ul.ie';
const BASE_URL = `https://${D2L_HOST}`;
const API_VERSION = '1.57';
export class D2LClient {
    async request(method, path, body) {
        const url = `${BASE_URL}${path}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        const options = {
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
            const data = await response.json();
            return { data, status: response.status() };
        }
        finally {
            await context.close();
        }
    }
    async get(path) {
        const { data } = await this.request('GET', path);
        return data;
    }
    async post(path, body) {
        const { data } = await this.request('POST', path, body);
        return data;
    }
    async put(path, body) {
        const { data } = await this.request('PUT', path, body);
        return data;
    }
    async delete(path) {
        const { data } = await this.request('DELETE', path);
        return data;
    }
    async postMultipart(path, body, boundary) {
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
            if (!responseText.trim())
                return null;
            try {
                return JSON.parse(responseText);
            }
            catch {
                return responseText;
            }
        }
        finally {
            await context.close();
        }
    }
    // Dropbox/Assignment endpoints
    async getDropboxFolders(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/`);
    }
    async getDropboxFolder(orgUnitId, folderId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}`);
    }
    async getDropboxSubmissions(orgUnitId, folderId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/`);
    }
    async getMyDropboxSubmissions(orgUnitId, folderId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/mysubmissions/`);
    }
    async submitDropboxAssignment(orgUnitId, folderId, body, boundary) {
        return this.postMultipart(`/d2l/api/le/${API_VERSION}/${orgUnitId}/dropbox/folders/${folderId}/submissions/mysubmissions/`, body, boundary);
    }
    // Content endpoints
    async getContentToc(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/toc`);
    }
    async getContentTopic(orgUnitId, topicId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/topics/${topicId}`);
    }
    async getContentModules(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/root/`);
    }
    async getContentModule(orgUnitId, moduleId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/content/modules/${moduleId}/structure/`);
    }
    // User info
    async whoami() {
        return this.get(`/d2l/api/lp/1.43/users/whoami`);
    }
    // Grades endpoints
    async getMyGradeValues(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/grades/values/myGradeValues/`);
    }
    async getGradeObjects(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/grades/`);
    }
    // Calendar endpoints
    async getMyCalendarEvents(orgUnitId, startDateTime, endDateTime) {
        const params = new URLSearchParams({
            startDateTime,
            endDateTime,
        });
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/calendar/events/myEvents/?${params}`);
    }
    // News/Announcements endpoints
    async getNews(orgUnitId) {
        return this.get(`/d2l/api/le/${API_VERSION}/${orgUnitId}/news/`);
    }
    // Enrollments endpoints (uses LP API v1.43)
    async getMyEnrollments() {
        return this.get(`/d2l/api/lp/1.43/enrollments/myenrollments/`);
    }
}
export const client = new D2LClient();

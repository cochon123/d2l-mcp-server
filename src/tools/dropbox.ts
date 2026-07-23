import { z } from 'zod';
import { extname } from 'path';
import { client } from '../client.js';
import { marshalAssignments, marshalAssignment, marshalSubmissions, RawAssignment, RawSubmission } from '../utils/marshal.js';
import { buildDropboxMultipartBody, validateUpload } from '../utils/upload.js';

const DEFAULT_COURSE_ID = process.env.D2L_COURSE_ID ? parseInt(process.env.D2L_COURSE_ID) : undefined;

function getOrgUnitId(orgUnitId?: number): number {
  const id = orgUnitId ?? DEFAULT_COURSE_ID;
  if (!id) {
    throw new Error('No course ID provided and D2L_COURSE_ID environment variable not set');
  }
  return id;
}

function submissionCount(submissions: RawSubmission[]): number {
  return submissions.reduce((total, entity) => total + (entity.Submissions?.length ?? 0), 0);
}

export const assignmentTools = {
  get_assignments: {
    description: `List all assignments for a course with their due dates and instructions. Returns: Name, DueDate (ISO 8601 format - compare with current date to find upcoming/overdue), instructions (in CustomInstructions.Text), point value (Assessment.ScoreDenominator), and Id (needed for get_assignment_submissions). Use this to answer: "What assignments do I have?", "What's due this week?", "What are my upcoming deadlines?", "Show me assignment instructions", "What homework is due soon?"`,
    schema: {
      orgUnitId: z.number().optional().describe('The course ID. Optional if D2L_COURSE_ID env var is set.'),
    },
    handler: async ({ orgUnitId }: { orgUnitId?: number }) => {
      const folders = await client.getDropboxFolders(getOrgUnitId(orgUnitId)) as RawAssignment[];
      return JSON.stringify(marshalAssignments(folders), null, 2);
    },
  },

  get_assignment: {
    description: `Get full details about a specific assignment including complete instructions, due date, point value, allowed file types, and grading rubrics. Use after get_assignments when you need more detail about one assignment.`,
    schema: {
      orgUnitId: z.number().optional().describe('The course ID. Optional if D2L_COURSE_ID env var is set.'),
      assignmentId: z.number().describe('The assignment Id from get_assignments. Example: 37812'),
    },
    handler: async ({ orgUnitId, assignmentId }: { orgUnitId?: number; assignmentId: number }) => {
      const folder = await client.getDropboxFolder(getOrgUnitId(orgUnitId), assignmentId) as RawAssignment;
      return JSON.stringify(marshalAssignment(folder), null, 2);
    },
  },

  get_assignment_submissions: {
    description: `Get the user's submissions for an assignment. Shows submitted files, submission timestamps, feedback comments, and grades received. Use to answer: "Did I submit this assignment?", "What grade did I get?", "When did I submit?", "What feedback did I receive?"`,
    schema: {
      orgUnitId: z.number().optional().describe('The course ID. Optional if D2L_COURSE_ID env var is set.'),
      assignmentId: z.number().describe('The assignment Id from get_assignments. Example: 37812'),
    },
    handler: async ({ orgUnitId, assignmentId }: { orgUnitId?: number; assignmentId: number }) => {
      const submissions = await client.getDropboxSubmissions(getOrgUnitId(orgUnitId), assignmentId) as RawSubmission[];
      return JSON.stringify(marshalSubmissions(submissions), null, 2);
    },
  },

  submit_assignment: {
    description: `Submit one local file to an individual D2L assignment for the current user. This changes external state and can create an official academic submission. Call only after the user has explicitly approved the exact course, assignment, and file. Set confirmed=true only for that explicit approval. The tool validates the local path, file size/type, blocks accidental resubmissions by default, uploads the file, and verifies the resulting submission.`,
    schema: {
      orgUnitId: z.number().optional().describe('The course ID. Optional if D2L_COURSE_ID env var is set.'),
      assignmentId: z.number().describe('The assignment Id from get_assignments.'),
      filePath: z.string().min(1).describe('Path to the local file to submit. It must be inside D2L_UPLOAD_ROOTS.'),
      comment: z.string().max(10000).optional().default('').describe('Optional plain-text submission comment.'),
      confirmed: z.literal(true).describe('Must be true, and only after the user explicitly approves this exact submission.'),
      allowResubmission: z.boolean().optional().default(false).describe('Set true only when the user explicitly approves adding another submission to an assignment that already has one.'),
    },
    handler: async ({
      orgUnitId,
      assignmentId,
      filePath,
      comment = '',
      confirmed,
      allowResubmission = false,
    }: {
      orgUnitId?: number;
      assignmentId: number;
      filePath: string;
      comment?: string;
      confirmed: true;
      allowResubmission?: boolean;
    }) => {
      if (confirmed !== true) {
        throw new Error('Submission requires explicit user confirmation');
      }

      const courseId = getOrgUnitId(orgUnitId);
      const [assignment, upload] = await Promise.all([
        client.getDropboxFolder(courseId, assignmentId) as Promise<RawAssignment>,
        validateUpload(filePath),
      ]);

      if (assignment.DropboxType === 1 || assignment.GroupTypeId != null) {
        throw new Error('Group assignment submission is not supported by this tool');
      }

      if (
        assignment.SubmissionType !== undefined
        && assignment.SubmissionType !== 0
        && assignment.SubmissionType !== 4
      ) {
        throw new Error(`Assignment does not accept file submissions (type ${assignment.SubmissionType})`);
      }

      if (
        assignment.AllowableFileType === 5
        && assignment.CustomAllowableFileTypes?.length
      ) {
        const extension = extname(upload.filename).toLowerCase();
        const allowed = assignment.CustomAllowableFileTypes.map((type) => type.toLowerCase());
        if (!allowed.includes(extension)) {
          throw new Error(
            `File type ${extension || '(none)'} is not allowed; expected one of: ${allowed.join(', ')}`
          );
        }
      }

      const before = await client.getMyDropboxSubmissions(courseId, assignmentId) as RawSubmission[];
      const previousSubmissions = submissionCount(before);
      const previousSubmissionIds = new Set(
        before.flatMap((entity) => entity.Submissions ?? []).map((submission) => submission.Id)
      );
      if (previousSubmissions > 0 && !allowResubmission) {
        throw new Error(
          `Assignment already has ${previousSubmissions} submission(s); set allowResubmission=true only after explicit user approval`
        );
      }

      const multipart = buildDropboxMultipartBody(upload, comment);
      await client.submitDropboxAssignment(courseId, assignmentId, multipart.body, multipart.boundary);

      const after = await client.getMyDropboxSubmissions(courseId, assignmentId) as RawSubmission[];
      const matchingSubmissions = after
        .flatMap((entity) => entity.Submissions ?? [])
        .filter((submission) => (
          !previousSubmissionIds.has(submission.Id)
          && submission.Files?.some(
            (file) => file.FileName === upload.filename && file.Size === upload.size
          )
        ))
        .sort((a, b) => Date.parse(b.SubmissionDate) - Date.parse(a.SubmissionDate));
      const verifiedSubmission = matchingSubmissions[0];

      return JSON.stringify({
        submitted: true,
        verified: Boolean(verifiedSubmission),
        courseId,
        assignmentId,
        assignmentName: assignment.Name,
        dueDate: assignment.DueDate,
        filename: upload.filename,
        size: upload.size,
        sha256: upload.sha256,
        previousSubmissions,
        submissionId: verifiedSubmission?.Id ?? null,
        submissionDate: verifiedSubmission?.SubmissionDate ?? null,
        note: verifiedSubmission
          ? 'D2L accepted the upload and the submitted file was verified.'
          : 'D2L accepted the upload, but the follow-up query could not match the file. Do not retry automatically; check D2L first to avoid a duplicate.',
      }, null, 2);
    },
  },
};

import { z } from 'zod';
export declare const assignmentTools: {
    get_assignments: {
        description: string;
        schema: {
            orgUnitId: z.ZodOptional<z.ZodNumber>;
        };
        handler: ({ orgUnitId }: {
            orgUnitId?: number;
        }) => Promise<string>;
    };
    get_assignment: {
        description: string;
        schema: {
            orgUnitId: z.ZodOptional<z.ZodNumber>;
            assignmentId: z.ZodNumber;
        };
        handler: ({ orgUnitId, assignmentId }: {
            orgUnitId?: number;
            assignmentId: number;
        }) => Promise<string>;
    };
    get_assignment_submissions: {
        description: string;
        schema: {
            orgUnitId: z.ZodOptional<z.ZodNumber>;
            assignmentId: z.ZodNumber;
        };
        handler: ({ orgUnitId, assignmentId }: {
            orgUnitId?: number;
            assignmentId: number;
        }) => Promise<string>;
    };
    submit_assignment: {
        description: string;
        schema: {
            orgUnitId: z.ZodOptional<z.ZodNumber>;
            assignmentId: z.ZodNumber;
            filePath: z.ZodString;
            comment: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            confirmed: z.ZodLiteral<true>;
            allowResubmission: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        };
        handler: ({ orgUnitId, assignmentId, filePath, comment, confirmed, allowResubmission, }: {
            orgUnitId?: number;
            assignmentId: number;
            filePath: string;
            comment?: string;
            confirmed: true;
            allowResubmission?: boolean;
        }) => Promise<string>;
    };
};

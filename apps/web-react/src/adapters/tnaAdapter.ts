import {
    TnaCalculateGapsRequestSchema,
    TnaCalculateGapsResponseSchema,
    TnaGapsReportRequestSchema,
    TnaGapsReportResponseSchema,
    TnaLmsReportRequestSchema,
    TnaLmsReportResponseSchema,
    TnaNeedCreateSchema,
    TnaNeedMutationResponseSchema,
    TnaSummaryRequestSchema,
    TnaSummaryResponseSchema,
    type TnaCalculateGapsRequest,
    type TnaCalculateGapsResponse,
    type TnaGapsReportRequest,
    type TnaGapsReportResponse,
    type TnaLmsReportRequest,
    type TnaLmsReportResponse,
    type TnaNeedCreateInput,
    type TnaNeedMutationResponse,
    type TnaSummaryRequest,
    type TnaSummaryResponse,
    type TnaCompetenciesListRequest,
    type TnaCompetenciesListResponse,
    TnaCompetenciesListRequestSchema,
    TnaCompetenciesListResponseSchema,
    type TnaAssessmentCreateRequest,
    type TnaAssessmentCreateResponse,
    TnaAssessmentCreateRequestSchema,
    TnaAssessmentCreateResponseSchema,
    type TnaAssessmentSelfSubmitRequest,
    TnaAssessmentSelfSubmitRequestSchema,
    type TnaAssessmentGetRequest,
    type TnaAssessmentGetResponse,
    TnaAssessmentGetRequestSchema,
    TnaAssessmentGetResponseSchema,
    type TnaAssessmentListRequest,
    type TnaAssessmentListResponse,
    TnaAssessmentListRequestSchema,
    TnaAssessmentListResponseSchema,
} from '@demo-kpi/contracts';

import { transport } from './transport';

export const tnaAdapter = {
    calculateGaps(input: TnaCalculateGapsRequest) {
        const payload = TnaCalculateGapsRequestSchema.parse(input);
        return transport.execute<TnaCalculateGapsResponse>({
            domain: 'tna',
            action: 'tna/calculate-gaps',
            payload,
            schema: TnaCalculateGapsResponseSchema,
        });
    },

    summary(input: TnaSummaryRequest = {}) {
        const payload = TnaSummaryRequestSchema.parse(input);
        return transport.execute<TnaSummaryResponse>({
            domain: 'tna',
            action: 'tna/summary',
            payload,
            schema: TnaSummaryResponseSchema,
        });
    },

    gapsReport(input: TnaGapsReportRequest = {}) {
        const payload = TnaGapsReportRequestSchema.parse(input);
        return transport.execute<TnaGapsReportResponse>({
            domain: 'tna',
            action: 'tna/gaps-report',
            payload,
            schema: TnaGapsReportResponseSchema,
        });
    },

    lmsReport(input: TnaLmsReportRequest = {}) {
        const payload = TnaLmsReportRequestSchema.parse(input);
        return transport.execute<TnaLmsReportResponse>({
            domain: 'tna',
            action: 'tna/lms-report',
            payload,
            schema: TnaLmsReportResponseSchema,
        });
    },

    createNeed(input: TnaNeedCreateInput) {
        const payload = TnaNeedCreateSchema.parse(input);
        return transport.execute<TnaNeedMutationResponse>({
            domain: 'tna',
            action: 'tna/needs/create',
            payload,
            schema: TnaNeedMutationResponseSchema,
        });
    },

    listCompetencies(input: TnaCompetenciesListRequest) {
        const payload = TnaCompetenciesListRequestSchema.parse(input);
        return transport.execute<TnaCompetenciesListResponse>({
            domain: 'tna',
            action: 'tna/competencies/list',
            payload,
            schema: TnaCompetenciesListResponseSchema,
        });
    },

    createAssessment(input: TnaAssessmentCreateRequest) {
        const payload = TnaAssessmentCreateRequestSchema.parse(input);
        return transport.execute<TnaAssessmentCreateResponse>({
            domain: 'tna',
            action: 'tna/assessment/create',
            payload,
            schema: TnaAssessmentCreateResponseSchema,
        });
    },

    selfSubmitAssessment(input: TnaAssessmentSelfSubmitRequest) {
        const payload = TnaAssessmentSelfSubmitRequestSchema.parse(input);
        return transport.execute<{ success: true }>({
            domain: 'tna',
            action: 'tna/assessment/self-submit',
            payload,
            schema: TnaNeedMutationResponseSchema, // reusing success schema
        });
    },

    getAssessment(input: TnaAssessmentGetRequest) {
        const payload = TnaAssessmentGetRequestSchema.parse(input);
        return transport.execute<TnaAssessmentGetResponse>({
            domain: 'tna',
            action: 'tna/assessment/get',
            payload,
            schema: TnaAssessmentGetResponseSchema,
        });
    },

    listAssessments(input: TnaAssessmentListRequest = {}) {
        const payload = TnaAssessmentListRequestSchema.parse(input);
        return transport.execute<TnaAssessmentListResponse>({
            domain: 'tna',
            action: 'tna/assessment/list',
            payload,
            schema: TnaAssessmentListResponseSchema,
        });
    },
};

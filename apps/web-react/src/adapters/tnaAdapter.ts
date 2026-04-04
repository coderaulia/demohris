import {
    TnaCalculateGapsRequestSchema,
    TnaCalculateGapsResponseSchema,
    TnaGapsReportRequestSchema,
    TnaGapsReportResponseSchema,
    TnaLmsReportRequestSchema,
    TnaLmsReportResponseSchema,
    TnaSummaryRequestSchema,
    TnaSummaryResponseSchema,
    type TnaCalculateGapsRequest,
    type TnaGapsReportRequest,
    type TnaLmsReportRequest,
    type TnaSummaryRequest,
} from '@demo-kpi/contracts';

import { transport } from './transport';

export const tnaAdapter = {
    calculateGaps(input: TnaCalculateGapsRequest) {
        const payload = TnaCalculateGapsRequestSchema.parse(input);
        return transport.execute({
            domain: 'tna',
            action: 'tna/calculate-gaps',
            payload,
            schema: TnaCalculateGapsResponseSchema,
        });
    },

    summary(input: TnaSummaryRequest = {}) {
        const payload = TnaSummaryRequestSchema.parse(input);
        return transport.execute({
            domain: 'tna',
            action: 'tna/summary',
            payload,
            schema: TnaSummaryResponseSchema,
        });
    },

    gapsReport(input: TnaGapsReportRequest = {}) {
        const payload = TnaGapsReportRequestSchema.parse(input);
        return transport.execute({
            domain: 'tna',
            action: 'tna/gaps-report',
            payload,
            schema: TnaGapsReportResponseSchema,
        });
    },

    lmsReport(input: TnaLmsReportRequest = {}) {
        const payload = TnaLmsReportRequestSchema.parse(input);
        return transport.execute({
            domain: 'tna',
            action: 'tna/lms-report',
            payload,
            schema: TnaLmsReportResponseSchema,
        });
    },
};

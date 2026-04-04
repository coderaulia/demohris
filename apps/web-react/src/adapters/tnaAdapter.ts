import {
    TnaCalculateGapsRequestSchema,
    TnaCalculateGapsResponseSchema,
    TnaSummaryRequestSchema,
    TnaSummaryResponseSchema,
    type TnaCalculateGapsRequest,
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
};

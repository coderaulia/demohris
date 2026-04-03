import {
    TnaCalculateGapsRequestSchema,
    TnaCalculateGapsResponseSchema,
    type TnaCalculateGapsRequest,
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
};

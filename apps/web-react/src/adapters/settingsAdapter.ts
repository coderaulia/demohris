import {
    CompetenciesListResponseSchema,
    CompetencyMatrixCreateSchema,
    CompetencyMatrixMutationResponseSchema,
    CompetencyMatrixUpdateSchema,
    OrgSettingsResponseSchema,
    OrgSettingsSaveSchema,
    PositionCreateSchema,
    PositionListResponseSchema,
    PositionMutationResponseSchema,
    PositionUpdateSchema,
    type CompetencyMatrixCreateInput,
    type CompetencyMatrixMutationResponse,
    type CompetencyMatrixUpdateInput,
    type OrgSettingsResponse,
    type OrgSettingsSaveInput,
    type PositionCreateInput,
    type PositionListResponse,
    type PositionMutationResponse,
    type PositionUpdateInput,
} from '@demo-kpi/contracts';

import { transport } from './transport';

export const settingsAdapter = {
    getOrg(): Promise<OrgSettingsResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/org/get',
            payload: {},
            method: 'POST',
            schema: OrgSettingsResponseSchema,
        });
    },

    saveOrg(input: OrgSettingsSaveInput): Promise<OrgSettingsResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/org/save',
            payload: OrgSettingsSaveSchema.parse(input),
            method: 'POST',
            schema: OrgSettingsResponseSchema,
        });
    },

    listPositions(): Promise<PositionListResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/positions/list',
            payload: {},
            method: 'POST',
            schema: PositionListResponseSchema,
        });
    },

    createPosition(input: PositionCreateInput): Promise<PositionMutationResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/positions/create',
            payload: PositionCreateSchema.parse(input),
            method: 'POST',
            schema: PositionMutationResponseSchema,
        });
    },

    updatePosition(input: PositionUpdateInput): Promise<PositionMutationResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/positions/update',
            payload: PositionUpdateSchema.parse(input),
            method: 'POST',
            schema: PositionMutationResponseSchema,
        });
    },

    deletePosition(positionId: string): Promise<{ success: true }> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/positions/delete',
            payload: { position_id: positionId },
            method: 'POST',
            schema: PositionMutationResponseSchema.pick({ success: true }),
        });
    },

    listCompetencies() {
        return transport.execute({
            domain: 'settings',
            action: 'settings/competencies/list',
            payload: {},
            method: 'POST',
            schema: CompetenciesListResponseSchema,
        });
    },

    createCompetencyMatrix(input: CompetencyMatrixCreateInput): Promise<CompetencyMatrixMutationResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/competencies/create',
            payload: CompetencyMatrixCreateSchema.parse(input),
            method: 'POST',
            schema: CompetencyMatrixMutationResponseSchema,
        });
    },

    updateCompetencyMatrix(input: CompetencyMatrixUpdateInput): Promise<CompetencyMatrixMutationResponse> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/competencies/update',
            payload: CompetencyMatrixUpdateSchema.parse(input),
            method: 'POST',
            schema: CompetencyMatrixMutationResponseSchema,
        });
    },

    deleteCompetencyMatrix(positionId: string): Promise<{ success: true }> {
        return transport.execute({
            domain: 'settings',
            action: 'settings/competencies/delete',
            payload: { position_id: positionId },
            method: 'POST',
            schema: CompetencyMatrixMutationResponseSchema.pick({ success: true }),
        });
    },
};

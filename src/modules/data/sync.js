import { state, emit } from './runtime.js';
import { isFeatureEnabled } from '../../lib/features.js';
import { fetchActivityLogs } from './activity.js';
import { fetchSettings } from './settings.js';
import { fetchEmployees } from './employees.js';
import { fetchConfig } from './config.js';
import {
    fetchKpiDefinitions,
    fetchKpiDefinitionVersions,
    fetchEmployeeKpiTargetVersions,
    fetchKpiRecords,
    fetchKpiWeightProfiles,
    fetchKpiWeightItems,
    fetchEmployeePerformanceScores,
} from './kpi.js';
import {
    fetchProbationReviews,
    fetchProbationQualitativeItems,
    fetchProbationMonthlyScores,
    fetchProbationAttendanceRecords,
} from './probation.js';
import { fetchPipPlans, fetchPipActions } from './pip.js';

const CORE_TASKS = [
    fetchSettings,
    fetchEmployees,
    fetchConfig,
];

const KPI_TASKS = [
    fetchKpiDefinitions,
    fetchKpiDefinitionVersions,
    fetchEmployeeKpiTargetVersions,
    fetchKpiRecords,
    fetchKpiWeightProfiles,
    fetchKpiWeightItems,
    fetchEmployeePerformanceScores,
];

const PROBATION_TASKS = [
    fetchProbationReviews,
    fetchProbationQualitativeItems,
    fetchProbationMonthlyScores,
    fetchProbationAttendanceRecords,
];

const PIP_TASKS = [
    fetchPipPlans,
    fetchPipActions,
];

const TNA_TASKS = [];
const LMS_TASKS = [];

export function getSyncTasks() {
    const tasks = [...CORE_TASKS];

    if (isFeatureEnabled('KPI')) {
        tasks.push(...KPI_TASKS);
    }

    if (isFeatureEnabled('PROBATION') && isFeatureEnabled('KPI')) {
        tasks.push(...PROBATION_TASKS);
    }

    if (isFeatureEnabled('PIP') && isFeatureEnabled('KPI')) {
        tasks.push(...PIP_TASKS);
    }

    if (isFeatureEnabled('TNA')) {
        tasks.push(...TNA_TASKS);
    }

    if (isFeatureEnabled('LMS')) {
        tasks.push(...LMS_TASKS);
    }

    return tasks;
}

export async function syncAll() {
    const tasks = getSyncTasks();

    if (state.currentUser?.role === 'superadmin' || state.currentUser?.role === 'manager') {
        tasks.push(fetchActivityLogs);
    }

    await Promise.all(tasks.map(fn => fn()));
    emit('data:synced');
}

export async function syncKpi() {
    if (!isFeatureEnabled('KPI')) return;
    await Promise.all(KPI_TASKS.map(fn => fn()));
    emit('data:synced');
}

export async function syncProbation() {
    if (!isFeatureEnabled('PROBATION') || !isFeatureEnabled('KPI')) return;
    await Promise.all(PROBATION_TASKS.map(fn => fn()));
    emit('data:synced');
}

export async function syncPip() {
    if (!isFeatureEnabled('PIP') || !isFeatureEnabled('KPI')) return;
    await Promise.all(PIP_TASKS.map(fn => fn()));
    emit('data:synced');
}

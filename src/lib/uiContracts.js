const DOM_IDS = Object.freeze({
    records: Object.freeze({
        tableBody: 'records-table-body',
        probationContainer: 'probation-pip-content',
    }),
    dashboard: Object.freeze({
        deptModalBody: 'deptKpiModalBody',
        deptModalTabs: 'deptKpiMonthTabs',
    }),
});

const SCORE_LABELS = Object.freeze({
    work: 'Work',
    managing: 'Managing',
    attitude: 'Attitude',
    quantitative: 'Quantitative',
    qualitative: 'Qualitative',
    final: 'Final Score',
});

const SCORE_STATUS_CLASSES = Object.freeze({
    excellent: 'bg-success',
    good: 'bg-primary',
    warning: 'bg-warning text-dark',
    poor: 'bg-danger',
});

const KPI_STATUS_LABELS = Object.freeze({
    onTrack: 'On Track',
    delayed: 'Delayed',
    atRisk: 'At Risk',
});

const KPI_STATUS_CLASSES = Object.freeze({
    onTrack: SCORE_STATUS_CLASSES.excellent,
    delayed: SCORE_STATUS_CLASSES.warning,
    atRisk: SCORE_STATUS_CLASSES.poor,
});

function getScoreBandClass(score) {
    const value = Number(score) || 0;
    if (value >= 100) return SCORE_STATUS_CLASSES.excellent;
    if (value >= 75) return SCORE_STATUS_CLASSES.good;
    if (value >= 50) return SCORE_STATUS_CLASSES.warning;
    return SCORE_STATUS_CLASSES.poor;
}

function getProbationScoreBandClass(score) {
    const value = Number(score) || 0;
    if (value >= 90) return SCORE_STATUS_CLASSES.excellent;
    if (value >= 75) return SCORE_STATUS_CLASSES.good;
    if (value >= 60) return SCORE_STATUS_CLASSES.warning;
    return SCORE_STATUS_CLASSES.poor;
}

function getKpiStatus(achievement) {
    const value = Number(achievement) || 0;
    if (value >= 100) return { label: KPI_STATUS_LABELS.onTrack, className: KPI_STATUS_CLASSES.onTrack };
    if (value >= 75) return { label: KPI_STATUS_LABELS.delayed, className: KPI_STATUS_CLASSES.delayed };
    return { label: KPI_STATUS_LABELS.atRisk, className: KPI_STATUS_CLASSES.atRisk };
}

export {
    DOM_IDS,
    SCORE_LABELS,
    SCORE_STATUS_CLASSES,
    KPI_STATUS_LABELS,
    KPI_STATUS_CLASSES,
    getScoreBandClass,
    getProbationScoreBandClass,
    getKpiStatus,
};

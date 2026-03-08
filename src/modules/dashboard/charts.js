import { KPI_STATUS_CLASSES } from '../../lib/uiContracts.js';

function getKpiAchievementClass(achievement) {
    if (achievement >= 100) return KPI_STATUS_CLASSES.onTrack;
    if (achievement >= 75) return KPI_STATUS_CLASSES.delayed;
    return KPI_STATUS_CLASSES.atRisk;
}

export {
    getKpiAchievementClass,
};

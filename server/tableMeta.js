export const TABLE_META = {
    app_settings: {
        primaryKey: 'key',
    },
    employees: {
        primaryKey: 'employee_id',
        jsonColumns: ['scores', 'self_scores', 'history', 'training_history', 'kpi_targets'],
        booleanColumns: ['must_change_password'],
        hiddenColumns: ['password_hash', 'password_reset_requested_at'],
    },
    competency_config: {
        primaryKey: 'position_name',
        jsonColumns: ['competencies'],
    },
    kpi_definitions: {
        primaryKey: 'id',
        autoUuid: true,
        booleanColumns: ['approval_required', 'is_active'],
    },
    kpi_definition_versions: {
        primaryKey: 'id',
        autoUuid: true,
    },
    employee_kpi_target_versions: {
        primaryKey: 'id',
        autoUuid: true,
    },
    kpi_records: {
        primaryKey: 'id',
        autoUuid: true,
    },
    admin_activity_log: {
        primaryKey: 'id',
        autoIncrement: true,
        jsonColumns: ['details'],
    },
    employee_assessments: {
        primaryKey: 'id',
        autoUuid: true,
    },
    employee_assessment_scores: {
        primaryKey: 'id',
        autoUuid: true,
    },
    employee_assessment_history: {
        primaryKey: 'id',
        autoUuid: true,
    },
    employee_training_records: {
        primaryKey: 'id',
        autoUuid: true,
    },
    employee_performance_scores: {
        primaryKey: 'id',
        autoUuid: true,
        jsonColumns: ['detail'],
    },
    kpi_weight_profiles: {
        primaryKey: 'id',
        autoUuid: true,
        booleanColumns: ['active'],
    },
    kpi_weight_items: {
        primaryKey: 'id',
        autoUuid: true,
    },
    probation_reviews: {
        primaryKey: 'id',
        autoUuid: true,
    },
    probation_qualitative_items: {
        primaryKey: 'id',
        autoUuid: true,
    },
    probation_monthly_scores: {
        primaryKey: 'id',
        autoUuid: true,
    },
    probation_attendance_records: {
        primaryKey: 'id',
        autoUuid: true,
    },
    pip_plans: {
        primaryKey: 'id',
        autoUuid: true,
    },
    pip_actions: {
        primaryKey: 'id',
        autoUuid: true,
    },
};

export function getTableMeta(table) {
    return TABLE_META[table] || null;
}

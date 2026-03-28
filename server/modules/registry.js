import { getTableMeta as getOriginalTableMeta, TABLE_META } from '../tableMeta.js';
import { isFeatureEnabled } from '../features.js';

const tableRegistry = new Map(TABLE_META);
const permissionRegistry = new Map();

export function getTableMeta(table) {
    return tableRegistry.get(table) || null;
}

export { TABLE_META };

export function registerTable(tableName, meta, permissions = {}) {
    tableRegistry.set(tableName, meta);
    if (permissions.read !== undefined || permissions.write !== undefined) {
        permissionRegistry.set(tableName, permissions);
    }
}

export function getRegisteredTables() {
    return [...tableRegistry.keys()];
}

export function getTableMetadata(tableName) {
    return tableRegistry.get(tableName) || null;
}

export function getTablePermissions(tableName) {
    return permissionRegistry.get(tableName) || null;
}

export async function isTableReadable(req, table, row) {
    const perms = permissionRegistry.get(table);
    if (!perms) {
        return getTableMeta(table) !== null;
    }
    if (typeof perms.read === 'function') {
        return perms.read(req, row);
    }
    return Boolean(perms.read);
}

export async function isTableWritable(req, table, row, action = 'update') {
    const perms = permissionRegistry.get(table);
    if (!perms) {
        const meta = getTableMeta(table);
        return meta !== null;
    }
    if (typeof perms.write === 'function') {
        return perms.write(req, row, action);
    }
    return Boolean(perms.write);
}

export function isTableRegistered(tableName) {
    return tableRegistry.has(tableName);
}

export function getRelatedEmployeeId(table, row) {
    if (!row) return '';

    switch (table) {
        case 'employee_assessment_scores':
            return row.assessment_id ? null : row.employee_id;
        case 'probation_qualitative_items':
        case 'probation_monthly_scores':
        case 'probation_attendance_records':
            return row.probation_review_id ? null : row.employee_id;
        case 'pip_actions':
            return row.pip_plan_id ? null : row.employee_id;
        case 'training_plan_items':
            return row.plan_id ? null : row.employee_id;
        default:
            return row.employee_id || row.actor_employee_id || '';
    }
}

function registerCoreTables() {
    registerTable('app_settings', {
        primaryKey: 'key',
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return role === 'superadmin' || role === 'hr';
        },
    });

    registerTable('employees', {
        primaryKey: 'employee_id',
        jsonColumns: ['scores', 'self_scores', 'history', 'training_history'],
        booleanColumns: ['must_change_password'],
        hiddenColumns: ['password_hash', 'password_reset_requested_at'],
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (req.currentUser.role === 'superadmin') return true;
            const employeeId = row?.employee_id || row?.id;
            if (req.currentUser.role === 'employee') {
                return String(employeeId) === String(req.currentUser.employee_id);
            }
            return true;
        },
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            if (action === 'insert' || action === 'delete') return role === 'superadmin';
            if (role === 'superadmin') return true;
            return String(row?.employee_id) === String(req.currentUser?.employee_id);
        },
    });

    registerTable('competency_config', {
        primaryKey: 'position_name',
        jsonColumns: ['competencies'],
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return role === 'superadmin' || role === 'manager';
        },
    });

    registerTable('admin_activity_log', {
        primaryKey: 'id',
        autoIncrement: true,
        jsonColumns: ['details'],
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'director', 'hr'].includes(role)) return true;
            return String(row?.actor_employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            return String(row?.actor_employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('employee_assessments', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('employee_assessment_scores', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('employee_assessment_history', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('employee_training_records', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });
}

function registerKpiTables() {
    if (!isFeatureEnabled('KPI')) return;

    registerTable('kpi_definitions', {
        primaryKey: 'id',
        autoUuid: true,
        booleanColumns: ['approval_required', 'is_active'],
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('kpi_definition_versions', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('employee_kpi_target_versions', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('kpi_records', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('kpi_weight_profiles', {
        primaryKey: 'id',
        autoUuid: true,
        booleanColumns: ['active'],
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'hr'].includes(role);
        },
    });

    registerTable('kpi_weight_items', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'hr'].includes(role);
        },
    });

    registerTable('employee_performance_scores', {
        primaryKey: 'id',
        autoUuid: true,
        jsonColumns: ['detail'],
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });
}

function registerProbationTables() {
    if (!isFeatureEnabled('PROBATION') || !isFeatureEnabled('KPI')) return;

    registerTable('probation_reviews', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('probation_qualitative_items', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return true;
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('probation_monthly_scores', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return true;
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('probation_attendance_records', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return true;
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });
}

function registerPipTables() {
    if (!isFeatureEnabled('PIP') || !isFeatureEnabled('KPI')) return;

    registerTable('pip_plans', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('pip_actions', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return true;
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return true;
        },
    });
}

function registerTnaTables() {
    if (!isFeatureEnabled('TNA')) return;

    registerTable('training_needs', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('training_need_records', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('training_plans', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });

    registerTable('training_plan_items', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return true;
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return true;
        },
    });
}

function registerLmsTables() {
    if (!isFeatureEnabled('LMS')) return;

    registerTable('training_courses', {
        primaryKey: 'id',
        autoUuid: true,
        jsonColumns: ['competencies_covered'],
    }, {
        read: () => true,
        write: (req, row, action) => {
            const role = req.currentUser?.role;
            return ['superadmin', 'manager', 'hr'].includes(role);
        },
    });

    registerTable('training_enrollments', {
        primaryKey: 'id',
        autoUuid: true,
    }, {
        read: (req, row) => {
            if (!req.currentUser) return false;
            if (['superadmin', 'manager', 'director', 'hr'].includes(req.currentUser.role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
        write: (req, row, action) => {
            if (!req.currentUser) return false;
            const role = req.currentUser.role;
            if (['superadmin', 'manager', 'hr'].includes(role)) return true;
            return String(row?.employee_id || '') === String(req.currentUser?.employee_id || '');
        },
    });
}

export function initializeRegistry() {
    registerCoreTables();
    registerKpiTables();
    registerProbationTables();
    registerPipTables();
    registerTnaTables();
    registerLmsTables();
}

initializeRegistry();

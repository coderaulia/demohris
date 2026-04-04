import { pool } from '../app.js';
import { fetchModuleSettingsFromSupabase, resolveModulesReadSource } from '../compat/supabaseModulesRead.js';

function parseJsonObject(value, fallback = {}) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function parseJsonArray(value, fallback = []) {
    const parsed = parseJsonObject(value, fallback);
    return Array.isArray(parsed) ? parsed : fallback;
}

function normalizeModule(row = {}) {
    return {
        ...row,
        is_enabled: Boolean(row.is_enabled),
        settings: parseJsonObject(row.settings, {}),
        dependencies: parseJsonArray(row.dependencies, []),
    };
}

function getInput(req, key, fallback = '') {
    const bodyValue = req.body?.[key];
    if (bodyValue !== undefined && bodyValue !== null && bodyValue !== '') return bodyValue;
    const queryValue = req.query?.[key];
    if (queryValue !== undefined && queryValue !== null && queryValue !== '') return queryValue;
    const paramValue = req.params?.[key];
    if (paramValue !== undefined && paramValue !== null && paramValue !== '') return paramValue;
    return fallback;
}

async function readModulesRows({
    moduleId = '',
    category = '',
    onlyActive = false,
    orderBy = 'category.asc,module_name.asc',
} = {}) {
    const sourceState = resolveModulesReadSource();
    if (sourceState.source === 'supabase') {
        const supabaseRows = await fetchModuleSettingsFromSupabase({
            moduleId,
            category,
            onlyActive,
            orderBy,
        });
        return {
            source: 'supabase',
            rows: supabaseRows || [],
        };
    }

    if (moduleId) {
        const [rows] = await pool.query(
            'SELECT * FROM module_settings WHERE module_id = ?',
            [moduleId]
        );
        return { source: 'legacy', rows };
    }

    const values = [];
    const conditions = [];
    if (category) {
        conditions.push('category = ?');
        values.push(category);
    }
    if (onlyActive) {
        conditions.push('is_enabled = 1');
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT * FROM module_settings${where} ORDER BY category, module_name`,
        values
    );
    return { source: 'legacy', rows };
}

export async function getAllModules(req, res, next) {
    try {
        const { rows } = await readModulesRows();
        const modules = rows.map(normalizeModule);

        res.json({ success: true, modules });
    } catch (error) {
        next(error);
    }
}

export async function getModule(req, res, next) {
    try {
        const moduleId = String(getInput(req, 'moduleId', getInput(req, 'module_id', ''))).trim();
        if (!moduleId) {
            return res.status(400).json({ success: false, error: 'moduleId is required' });
        }

        const { rows } = await readModulesRows({ moduleId });

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Module not found' });
        }

        const module = normalizeModule(rows[0]);
        res.json({
            success: true,
            module,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateModuleSettings(req, res, next) {
    try {
        const { moduleId } = req.params;
        const { is_enabled, settings } = req.body;
        const actorEmployeeId = req.currentUser?.employee_id;
        const actorRole = req.currentUser?.role;

        const [existing] = await pool.query(
            'SELECT * FROM module_settings WHERE module_id = ?',
            [moduleId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Module not found' });
        }

        const oldModule = existing[0];
        const oldEnabled = Boolean(oldModule.is_enabled);
        const oldSettings = typeof oldModule.settings === 'string' 
            ? JSON.parse(oldModule.settings || '{}') 
            : oldModule.settings;

        if (is_enabled !== undefined && is_enabled !== oldEnabled) {
            if (is_enabled) {
                const canEnable = await checkDependencies(moduleId, pool);
                if (!canEnable.success) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot enable module',
                        missing_dependencies: canEnable.missing
                    });
                }
            } else {
                const canDisable = await checkDependents(moduleId, pool);
                if (!canDisable.success) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot disable module',
                        active_dependents: canDisable.dependents
                    });
                }
            }
        }

        const updates = [];
        const values = [];

        if (is_enabled !== undefined) {
            updates.push('is_enabled = ?');
            values.push(is_enabled ? 1 : 0);
        }

        if (settings !== undefined) {
            updates.push('settings = ?');
            values.push(JSON.stringify(settings));
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }

        values.push(moduleId);
        await pool.query(
            `UPDATE module_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE module_id = ?`,
            values
        );

        await pool.query(
            `INSERT INTO module_activity_log 
             (module_id, action, actor_employee_id, actor_role, old_value, new_value, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                moduleId,
                is_enabled !== undefined ? (is_enabled ? 'enabled' : 'disabled') : 'configured',
                actorEmployeeId,
                actorRole,
                JSON.stringify({ is_enabled: oldEnabled, settings: oldSettings }),
                JSON.stringify({ is_enabled, settings }),
                req.ip,
                req.get('User-Agent')
            ]
        );

        const [updated] = await pool.query(
            'SELECT * FROM module_settings WHERE module_id = ?',
            [moduleId]
        );

        res.json({
            success: true,
            module: {
                ...updated[0],
                is_enabled: Boolean(updated[0].is_enabled),
                settings: typeof updated[0].settings === 'string' ? JSON.parse(updated[0].settings || '{}') : updated[0].settings,
                dependencies: typeof updated[0].dependencies === 'string' ? JSON.parse(updated[0].dependencies || '[]') : updated[0].dependencies,
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function toggleModule(req, res, next) {
    try {
        const { moduleId } = req.params;
        const { enable } = req.body;
        const actorEmployeeId = req.currentUser?.employee_id;
        const actorRole = req.currentUser?.role;

        const [existing] = await pool.query(
            'SELECT * FROM module_settings WHERE module_id = ?',
            [moduleId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Module not found' });
        }

        const oldEnabled = Boolean(existing[0].is_enabled);
        const newEnabled = enable !== undefined ? Boolean(enable) : !oldEnabled;

        if (newEnabled && !oldEnabled) {
            const canEnable = await checkDependencies(moduleId, pool);
            if (!canEnable.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot enable module',
                    missing_dependencies: canEnable.missing
                });
            }
        } else if (!newEnabled && oldEnabled) {
            const canDisable = await checkDependents(moduleId, pool);
            if (!canDisable.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot disable module',
                    active_dependents: canDisable.dependents
                });
            }
        }

        await pool.query(
            'UPDATE module_settings SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE module_id = ?',
            [newEnabled ? 1 : 0, moduleId]
        );

        await pool.query(
            `INSERT INTO module_activity_log 
             (module_id, action, actor_employee_id, actor_role, old_value, new_value, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                moduleId,
                newEnabled ? 'enabled' : 'disabled',
                actorEmployeeId,
                actorRole,
                JSON.stringify({ is_enabled: oldEnabled }),
                JSON.stringify({ is_enabled: newEnabled }),
                req.ip,
                req.get('User-Agent')
            ]
        );

        const [updated] = await pool.query(
            'SELECT * FROM module_settings WHERE module_id = ?',
            [moduleId]
        );

        res.json({
            success: true,
            module: {
                ...updated[0],
                is_enabled: Boolean(updated[0].is_enabled)
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getModuleActivityLog(req, res, next) {
    try {
        const { moduleId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const [rows] = await pool.query(
            `SELECT mal.*, e.name as actor_name 
             FROM module_activity_log mal
             LEFT JOIN employees e ON mal.actor_employee_id = e.employee_id
             WHERE mal.module_id = ?
             ORDER BY mal.created_at DESC
             LIMIT ? OFFSET ?`,
            [moduleId, parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM module_activity_log WHERE module_id = ?',
            [moduleId]
        );

        res.json({
            success: true,
            logs: rows,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        next(error);
    }
}

export async function getModulesByCategory(req, res, next) {
    try {
        const category = String(getInput(req, 'category', '')).trim();
        
        const validCategories = ['core', 'performance', 'talent', 'operations', 'analytics'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category',
                valid_categories: validCategories
            });
        }

        const { rows } = await readModulesRows({ category, orderBy: 'module_name.asc' });

        res.json({
            success: true,
            modules: rows.map(normalizeModule),
        });
    } catch (error) {
        next(error);
    }
}

export async function getActiveModules(req, res, next) {
    try {
        const { rows } = await readModulesRows({ onlyActive: true });

        res.json({
            success: true,
            modules: rows.map(normalizeModule),
        });
    } catch (error) {
        next(error);
    }
}

async function checkDependencies(moduleId, pool) {
    const [rows] = await pool.query(
        'SELECT dependencies FROM module_settings WHERE module_id = ?',
        [moduleId]
    );

    if (rows.length === 0) {
        return { success: false, missing: ['Module not found'] };
    }

    const dependencies = typeof rows[0].dependencies === 'string' 
        ? JSON.parse(rows[0].dependencies || '[]') 
        : rows[0].dependencies || [];

    if (dependencies.length === 0) {
        return { success: true };
    }

    const placeholders = dependencies.map(() => '?').join(',');
    const [depRows] = await pool.query(
        `SELECT module_id, is_enabled FROM module_settings WHERE module_id IN (${placeholders})`,
        dependencies
    );

    const missing = [];
    const disabled = [];

    depRows.forEach(row => {
        if (!row.is_enabled) {
            disabled.push(row.module_id);
        }
    });

    dependencies.forEach(dep => {
        if (!depRows.find(r => r.module_id === dep)) {
            missing.push(dep);
        }
    });

    if (missing.length > 0 || disabled.length > 0) {
        return { 
            success: false, 
            missing: missing,
            disabled: disabled
        };
    }

    return { success: true };
}

async function checkDependents(moduleId, pool) {
    const [rows] = await pool.query(
        'SELECT module_id, dependencies FROM module_settings WHERE is_enabled = 1'
    );

    const activeDependents = [];

    rows.forEach(row => {
        const deps = typeof row.dependencies === 'string' 
            ? JSON.parse(row.dependencies || '[]') 
            : row.dependencies || [];
        
        if (deps.includes(moduleId)) {
            activeDependents.push(row.module_id);
        }
    });

    if (activeDependents.length > 0) {
        return { success: false, dependents: activeDependents };
    }

    return { success: true };
}

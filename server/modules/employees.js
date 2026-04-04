import { queryRows, getRowByPrimaryKey } from '../app.js';
import { pool } from '../pool.js';

// ─── Source resolution ────────────────────────────────────────────────────────

function resolveInsightsSource() {
    const env = String(process.env.EMPLOYEES_INSIGHTS_SOURCE || 'auto').toLowerCase().trim();
    if (env === 'supabase') return 'supabase';
    if (env === 'legacy') return 'legacy';
    // auto: prefer Supabase when credentials are present
    return (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'supabase' : 'legacy';
}

function getSupabaseConfig() {
    const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) return null;
    return { url, key };
}

async function supabaseGet(path, config) {
    const resp = await fetch(`${config.url}/rest/v1/${path}`, {
        headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
        },
    });
    if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(`Supabase query failed (${resp.status}): ${msg}`);
    }
    return resp.json();
}

// ─── Access guard ─────────────────────────────────────────────────────────────

async function assertInsightAccess(currentUser, targetEmployeeId) {
    const role = String(currentUser?.role || '').toLowerCase();
    const currentId = String(currentUser?.employee_id || '');
    const targetId = String(targetEmployeeId || '');

    if (!targetId) {
        const err = new Error('employee_id is required.');
        err.status = 400; err.code = 'INVALID_INPUT';
        throw err;
    }

    if (role === 'superadmin' || role === 'hr' || role === 'director') return;

    if (role === 'employee') {
        if (currentId !== targetId) {
            const err = new Error('Employees can only view their own insights.');
            err.status = 403; err.code = 'FORBIDDEN';
            throw err;
        }
        return;
    }

    if (role === 'manager') {
        // Self always allowed
        if (currentId === targetId) return;

        // Direct report check
        let targetEmployee = null;
        try {
            targetEmployee = await getRowByPrimaryKey('employees', targetId);
        } catch {
            // MySQL down — fall back to Supabase
            const config = getSupabaseConfig();
            if (config) {
                const rows = await supabaseGet(
                    `employees?employee_id=eq.${encodeURIComponent(targetId)}&select=employee_id,manager_id&limit=1`,
                    config
                );
                targetEmployee = Array.isArray(rows) ? rows[0] || null : null;
            }
        }

        if (!targetEmployee || String(targetEmployee.manager_id || '') !== currentId) {
            const err = new Error('Managers can only view insights for their direct reports.');
            err.status = 403; err.code = 'FORBIDDEN';
            throw err;
        }
        return;
    }

    const err = new Error('Access denied.');
    err.status = 403; err.code = 'FORBIDDEN';
    throw err;
}

// ─── KPI aggregation ──────────────────────────────────────────────────────────

function parsePeriodKey(value) {
    const raw = String(value || '').trim();
    const m = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!m) return 0;
    return Number(m[1]) * 100 + Number(m[2]);
}

function deriveKpiInsights(rows) {
    if (!rows || rows.length === 0) {
        return { latest_score: null, trend: null, record_count: 0 };
    }

    const sorted = [...rows].sort((a, b) => {
        const pd = parsePeriodKey(b.period) - parsePeriodKey(a.period);
        if (pd !== 0) return pd;
        return String(b.submitted_at || b.created_at || '').localeCompare(
            String(a.submitted_at || a.created_at || ''));
    });

    const latestRow = sorted[0];
    const latestValue = Number(latestRow.value);

    // Use target_snapshot (JSON column) if present, fall back to a raw target_value if schema differs
    let target = null;
    if (latestRow.target_snapshot !== null && latestRow.target_snapshot !== undefined) {
        const snap = typeof latestRow.target_snapshot === 'object'
            ? latestRow.target_snapshot
            : (() => { try { return JSON.parse(latestRow.target_snapshot); } catch { return null; } })();
        if (snap) {
            target = Number(snap.target_value ?? snap.target ?? snap.value ?? null);
        }
    }

    const latestScore = Number.isFinite(latestValue)
        ? (Number.isFinite(target) && target > 0
            ? Math.round((latestValue / target) * 1000) / 10  // percentage
            : Math.round(latestValue * 10) / 10)
        : null;

    // Trend: compare avg of most-recent 3 periods vs prior 3 periods
    // We score each row as value/target if target available, else raw value
    const scored = sorted.map(row => {
        const v = Number(row.value);
        let t = null;
        if (row.target_snapshot !== null && row.target_snapshot !== undefined) {
            const snap = typeof row.target_snapshot === 'object'
                ? row.target_snapshot
                : (() => { try { return JSON.parse(row.target_snapshot); } catch { return null; } })();
            if (snap) t = Number(snap.target_value ?? snap.target ?? snap.value ?? null);
        }
        if (!Number.isFinite(v)) return null;
        if (Number.isFinite(t) && t > 0) return (v / t) * 100;
        return v;
    }).filter(v => v !== null);

    let trend = null;
    if (scored.length >= 2) {
        const recent = scored.slice(0, Math.min(3, scored.length));
        const prior = scored.slice(Math.min(3, scored.length), Math.min(6, scored.length));
        if (prior.length > 0) {
            const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
            const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
            const diff = recentAvg - priorAvg;
            trend = Math.abs(diff) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down';
        }
    }

    return { latest_score: latestScore, trend, record_count: rows.length };
}

async function fetchKpiInsights(source, employeeId) {
    try {
        if (source === 'supabase') {
            const config = getSupabaseConfig();
            if (!config) throw new Error('Supabase not configured.');
            const rows = await supabaseGet(
                `kpi_records?employee_id=eq.${encodeURIComponent(employeeId)}&select=period,value,target_snapshot,submitted_at,created_at`,
                config
            );
            return deriveKpiInsights(Array.isArray(rows) ? rows : []);
        }
        // Legacy
        const rows = await queryRows('kpi_records', {
            filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
        });
        return deriveKpiInsights(rows);
    } catch (err) {
        console.warn('fetchKpiInsights error:', err.message);
        return { latest_score: null, trend: null, record_count: 0 };
    }
}

// ─── Assessment / TNA aggregation ─────────────────────────────────────────────

function deriveTnaInsights(rows) {
    if (!rows || rows.length === 0) {
        return { gap_level: null, last_assessed_at: null, history_count: 0 };
    }

    const gapScores = rows
        .map(r => Number(r.gap_level ?? r.gap_score))
        .filter(v => Number.isFinite(v) && v >= 0);

    let gapLevel = null;
    if (gapScores.length > 0) {
        const avg = gapScores.reduce((s, v) => s + v, 0) / gapScores.length;
        gapLevel = avg >= 2.5 ? 'high' : avg >= 1 ? 'medium' : 'low';
    }

    const dates = rows
        .map(r => String(r.identified_at || r.created_at || '').trim())
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));

    return {
        gap_level: gapLevel,
        last_assessed_at: dates[0] || null,
        history_count: rows.length,
    };
}

async function fetchAssessmentInsights(source, employeeId) {
    try {
        if (source === 'supabase') {
            const config = getSupabaseConfig();
            if (!config) throw new Error('Supabase not configured.');
            const rows = await supabaseGet(
                `training_need_records?employee_id=eq.${encodeURIComponent(employeeId)}&select=gap_level,gap_score,priority,status,identified_at,created_at`,
                config
            );
            return deriveTnaInsights(Array.isArray(rows) ? rows : []);
        }
        // Legacy
        const rows = await queryRows('training_need_records', {
            filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
        });
        return deriveTnaInsights(rows);
    } catch (err) {
        console.warn('fetchAssessmentInsights error:', err.message);
        return { gap_level: null, last_assessed_at: null, history_count: 0 };
    }
}

// ─── LMS aggregation ──────────────────────────────────────────────────────────

function deriveLmsInsights(rows) {
    const total = rows.length;
    const completed = rows.filter(r =>
        String(r.status || '').toLowerCase() === 'completed'
    ).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { enrolled_count: total, completed_count: completed, completion_pct: completionPct };
}

async function fetchLmsInsights(source, employeeId) {
    try {
        if (source === 'supabase') {
            const config = getSupabaseConfig();
            if (!config) throw new Error('Supabase not configured.');
            const rows = await supabaseGet(
                `course_enrollments?employee_id=eq.${encodeURIComponent(employeeId)}&select=status`,
                config
            );
            return deriveLmsInsights(Array.isArray(rows) ? rows : []);
        }
        // Legacy
        const rows = await queryRows('course_enrollments', {
            filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
        });
        return deriveLmsInsights(rows);
    } catch (err) {
        console.warn('fetchLmsInsights error:', err.message);
        return { enrolled_count: 0, completed_count: 0, completion_pct: 0 };
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleEmployeesAction(req, res, action) {
    if (!req.currentUser) {
        const err = new Error('Authentication required.');
        err.status = 401; err.code = 'AUTH_REQUIRED';
        throw err;
    }

    if (action === 'employees/insights') {
        const employeeId = String(
            req.body?.employee_id || req.query?.employee_id || ''
        ).trim();

        await assertInsightAccess(req.currentUser, employeeId);

        const source = resolveInsightsSource();

        const [kpi, assessment, lms] = await Promise.all([
            fetchKpiInsights(source, employeeId),
            fetchAssessmentInsights(source, employeeId),
            fetchLmsInsights(source, employeeId),
        ]);

        return res.json({
            success: true,
            source,
            insights: { kpi, assessment, lms },
        });
    }

    const err = new Error(`Unknown employees action: ${action}`);
    err.status = 404; err.code = 'NOT_FOUND';
    throw err;
}

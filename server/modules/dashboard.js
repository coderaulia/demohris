// server/modules/dashboard.js — Dashboard Analytics Module
// Supabase-only: no mysql2/pool/db/query
import { supabaseTableRequest } from '../compat/supabaseAdmin.js';

// ==================================================
// HELPERS
// ==================================================

function requireAuth(req) {
    if (!req.currentUser) {
        const err = new Error('Authentication required.');
        err.status = 401; err.code = 'AUTH_REQUIRED';
        throw err;
    }
    return req.currentUser;
}

function requireRole(req, roles = []) {
    const user = requireAuth(req);
    if (!roles.includes(String(user.role || '').toLowerCase())) {
        const err = new Error('Access denied.');
        err.status = 403; err.code = 'FORBIDDEN';
        throw err;
    }
    return user;
}

function isAdmin(user) {
    return ['superadmin', 'hr'].includes(String(user.role || '').toLowerCase());
}

function isManager(user) {
    return String(user.role || '').toLowerCase() === 'manager';
}

function getInput(req, key, defaultValue = '') {
    const bv = req.body?.[key];
    if (bv !== undefined && bv !== null && bv !== '') return bv;
    const qv = req.query?.[key];
    if (qv !== undefined && qv !== null && qv !== '') return qv;
    return defaultValue;
}

function getQuarterRange(date = new Date()) {
    const q = Math.floor(date.getMonth() / 3);
    const startMonth = q * 3;
    const endMonth = startMonth + 3;
    const startDate = new Date(date.getFullYear(), startMonth, 1);
    const endDate = new Date(date.getFullYear(), endMonth, 1);
    return {
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
    };
}

function getCurrentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabels(months = 6) {
    const labels = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        labels.push({
            month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
            period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        });
    }
    return labels;
}

// ==================================================
// STEP 2: dashboard/summary
// ==================================================

async function dashboardSummary(req, res) {
    const user = requireAuth(req);
    const role = String(user.role || '').toLowerCase();
    const department = String(getInput(req, 'department', '')).trim();
    const period = String(getInput(req, 'period', getCurrentPeriod())).trim();

    // Get employees
    const empFilters = { status: { type: 'eq', value: 'active' } };
    if (department) {
        empFilters.department = { type: 'eq', value: department };
    }

    const employees = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,department',
        filters: empFilters,
        limit: 5000,
    });

    const empIds = employees.map(e => e.employee_id);

    // Get KPI definitions count
    const definitions = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'id',
        filters: { status: { type: 'eq', value: 'approved' } },
        limit: 5000,
    });

    // Get KPI records for period
    let records = [];
    if (empIds.length > 0 && period) {
        const recordFilters = { period: { type: 'eq', value: period } };
        if (empIds.length <= 100) {
            recordFilters.employee_id = { type: 'in', value: empIds };
        }

        records = await supabaseTableRequest({
            table: 'kpi_records',
            method: 'GET',
            select: 'employee_id,achievement_pct',
            filters: recordFilters,
            limit: 5000,
        });

        // If we have >100 employees, filter client-side
        if (empIds.length > 100) {
            const empIdSet = new Set(empIds);
            records = records.filter(r => empIdSet.has(r.employee_id));
        }
    }

    // Calculate stats
    const employeesWithRecords = new Set(records.map(r => r.employee_id)).size;
    const achievements = records
        .map(r => Number(r.achievement_pct))
        .filter(a => Number.isFinite(a) && a !== null);
    const avgAchievement = achievements.length > 0
        ? Math.round((achievements.reduce((a, b) => a + b, 0) / achievements.length) * 10) / 10
        : null;
    const metTarget = achievements.filter(a => a >= 100).length;

    return res.json({
        success: true,
        total_employees_with_kpi: employeesWithRecords,
        total_kpi_definitions: definitions.length,
        total_records: records.length,
        records_period: `${period}: ${records.length} records`,
        avg_achievement_pct: avgAchievement,
        met_target_count: metTarget,
    });
}

// ==================================================
// STEP 3: dashboard/achievement-by-category
// ==================================================

async function achievementByCategory(req, res) {
    const user = requireAuth(req);
    const department = String(getInput(req, 'department', '')).trim();
    const period = String(getInput(req, 'period', getCurrentPeriod())).trim();

    // Get KPI definitions
    const definitions = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'id,name,applies_to_position',
        filters: { status: { type: 'eq', value: 'approved' } },
        limit: 5000,
    });

    // Get KPI records for period
    const records = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: 'kpi_id,achievement_pct',
        filters: period ? { period: { type: 'eq', value: period } } : {},
        limit: 5000,
    });

    // Group by category (applies_to_position)
    const categories = new Map();
    for (const def of definitions) {
        const cat = String(def.applies_to_position || 'General').trim();
        if (!categories.has(cat)) {
            categories.set(cat, {
                category: cat,
                achievements: [],
                employee_ids: new Set(),
            });
        }
    }

    const defMap = new Map(definitions.map(d => [d.id, d]));
    for (const rec of records) {
        const def = defMap.get(rec.kpi_id);
        if (!def) continue;
        const cat = String(def.applies_to_position || 'General').trim();
        if (!categories.has(cat)) {
            categories.set(cat, {
                category: cat,
                achievements: [],
                employee_ids: new Set(),
            });
        }
        const bucket = categories.get(cat);
        if (rec.achievement_pct !== null) {
            bucket.achievements.push(Number(rec.achievement_pct));
        }
    }

    const result = [];
    for (const [cat, data] of categories) {
        const avg = data.achievements.length > 0
            ? Math.round((data.achievements.reduce((a, b) => a + b, 0) / data.achievements.length) * 10) / 10
            : 0;
        result.push({
            category: cat,
            avg_achievement: avg,
            record_count: data.achievements.length,
        });
    }

    result.sort((a, b) => b.avg_achievement - a.avg_achievement);

    return res.json({ success: true, categories: result });
}

// ==================================================
// STEP 4: dashboard/top-performers
// ==================================================

async function topPerformers(req, res) {
    const user = requireAuth(req);
    const scope = String(getInput(req, 'scope', 'monthly')).trim();
    const department = String(getInput(req, 'department', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();

    let filterPeriod = period;
    if (!filterPeriod) {
        if (scope === 'quarterly') {
            const q = getQuarterRange();
            filterPeriod = q.start.slice(0, 7);
        } else {
            filterPeriod = getCurrentPeriod();
        }
    }

    // Get employees
    const empFilters = {};
    if (department) {
        empFilters.department = { type: 'eq', value: department };
    }
    const employees = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,name,position,department',
        filters: empFilters,
        limit: 5000,
    });

    const empMap = new Map(employees.map(e => [e.employee_id, e]));

    // Get KPI records
    const recordFilters = { period: { type: 'eq', value: filterPeriod } };
    const records = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: 'employee_id,achievement_pct',
        filters: recordFilters,
        limit: 5000,
    });

    // Group by employee
    const empScores = new Map();
    for (const rec of records) {
        if (rec.achievement_pct === null) continue;
        const eid = rec.employee_id;
        if (!empScores.has(eid)) {
            empScores.set(eid, []);
        }
        empScores.get(eid).push(Number(rec.achievement_pct));
    }

    // Build performers list
    const performers = [];
    for (const [eid, scores] of empScores) {
        const emp = empMap.get(eid);
        if (!emp) continue;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        performers.push({
            employee_id: eid,
            name: emp.name,
            position: emp.position,
            department: emp.department,
            avg_achievement: Math.round(avg * 10) / 10,
            kpi_count: scores.length,
        });
    }

    performers.sort((a, b) => b.avg_achievement - a.avg_achievement);

    return res.json({
        success: true,
        scope,
        period: filterPeriod,
        top_performers: performers.slice(0, 3),
    });
}

// ==================================================
// STEP 5: dashboard/leadership-analytics
// ==================================================

async function leadershipAnalytics(req, res) {
    const user = requireAuth(req);

    // Get probation reviews (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let probationReviews = [];
    try {
        probationReviews = await supabaseTableRequest({
            table: 'probation_reviews',
            method: 'GET',
            select: 'id,decision',
            filters: { review_date: { type: 'gte', value: twelveMonthsAgo.toISOString().slice(0, 10) } },
            limit: 5000,
        });
    } catch {
        probationReviews = [];
    }

    const closedReviews = probationReviews.filter(r => r.decision);
    const passCount = closedReviews.filter(r => r.decision === 'pass').length;
    const probationPassRate = closedReviews.length > 0
        ? Math.round((passCount / closedReviews.length) * 1000) / 10
        : 0;

    // Get PIP records
    let pipRecords = [];
    try {
        pipRecords = await supabaseTableRequest({
            table: 'pip_records',
            method: 'GET',
            select: 'id,employee_id,status,outcome',
            filters: {},
            limit: 5000,
        });
    } catch {
        pipRecords = [];
    }

    const activePips = pipRecords.filter(p => p.status === 'active');
    const resolvedPips = pipRecords.filter(p => p.status === 'resolved');
    const successfulPips = resolvedPips.filter(p => p.outcome === 'success');
    const pipSuccessRate = resolvedPips.length > 0
        ? Math.round((successfulPips.length / resolvedPips.length) * 1000) / 10
        : 0;

    // Get employees below threshold
    const currentPeriod = getCurrentPeriod();
    const lowRecords = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: 'employee_id,achievement_pct',
        filters: { period: { type: 'eq', value: currentPeriod } },
        limit: 5000,
    });

    const empScores = new Map();
    for (const rec of lowRecords) {
        if (rec.achievement_pct === null) continue;
        if (!empScores.has(rec.employee_id)) {
            empScores.set(rec.employee_id, []);
        }
        empScores.get(rec.employee_id).push(Number(rec.achievement_pct));
    }

    const belowThreshold = [];
    for (const [eid, scores] of empScores) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg < 70) {
            belowThreshold.push({ employee_id: eid, avg });
        }
    }

    const pipEmployeeIds = new Set(activePips.map(p => p.employee_id));
    const pipCovered = belowThreshold.filter(e => pipEmployeeIds.has(e.employee_id)).length;
    const pipConversionRate = belowThreshold.length > 0
        ? Math.round((pipCovered / belowThreshold.length) * 1000) / 10
        : 0;

    // Build risk watchlist
    const riskEmployees = belowThreshold.map(e => ({
        employee_id: e.employee_id,
        avg_score: e.avg,
        has_active_pip: pipEmployeeIds.has(e.employee_id),
    }));

    // Get employee details for risk watchlist
    const empIds = riskEmployees.map(r => r.employee_id);
    let empDetails = [];
    if (empIds.length > 0) {
        const idsForFilter = empIds.slice(0, 100);
        empDetails = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id,name,position,department',
            filters: { employee_id: { type: 'in', value: idsForFilter } },
            limit: 500,
        });
    }

    const empDetailMap = new Map(empDetails.map(e => [e.employee_id, e]));

    const riskWatchlist = riskEmployees.map(r => {
        const emp = empDetailMap.get(r.employee_id);
        return {
            employee_id: r.employee_id,
            name: emp?.name || 'Unknown',
            position: emp?.position || '',
            department: emp?.department || '',
            avg_score: Math.round(r.avg_score * 10) / 10,
            has_active_pip: r.has_active_pip,
            risk_level: r.has_active_pip ? 'high' : (r.avg_score < 50 ? 'high' : 'medium'),
        };
    });

    riskWatchlist.sort((a, b) => a.avg_score - b.avg_score);

    return res.json({
        success: true,
        probation_pass_rate: probationPassRate,
        probation_pass_count: passCount,
        probation_total_closed: closedReviews.length,
        pip_conversion_rate: pipConversionRate,
        pip_active_count: activePips.length,
        pip_total_eligible: belowThreshold.length,
        pip_success_rate: pipSuccessRate,
        risk_watchlist: riskWatchlist,
    });
}

// ==================================================
// STEP 6: dashboard/kpi-trend
// ==================================================

async function kpiTrend(req, res) {
    const user = requireAuth(req);
    const department = String(getInput(req, 'department', '')).trim();
    const months = Math.min(Number(getInput(req, 'months', '6')) || 6, 12);

    const monthLabels = getMonthLabels(months);
    const periods = monthLabels.map(m => m.period);

    // Get employees if department filter
    let empIds = null;
    if (department) {
        const employees = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id',
            filters: { department: { type: 'eq', value: department } },
            limit: 5000,
        });
        empIds = new Set(employees.map(e => e.employee_id));
    }

    // Get all KPI records for the period range
    const firstPeriod = periods[0];
    const lastPeriod = periods[periods.length - 1];

    const allRecords = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: 'employee_id,period,achievement_pct',
        filters: { period: { type: 'gte', value: firstPeriod } },
        limit: 10000,
    });

    const filteredRecords = allRecords.filter(r => {
        const p = r.period;
        return p >= firstPeriod && p <= lastPeriod && (!empIds || empIds.has(r.employee_id));
    });

    // Group by period
    const periodData = new Map();
    for (const period of periods) {
        periodData.set(period, { achievements: [], employees: new Set() });
    }

    for (const rec of filteredRecords) {
        if (!periodData.has(rec.period)) continue;
        const bucket = periodData.get(rec.period);
        bucket.employees.add(rec.employee_id);
        if (rec.achievement_pct !== null) {
            bucket.achievements.push(Number(rec.achievement_pct));
        }
    }

    const trend = monthLabels.map(label => {
        const data = periodData.get(label.period);
        const avgScore = data.achievements.length > 0
            ? Math.round((data.achievements.reduce((a, b) => a + b, 0) / data.achievements.length) * 10) / 10
            : 0;
        const atRisk = data.achievements.filter(a => a < 70).length;

        return {
            month: label.month,
            period: label.period,
            avg_kpi_score: avgScore,
            at_risk_employee_count: atRisk,
        };
    });

    return res.json({ success: true, trend });
}

// ==================================================
// STEP 7: dashboard/manager-calibration
// ==================================================

async function managerCalibration(req, res) {
    const user = requireRole(req, ['superadmin', 'hr']);
    const period = String(getInput(req, 'period', getCurrentPeriod())).trim();

    // Get all managers
    const managers = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,name,position,department',
        filters: { role: { type: 'eq', value: 'manager' } },
        limit: 100,
    });

    // Get all employees with manager_id
    const allEmployees = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,manager_id',
        filters: { status: { type: 'eq', value: 'active' } },
        limit: 5000,
    });

    const teamByManager = new Map();
    for (const emp of allEmployees) {
        if (!emp.manager_id) continue;
        if (!teamByManager.has(emp.manager_id)) {
            teamByManager.set(emp.manager_id, []);
        }
        teamByManager.get(emp.manager_id).push(emp.employee_id);
    }

    // Get all KPI records for period
    const kpiRecords = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: 'employee_id,achievement_pct',
        filters: { period: { type: 'eq', value: period } },
        limit: 10000,
    });

    const kpiByEmployee = new Map();
    for (const rec of kpiRecords) {
        if (rec.achievement_pct === null) continue;
        if (!kpiByEmployee.has(rec.employee_id)) {
            kpiByEmployee.set(rec.employee_id, []);
        }
        kpiByEmployee.get(rec.employee_id).push(Number(rec.achievement_pct));
    }

    // Get probation pass counts
    let probationRecords = [];
    try {
        probationRecords = await supabaseTableRequest({
            table: 'probation_reviews',
            method: 'GET',
            select: 'employee_id,decision',
            filters: {},
            limit: 5000,
        });
    } catch { /* table may not exist yet */ }

    const probationByEmployee = new Map();
    for (const rec of probationRecords) {
        probationByEmployee.set(rec.employee_id, rec.decision);
    }

    // Get PIP records
    let pipRecords = [];
    try {
        pipRecords = await supabaseTableRequest({
            table: 'pip_records',
            method: 'GET',
            select: 'employee_id,status',
            filters: {},
            limit: 5000,
        });
    } catch { /* table may not exist yet */ }

    const activePipByEmployee = new Set(
        pipRecords.filter(p => p.status === 'active').map(p => p.employee_id)
    );

    // Build manager calibration
    const calibration = managers.map(mgr => {
        const team = teamByManager.get(mgr.employee_id) || [];

        const teamKpiScores = [];
        let probationPassCount = 0;
        let activePipCount = 0;
        let riskCount = 0;

        for (const eid of team) {
            const scores = kpiByEmployee.get(eid) || [];
            if (scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                teamKpiScores.push(avg);
                if (avg < 70) riskCount++;
            }

            if (probationByEmployee.get(eid) === 'pass') probationPassCount++;
            if (activePipByEmployee.has(eid)) activePipCount++;
        }

        const teamKpiAvg = teamKpiScores.length > 0
            ? Math.round((teamKpiScores.reduce((a, b) => a + b, 0) / teamKpiScores.length) * 10) / 10
            : null;

        return {
            manager_id: mgr.employee_id,
            manager_name: mgr.name,
            manager_employee_id: mgr.employee_id,
            team_size: team.length,
            kpi_avg: teamKpiAvg,
            assessment_avg: null, // Assessment averages require more complex joins
            probation_pass_count: probationPassCount,
            active_pip_count: activePipCount,
            risk_count: riskCount,
        };
    });

    calibration.sort((a, b) => (b.kpi_avg ?? 0) - (a.kpi_avg ?? 0));

    return res.json({ success: true, calibration, period });
}

// ==================================================
// ROUTER
// ==================================================

export async function handleDashboardAction(req, res, action) {
    requireAuth(req);

    if (action === 'dashboard/summary') return dashboardSummary(req, res);
    if (action === 'dashboard/achievement-by-category') return achievementByCategory(req, res);
    if (action === 'dashboard/top-performers') return topPerformers(req, res);
    if (action === 'dashboard/leadership-analytics') return leadershipAnalytics(req, res);
    if (action === 'dashboard/kpi-trend') return kpiTrend(req, res);
    if (action === 'dashboard/manager-calibration') return managerCalibration(req, res);

    const err = new Error(`Unknown Dashboard action: ${action}`);
    err.status = 404; err.code = 'NOT_FOUND';
    throw err;
}

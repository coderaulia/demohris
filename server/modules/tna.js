import crypto from 'node:crypto';
import { queryRows, getRowByPrimaryKey } from '../app.js';
import { pool } from '../pool.js';
import { isFeatureEnabled } from '../features.js';
import {
    fetchTnaGapsReportFromSupabase,
    fetchTnaLmsReportFromSupabase,
    fetchTnaSummaryFromSupabase,
    resolveTnaReadSource,
} from '../compat/supabaseTnaRead.js';
import {
    createTrainingPlanInSupabase,
    enrollInTrainingInSupabase,
    resolveTnaMutationSource,
} from '../compat/supabaseTnaMutation.js';
import { supabaseTableRequest } from '../compat/supabaseAdmin.js';

export function isTnaEnabled() {
    return isFeatureEnabled('TNA');
}

function requireTna(req) {
    if (!isTnaEnabled()) {
        throw { status: 404, message: 'TNA module is not enabled', code: 'MODULE_DISABLED' };
    }
}

function requireAuth(req) {
    if (!req.currentUser) {
        throw { status: 401, message: 'Authentication required', code: 'AUTH_REQUIRED' };
    }
    return req.currentUser;
}

function requireRole(req, roles = []) {
    const user = requireAuth(req);
    if (!roles.includes(user.role)) {
        throw { status: 403, message: 'Access denied', code: 'FORBIDDEN' };
    }
    return user;
}

function getInput(req, key, defaultValue = '') {
    const bodyValue = req.body?.[key];
    if (bodyValue !== undefined && bodyValue !== null && bodyValue !== '') {
        return bodyValue;
    }
    const queryValue = req.query?.[key];
    if (queryValue !== undefined && queryValue !== null && queryValue !== '') {
        return queryValue;
    }
    return defaultValue;
}

function generateUuid() {
    return crypto.randomUUID();
}

async function getEmployeesByPosition(positionName) {
    const { rows } = await pool.query(
        'SELECT employee_id FROM employees WHERE position = ?',
        [positionName]
    );
    return rows.map(r => r.employee_id);
}

async function getCompetencyConfig(positionName) {
    const rows = await queryRows('competency_config', {
        filters: [{ op: 'eq', column: 'position_name', value: positionName }],
        limit: 1,
    });
    return rows[0] || null;
}

async function getTrainingNeedsConfig(positionName) {
    const rows = await queryRows('training_needs', {
        filters: [{ op: 'eq', column: 'position_name', value: positionName }],
    });
    const needsMap = {};
    (rows || []).forEach(row => {
        needsMap[row.competency_name] = row;
    });
    return needsMap;
}

function normalizeScoreToScale(score, fromScale = 10, toScale = 5) {
    return (score / fromScale) * toScale;
}

function calculateGap(currentScore, requiredLevel) {
    const normalizedCurrent = normalizeScoreToScale(currentScore, 10, 5);
    return requiredLevel - normalizedCurrent;
}

export async function handleTnaAction(req, res, action) {
    requireAuth(req);

    if (action === 'tna/calculate-gaps') {
        requireTna(req);
        const employeeId = String(req.body?.employee_id || '').trim();
        if (!employeeId) {
            throw { status: 400, message: 'Employee ID is required', code: 'INVALID_INPUT' };
        }

        const employeeRows = await queryRows('employees', {
            filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
            limit: 1,
        });
        const employee = employeeRows[0];
        if (!employee) {
            throw { status: 404, message: 'Employee not found', code: 'NOT_FOUND' };
        }

        const config = await getCompetencyConfig(employee.position);
        if (!config || !config.competencies) {
            return res.json({ data: { gaps: [], competency_config: null, message: 'No competency config found for position' } });
        }

        let competencies = config.competencies;
        if (typeof competencies === 'string') {
            try { competencies = JSON.parse(competencies); } catch { competencies = []; }
        }

        const trainingNeeds = await getTrainingNeedsConfig(employee.position);

        const assessmentRows = await queryRows('employee_assessments', {
            filters: [
                { op: 'eq', column: 'employee_id', value: employeeId },
                { op: 'eq', column: 'assessment_type', value: 'manager' },
            ],
            orderBy: 'created_at',
            ascending: false,
            limit: 1,
        });
        const assessment = assessmentRows[0];

        const scoreRows = await queryRows('employee_assessment_scores', {
            filters: assessment ? [{ op: 'eq', column: 'assessment_id', value: assessment.id }] : [],
        });

        const scoreMap = {};
        (scoreRows || []).forEach(s => {
            scoreMap[s.competency_name] = s.score || 0;
        });

        const gaps = [];
        const threshold = req.body?.threshold || 7;
        const defaultRequiredLevel = 3;

        for (const comp of competencies) {
            const compName = comp.name;
            if (!compName) continue;

            const currentScore = scoreMap[compName] || 0;

            let requiredLevel = defaultRequiredLevel;
            if (trainingNeeds[compName]?.required_level) {
                requiredLevel = trainingNeeds[compName].required_level;
            }

            const rawGap = calculateGap(currentScore, requiredLevel);
            const gap = Math.max(0, rawGap);

            if (currentScore < threshold || gap > 0) {
                let priority = 'medium';
                if (gap >= 2) priority = 'critical';
                else if (gap >= 1.5) priority = 'high';
                else if (gap >= 0.5) priority = 'low';

                gaps.push({
                    competency_name: compName,
                    description: comp.desc || '',
                    current_score: currentScore,
                    current_level_normalized: normalizeScoreToScale(currentScore),
                    required_level: requiredLevel,
                    gap: Math.round(gap * 10) / 10,
                    recommended_training: comp.rec || trainingNeeds[compName]?.recommended_training || '',
                    priority: priority,
                    score_below_threshold: currentScore < threshold,
                    has_training_need_config: Boolean(trainingNeeds[compName]),
                });
            }
        }

        gaps.sort((a, b) => b.gap - a.gap || b.priority.localeCompare(a.priority));

        return res.json({
            data: {
                employee_id: employeeId,
                employee_name: employee.name,
                position: employee.position,
                assessment_id: assessment?.id || null,
                assessment_date: assessment?.created_at || null,
                gaps,
                competency_config: competencies,
                training_needs_config: trainingNeeds,
            },
        });
    }

    if (action === 'tna/needs') {
        requireTna(req);
        const employeeId = String(getInput(req, 'employee_id', '')).trim();
        const status = String(getInput(req, 'status', '')).trim();

        let filters = [];
        if (employeeId) {
            filters.push({ op: 'eq', column: 'employee_id', value: employeeId });
        }
        if (status) {
            filters.push({ op: 'eq', column: 'status', value: status });
        }

        const rows = await queryRows('training_need_records', { filters });
        return res.json({ data: rows });
    }

    if (action === 'tna/needs/create') {
        requireTna(req);
        const actor = requireRole(req, ['superadmin', 'manager', 'hr']);
        const employeeId = String(req.body?.employee_id || '').trim();
        const competencyName = String(req.body?.competency_name || '').trim();
        const requiredLevel = Number(req.body?.required_level ?? null);
        const currentLevel = Number(req.body?.current_level ?? null);
        const priority = String(req.body?.priority || 'medium').trim().toLowerCase();
        const notes = String(req.body?.notes || '').trim() || null;

        if (!employeeId || !competencyName) {
            throw { status: 400, message: 'employee_id and competency_name are required', code: 'INVALID_INPUT' };
        }
        if (!Number.isFinite(requiredLevel) || !Number.isFinite(currentLevel)) {
            throw { status: 400, message: 'required_level and current_level must be numeric', code: 'INVALID_INPUT' };
        }

        const employeeRows = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id,position,manager_id',
            filters: {
                employee_id: { type: 'eq', value: employeeId },
            },
            limit: 1,
        });
        const employee = employeeRows[0] || null;
        if (!employee) {
            throw { status: 404, message: 'Employee not found', code: 'NOT_FOUND' };
        }
        if (String(actor.role || '').toLowerCase() === 'manager' && String(employee.manager_id || '') !== String(actor.employee_id || '')) {
            throw { status: 403, message: 'Managers can only create needs for their own team', code: 'FORBIDDEN' };
        }

        const needRows = await supabaseTableRequest({
            table: 'training_needs',
            method: 'GET',
            select: '*',
            filters: {
                position_name: { type: 'eq', value: String(employee.position || '') },
                competency_name: { type: 'eq', value: competencyName },
            },
            limit: 1,
        });

        let need = needRows[0] || null;
        if (!need) {
            const createdNeeds = await supabaseTableRequest({
                table: 'training_needs',
                method: 'POST',
                body: [{
                    id: generateUuid(),
                    position_name: String(employee.position || ''),
                    competency_name: competencyName,
                    required_level: requiredLevel,
                }],
                prefer: 'return=representation',
            });
            need = createdNeeds[0] || null;
        } else if (Number(need.required_level) !== requiredLevel) {
            const updatedNeeds = await supabaseTableRequest({
                table: 'training_needs',
                method: 'PATCH',
                filters: {
                    id: { type: 'eq', value: need.id },
                },
                body: {
                    required_level: requiredLevel,
                },
                prefer: 'return=representation',
            });
            need = updatedNeeds[0] || need;
        }

        const gapLevel = requiredLevel - currentLevel;
        const now = new Date().toISOString();
        const createdRows = await supabaseTableRequest({
            table: 'training_need_records',
            method: 'POST',
            body: [{
                id: generateUuid(),
                employee_id: employeeId,
                training_need_id: need.id,
                current_level: currentLevel,
                gap_level: gapLevel,
                priority,
                status: 'identified',
                identified_by: actor.employee_id,
                identified_at: now,
                notes,
                competency: competencyName,
            }],
            prefer: 'return=representation',
        });

        return res.json({
            success: true,
            need: {
                ...(createdRows[0] || null),
                competency_name: competencyName,
                required_level: requiredLevel,
            },
        });
    }

    if (action === 'tna/needs/update-status') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const id = String(req.body?.id || '').trim();
        const status = String(req.body?.status || '').trim();

        if (!id || !status) {
            throw { status: 400, message: 'ID and status are required', code: 'INVALID_INPUT' };
        }

        const validStatuses = ['identified', 'planned', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw { status: 400, message: 'Invalid status', code: 'INVALID_STATUS' };
        }

        const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

        await pool.query(
            'UPDATE training_need_records SET status = ?, completed_at = ? WHERE id = ?',
            [status, completedAt, id]
        );

        const updated = await queryRows('training_need_records', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: updated[0] });
    }

    if (action === 'tna/plans') {
        requireTna(req);
        const employeeId = String(getInput(req, 'employee_id', '')).trim();
        const status = String(getInput(req, 'status', '')).trim();

        let filters = [];
        if (employeeId) {
            filters.push({ op: 'eq', column: 'employee_id', value: employeeId });
        }
        if (status) {
            filters.push({ op: 'eq', column: 'status', value: status });
        }

        const rows = await queryRows('training_plans', { filters, orders: [{ column: 'created_at', ascending: false }] });
        return res.json({ data: rows });
    }

    if (action === 'tna/plan/create') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const employeeId = String(req.body?.employee_id || '').trim();
        const planName = String(req.body?.plan_name || '').trim();
        const period = String(req.body?.period || '').trim();
        const items = req.body?.items || [];

        if (!employeeId || !planName || !period) {
            throw { status: 400, message: 'Employee ID, plan name, and period are required', code: 'INVALID_INPUT' };
        }

        const mutationState = resolveTnaMutationSource();

        if (mutationState.source === 'supabase') {
            const result = await createTrainingPlanInSupabase({
                employeeId,
                planName,
                period,
                items,
                actorUser: req.currentUser,
                idFactory: generateUuid,
            });

            if (result.error) {
                throw { status: result.error.status, message: result.error.message, code: 'PLAN_CREATE_ERROR' };
            }

            return res.json({ data: result.plan });
        }

        // Legacy path
        const id = generateUuid();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            `INSERT INTO training_plans 
             (id, employee_id, plan_name, period, status, created_by, created_at)
             VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
            [id, employeeId, planName, period, req.currentUser.employee_id, now]
        );

        const saved = await queryRows('training_plans', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: saved[0] });
    }

    if (action === 'tna/plan/get') {
        requireTna(req);

        const planId = String(getInput(req, 'id', '')).trim();
        if (!planId) {
            throw { status: 400, message: 'Plan ID is required', code: 'INVALID_INPUT' };
        }

        const planRows = await queryRows('training_plans', {
            filters: [{ op: 'eq', column: 'id', value: planId }],
            limit: 1,
        });

        if (!planRows[0]) {
            throw { status: 404, message: 'Plan not found', code: 'NOT_FOUND' };
        }

        const plan = planRows[0];

        const items = await queryRows('training_plan_items', {
            filters: [{ op: 'eq', column: 'plan_id', value: planId }],
            orders: [{ column: 'created_at', ascending: true }],
        });

        return res.json({ data: { ...plan, items } });
    }

    if (action === 'tna/plan/add-item') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const planId = String(req.body?.plan_id || '').trim();
        const courseId = String(req.body?.course_id || '').trim();
        const trainingCourse = String(req.body?.training_course || '').trim();
        const provider = String(req.body?.training_provider || '').trim();
        const startDate = req.body?.start_date || null;
        const endDate = req.body?.end_date || null;
        const cost = Number(req.body?.cost || 0);
        const needRecordId = req.body?.training_need_record_id || null;

        if (!planId || !trainingCourse) {
            throw { status: 400, message: 'Plan ID and training course are required', code: 'INVALID_INPUT' };
        }

        const id = generateUuid();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            `INSERT INTO training_plan_items 
             (id, plan_id, training_need_record_id, training_course, training_provider, start_date, end_date, cost, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
            [id, planId, needRecordId, trainingCourse, provider || null, startDate, endDate, cost, now]
        );

        await updatePlanTotalCost(planId);

        const saved = await queryRows('training_plan_items', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: saved[0] });
    }

    if (action === 'tna/plan/update-item') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const id = String(req.body?.id || '').trim();
        const status = String(req.body?.status || '').trim();
        const completionEvidence = String(req.body?.completion_evidence || '').trim();
        const completionDate = req.body?.completion_date || null;

        if (!id) {
            throw { status: 400, message: 'Item ID is required', code: 'INVALID_INPUT' };
        }

        const updates = [];
        const values = [];

        if (status) {
            updates.push('status = ?');
            values.push(status);
            if (status === 'completed' && completionDate) {
                updates.push('completion_date = ?');
                values.push(completionDate);
            }
        }
        if (completionEvidence) {
            updates.push('completion_evidence = ?');
            values.push(completionEvidence);
        }

        if (updates.length === 0) {
            throw { status: 400, message: 'No updates provided', code: 'INVALID_INPUT' };
        }

        values.push(id);
        await pool.query(`UPDATE training_plan_items SET ${updates.join(', ')} WHERE id = ?`, values);

        const itemRows = await queryRows('training_plan_items', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        if (itemRows[0]) {
            await updatePlanTotalCost(itemRows[0].plan_id);
        }

        return res.json({ data: itemRows[0] });
    }

    if (action === 'tna/plan/approve') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const planId = String(req.body?.id || '').trim();
        if (!planId) {
            throw { status: 400, message: 'Plan ID is required', code: 'INVALID_INPUT' };
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            'UPDATE training_plans SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?',
            ['approved', req.currentUser.employee_id, now, planId]
        );

        const updated = await queryRows('training_plans', {
            filters: [{ op: 'eq', column: 'id', value: planId }],
            limit: 1,
        });

        return res.json({ data: updated[0] });
    }

    if (action === 'tna/plan/delete') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const planId = String(req.body?.id || '').trim();
        if (!planId) {
            throw { status: 400, message: 'Plan ID is required', code: 'INVALID_INPUT' };
        }

        await pool.query('DELETE FROM training_plans WHERE id = ?', [planId]);
        return res.json({ data: { deleted: true } });
    }

    if (action === 'tna/needs-config') {
        requireTna(req);
        const positionName = String(getInput(req, 'position', '')).trim();

        let filters = [];
        if (positionName) {
            filters.push({ op: 'eq', column: 'position_name', value: positionName });
        }

        const rows = await queryRows('training_needs', { filters });
        return res.json({ data: rows });
    }

    if (action === 'tna/needs-config/create') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const positionName = String(req.body?.position_name || '').trim();
        const competencyName = String(req.body?.competency_name || '').trim();
        const requiredLevel = Number(req.body?.required_level || 3);

        if (!positionName || !competencyName) {
            throw { status: 400, message: 'Position name and competency name are required', code: 'INVALID_INPUT' };
        }

        const id = generateUuid();

        await pool.query(
            `INSERT INTO training_needs (id, position_name, competency_name, required_level)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE required_level = VALUES(required_level)`,
            [id, positionName, competencyName, requiredLevel]
        );

        const saved = await queryRows('training_needs', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: saved[0] });
    }

    if (action === 'tna/courses') {
        requireTna(req);
        const activeFlag = String(getInput(req, 'active', 'true')).toLowerCase();
        const isActive = activeFlag !== 'false';

        const rows = await queryRows('training_courses', {
            filters: isActive ? [{ op: 'eq', column: 'is_active', value: 1 }] : [],
            orders: [{ column: 'course_name', ascending: true }],
        });
        return res.json({ data: rows });
    }

    if (action === 'tna/enrollments') {
        requireTna(req);
        const employeeId = String(getInput(req, 'employee_id', '')).trim();
        const status = String(getInput(req, 'status', '')).trim();

        let filters = [];
        if (employeeId) {
            filters.push({ op: 'eq', column: 'employee_id', value: employeeId });
        }
        if (status) {
            filters.push({ op: 'eq', column: 'status', value: status });
        }

        const rows = await queryRows('training_enrollments', {
            filters,
            orders: [{ column: 'enrollment_date', ascending: false }],
        });
        return res.json({ data: rows });
    }

    if (action === 'tna/enroll') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const employeeId = String(req.body?.employee_id || '').trim();
        const courseId = String(req.body?.course_id || '').trim();

        if (!employeeId || !courseId) {
            throw { status: 400, message: 'Employee ID and Course ID are required', code: 'INVALID_INPUT' };
        }

        const mutationState = resolveTnaMutationSource();

        if (mutationState.source === 'supabase') {
            const result = await enrollInTrainingInSupabase({
                employeeId,
                courseId,
                actorUser: req.currentUser,
                idFactory: generateUuid,
            });

            if (result.error) {
                throw { status: result.error.status, message: result.error.message, code: 'ENROLL_ERROR' };
            }

            return res.json({ data: result.enrollment });
        }

        // Legacy path
        const id = generateUuid();
        const now = new Date().toISOString().slice(0, 10);

        await pool.query(
            `INSERT INTO training_enrollments (id, employee_id, course_id, enrollment_date, status)
             VALUES (?, ?, ?, ?, 'enrolled')
             ON DUPLICATE KEY UPDATE status = 'enrolled', enrollment_date = VALUES(enrollment_date)`,
            [id, employeeId, courseId, now]
        );

        const saved = await queryRows('training_enrollments', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: saved[0] });
    }

    if (action === 'tna/enrollment-update-status') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const id = String(req.body?.id || '').trim();
        const status = String(req.body?.status || '').trim();

        if (!id || !status) {
            throw { status: 400, message: 'ID and status are required', code: 'INVALID_INPUT' };
        }

        const completionDate = status === 'completed' ? new Date().toISOString().slice(0, 10) : null;

        await pool.query(
            'UPDATE training_enrollments SET status = ?, completion_date = ? WHERE id = ?',
            [status, completionDate, id]
        );

        const updated = await queryRows('training_enrollments', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: updated[0] });
    }

    if (action === 'tna/summary') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'director', 'hr']);

        const period = String(getInput(req, 'period', '')).trim();
        const sourceState = resolveTnaReadSource();

        if (sourceState.source === 'supabase') {
            const summary = await fetchTnaSummaryFromSupabase();
            return res.json({ data: summary });
        }

        const [totalNeeds] = await pool.query('SELECT COUNT(*) as cnt FROM training_need_records');
        const [completedNeeds] = await pool.query('SELECT COUNT(*) as cnt FROM training_need_records WHERE status = ?', ['completed']);
        const [activePlans] = await pool.query('SELECT COUNT(*) as cnt FROM training_plans WHERE status IN (?, ?)', ['approved', 'in_progress']);
        const [totalEnrollments] = await pool.query('SELECT COUNT(*) as cnt FROM training_enrollments');
        const [completedEnrollments] = await pool.query('SELECT COUNT(*) as cnt FROM training_enrollments WHERE status = ?', ['completed']);

        const [criticalGaps] = await pool.query('SELECT COUNT(*) as cnt FROM training_need_records WHERE priority = ?', ['critical']);
        const [highGaps] = await pool.query('SELECT COUNT(*) as cnt FROM training_need_records WHERE priority = ?', ['high']);

        return res.json({
            data: {
                total_needs_identified: totalNeeds[0]?.cnt || 0,
                needs_completed: completedNeeds[0]?.cnt || 0,
                active_plans: activePlans[0]?.cnt || 0,
                total_enrollments: totalEnrollments[0]?.cnt || 0,
                enrollments_completed: completedEnrollments[0]?.cnt || 0,
                critical_gaps: criticalGaps[0]?.cnt || 0,
                high_gaps: highGaps[0]?.cnt || 0,
            },
        });
    }

    if (action === 'tna/gaps-report') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'director', 'hr']);

        const department = String(getInput(req, 'department', '')).trim();
        const sourceState = resolveTnaReadSource();
        if (sourceState.source === 'supabase') {
            const rows = await fetchTnaGapsReportFromSupabase({ department });
            return res.json({ data: rows });
        }

        let query = `
            SELECT 
                tnr.employee_id,
                e.name as employee_name,
                e.position,
                e.department,
                tn.competency_name,
                tn.required_level,
                tnr.current_level,
                tnr.gap_level,
                tnr.priority,
                tnr.status,
                tnr.identified_at
            FROM training_need_records tnr
            JOIN employees e ON tnr.employee_id = e.employee_id
            JOIN training_needs tn ON tnr.training_need_id = tn.id
            WHERE tnr.status != 'completed' AND tnr.status != 'cancelled'
        `;
        const params = [];

        if (department) {
            query += ' AND e.department = ?';
            params.push(department);
        }

        query += ' ORDER BY tnr.priority DESC, tnr.gap_level DESC, e.name ASC';

        const [rows] = await pool.query(query, params);

        return res.json({ data: rows });
    }

    if (action === 'tna/import-competencies') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const positionName = String(req.body?.position_name || '').trim();
        const defaultRequiredLevel = Number(req.body?.default_required_level || 3);

        if (!positionName) {
            throw { status: 400, message: 'Position name is required', code: 'INVALID_INPUT' };
        }

        const config = await getCompetencyConfig(positionName);
        if (!config || !config.competencies) {
            throw { status: 404, message: 'No competency config found for this position', code: 'NOT_FOUND' };
        }

        let competencies = config.competencies;
        if (typeof competencies === 'string') {
            try { competencies = JSON.parse(competencies); } catch { competencies = []; }
        }

        const imported = [];
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        for (const comp of competencies) {
            if (!comp.name) continue;

            const id = generateUuid();
            await pool.query(
                `INSERT INTO training_needs (id, position_name, competency_name, required_level)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE required_level = VALUES(required_level)`,
                [id, positionName, comp.name, defaultRequiredLevel]
            );
            imported.push(comp.name);
        }

        return res.json({
            data: {
                position_name: positionName,
                competencies_imported: imported.length,
                competency_names: imported,
                default_required_level: defaultRequiredLevel,
            },
        });
    }

    if (action === 'tna/bulk-create-need-records') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const employeeId = String(req.body?.employee_id || '').trim();
        const gaps = req.body?.gaps || [];

        if (!employeeId) {
            throw { status: 400, message: 'Employee ID is required', code: 'INVALID_INPUT' };
        }

        const created = [];
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        for (const gap of gaps) {
            if (!gap.competency_name || !gap.training_need_id) continue;

            const id = generateUuid();
            await pool.query(
                `INSERT INTO training_need_records 
                 (id, employee_id, training_need_id, current_level, gap_level, priority, status, identified_by, identified_at, notes)
                 VALUES (?, ?, ?, ?, ?, ?, 'identified', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 current_level = VALUES(current_level),
                 gap_level = VALUES(gap_level),
                 priority = VALUES(priority)`,
                [
                    id,
                    employeeId,
                    gap.training_need_id,
                    gap.current_score || 0,
                    gap.gap || 0,
                    gap.priority || 'medium',
                    req.currentUser.employee_id,
                    now,
                    gap.notes || ''
                ]
            );
            created.push(gap.competency_name);
        }

        return res.json({
            data: {
                employee_id: employeeId,
                records_created: created.length,
                competency_names: created,
            },
        });
    }

    if (action === 'tna/course-create') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const courseName = String(req.body?.course_name || '').trim();
        const description = String(req.body?.description || '').trim();
        const provider = String(req.body?.provider || '').trim();
        const durationHours = Number(req.body?.duration_hours || 0);
        const cost = Number(req.body?.cost || 0);
        const competenciesCovered = req.body?.competencies_covered || [];

        if (!courseName) {
            throw { status: 400, message: 'Course name is required', code: 'INVALID_INPUT' };
        }

        const id = generateUuid();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            `INSERT INTO training_courses (id, course_name, description, provider, duration_hours, cost, competencies_covered, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, true, ?)`,
            [id, courseName, description, provider, durationHours, cost, JSON.stringify(competenciesCovered), now]
        );

        const saved = await queryRows('training_courses', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: saved[0] });
    }

    if (action === 'tna/course-update') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const id = String(req.body?.id || '').trim();
        if (!id) {
            throw { status: 400, message: 'Course ID is required', code: 'INVALID_INPUT' };
        }

        const updates = [];
        const values = [];

        if (req.body?.course_name !== undefined) {
            updates.push('course_name = ?');
            values.push(req.body.course_name);
        }
        if (req.body?.description !== undefined) {
            updates.push('description = ?');
            values.push(req.body.description);
        }
        if (req.body?.provider !== undefined) {
            updates.push('provider = ?');
            values.push(req.body.provider);
        }
        if (req.body?.duration_hours !== undefined) {
            updates.push('duration_hours = ?');
            values.push(Number(req.body.duration_hours));
        }
        if (req.body?.cost !== undefined) {
            updates.push('cost = ?');
            values.push(Number(req.body.cost));
        }
        if (req.body?.competencies_covered !== undefined) {
            updates.push('competencies_covered = ?');
            values.push(JSON.stringify(req.body.competencies_covered));
        }
        if (req.body?.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(req.body.is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            throw { status: 400, message: 'No updates provided', code: 'INVALID_INPUT' };
        }

        values.push(id);
        await pool.query(`UPDATE training_courses SET ${updates.join(', ')} WHERE id = ?`, values);

        const updated = await queryRows('training_courses', {
            filters: [{ op: 'eq', column: 'id', value: id }],
            limit: 1,
        });

        return res.json({ data: updated[0] });
    }

    if (action === 'tna/enrollments-with-details') {
        requireTna(req);
        const employeeId = String(getInput(req, 'employee_id', '')).trim();

        let query = `
            SELECT 
                te.id,
                te.employee_id,
                e.name as employee_name,
                te.course_id,
                tc.course_name,
                tc.provider,
                tc.duration_hours,
                te.enrollment_date,
                te.status,
                te.completion_date,
                te.score,
                te.certificate_url
            FROM training_enrollments te
            JOIN employees e ON te.employee_id = e.employee_id
            JOIN training_courses tc ON te.course_id = tc.id
            WHERE 1=1
        `;
        const params = [];

        if (employeeId) {
            query += ' AND te.employee_id = ?';
            params.push(employeeId);
        }

        query += ' ORDER BY te.enrollment_date DESC';

        const [rows] = await pool.query(query, params);
        return res.json({ data: rows });
    }

    if (action === 'tna/lms-report') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'director', 'hr']);

        const department = String(getInput(req, 'department', '')).trim();
        const sourceState = resolveTnaReadSource();
        if (sourceState.source === 'supabase') {
            const report = await fetchTnaLmsReportFromSupabase({ department });
            return res.json({ data: report });
        }

        let query = `
            SELECT 
                e.department,
                tc.course_name,
                tc.provider,
                COUNT(te.id) as total_enrolled,
                SUM(CASE WHEN te.status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN te.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                AVG(te.score) as avg_score
            FROM training_enrollments te
            JOIN employees e ON te.employee_id = e.employee_id
            JOIN training_courses tc ON te.course_id = tc.id
            WHERE 1=1
        `;
        const params = [];

        if (department) {
            query += ' AND e.department = ?';
            params.push(department);
        }

        query += ' GROUP BY e.department, tc.course_name, tc.provider ORDER BY e.department, tc.course_name';

        const [rows] = await pool.query(query, params);

        const [totalStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_enrollments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'enrolled' THEN 1 ELSE 0 END) as enrolled,
                AVG(score) as avg_score
            FROM training_enrollments
        `);

        return res.json({
            data: {
                summary: totalStats[0] || {},
                by_course: rows,
            },
        });
    }

    if (action === 'tna/migrate-training-history') {
        requireTna(req);
        requireRole(req, ['superadmin']);

        const [allEmployees] = await pool.query('SELECT employee_id, training_history FROM employees WHERE training_history IS NOT NULL AND training_history != "" AND training_history != "[]"');

        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (const emp of allEmployees) {
            try {
                let history = emp.training_history;
                if (typeof history === 'string') {
                    try { history = JSON.parse(history); } catch { history = []; }
                }

                if (!Array.isArray(history) || history.length === 0) {
                    skipped++;
                    continue;
                }

                for (const item of history) {
                    if (!item.course_name && !item.training_name) continue;

                    const courseName = item.course_name || item.training_name || 'Unknown Training';
                    const status = item.status === 'ongoing' ? 'in_progress' : (item.status === 'completed' ? 'completed' : 'enrolled');
                    const completionDate = item.completion_date || item.completed_at || null;

                    let [existing] = await pool.query(
                        'SELECT id FROM training_enrollments WHERE employee_id = ? AND course_id = ?',
                        [emp.employee_id, courseName]
                    );

                    if (existing.length > 0) {
                        skipped++;
                        continue;
                    }

                    const courseId = generateUuid();
                    await pool.query(
                        `INSERT INTO training_courses (id, course_name, provider, duration_hours, is_active)
                         VALUES (?, ?, ?, 8, true)
                         ON DUPLICATE KEY UPDATE id = id`,
                        [courseId, courseName, item.provider || 'Unknown']
                    );

                    const enrollmentId = generateUuid();
                    await pool.query(
                        `INSERT INTO training_enrollments (id, employee_id, course_id, enrollment_date, status, completion_date)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [enrollmentId, emp.employee_id, courseId, item.date || item.start_date || new Date().toISOString().slice(0, 10), status, completionDate]
                    );

                    migrated++;
                }
            } catch (err) {
                errors++;
                console.error(`Error migrating training history for employee ${emp.employee_id}:`, err.message);
            }
        }

        return res.json({
            data: {
                message: 'Migration completed',
                employees_processed: allEmployees.length,
                enrollments_migrated: migrated,
                skipped: skipped,
                errors: errors,
            },
        });
    }

    if (action === 'tna/training-history-stats') {
        requireTna(req);
        requireRole(req, ['superadmin', 'manager', 'hr']);

        const [allEmployees] = await pool.query('SELECT COUNT(*) as total FROM employees WHERE training_history IS NOT NULL AND training_history != "" AND training_history != "[]"');

        const [withHistory] = await pool.query(`
            SELECT COUNT(DISTINCT employee_id) as employees_with_history 
            FROM employees 
            WHERE training_history IS NOT NULL 
            AND training_history != '' 
            AND training_history != '[]'
        `);

        const [enrollmentStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_enrollments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM training_enrollments
        `);

        return res.json({
            data: {
                employees_with_embedded_history: withHistory[0]?.employees_with_history || 0,
                total_enrollments_in_lms: enrollmentStats[0]?.total_enrollments || 0,
                completed_in_lms: enrollmentStats[0]?.completed || 0,
            },
        });
    }

    if (action === 'tna/competencies/list') {
        return listPositionCompetencies(req, res);
    }
    if (action === 'tna/assessment/create') {
        return createAssessment(req, res);
    }
    if (action === 'tna/assessment/self-submit') {
        return selfSubmitAssessment(req, res);
    }
    if (action === 'tna/assessment/get') {
        return getAssessment(req, res);
    }
    if (action === 'tna/assessment/list') {
        return listAssessments(req, res);
    }

    throw { status: 404, message: `Unknown TNA action: ${action}`, code: 'NOT_FOUND' };
}

async function updatePlanTotalCost(planId) {
    const [result] = await pool.query(
        'UPDATE training_plans p SET total_cost = COALESCE((SELECT SUM(cost) FROM training_plan_items WHERE plan_id = ?), 0) WHERE id = ?',
        [planId, planId]
    );
    return result;
}

/* --- Assessment handlers --- */

async function listPositionCompetencies(req, res) {
    const position = String(getInput(req, 'position', req.body?.position_name || '')).trim();
    if (!position) {
        throw { status: 400, message: 'position is required', code: 'INVALID_INPUT' };
    }
    const config = await getCompetencyConfig(position);
    let competencies = config?.competencies || [];
    if (typeof competencies === 'string') {
        try { competencies = JSON.parse(competencies); } catch { competencies = []; }
    }
    return res.json({ success: true, competencies });
}

async function createAssessment(req, res) {
    const actor = requireRole(req, ['superadmin', 'manager', 'hr']);
    const employeeId = String(req.body?.employee_id || '').trim();
    const period = String(req.body?.period || '').trim();
    const assessments = req.body?.assessments || [];

    if (!employeeId || !period || !Array.isArray(assessments)) {
        throw { status: 400, message: 'employee_id, period, and assessments are required', code: 'INVALID_INPUT' };
    }

    const employeeRows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        filters: { employee_id: { type: 'eq', value: employeeId } },
        limit: 1
    });
    const employee = employeeRows[0];
    if (!employee) throw { status: 404, message: 'Employee not found', code: 'NOT_FOUND' };
    if (actor.role === 'manager' && String(employee.manager_id) !== String(actor.employee_id)) {
        throw { status: 403, message: 'Managers can only assess their own team', code: 'FORBIDDEN' };
    }

    const createdNeeds = [];
    for (const item of assessments) {
        const competencyName = String(item.competency_id || item.competency_name || '').trim();
        if (!competencyName) continue;

        const tnRefs = await supabaseTableRequest({
            table: 'training_needs',
            method: 'POST',
            body: [{
                id: generateUuid(),
                position_name: employee.position,
                competency_name: competencyName,
                required_level: Number(item.required_level || 3)
            }],
            prefer: 'resolution=merge-duplicates,return=representation'
        });
        const tnRef = tnRefs[0];

        const managerScore = Number(item.manager_score ?? 0);
        const requiredLevel = Number(item.required_level || tnRef?.required_level || 3);
        const gapLevel = requiredLevel - managerScore;
        const priority = item.priority || (gapLevel >= 2 ? 'critical' : (gapLevel >= 1 ? 'high' : 'medium'));

        const recordRows = await supabaseTableRequest({
            table: 'training_need_records',
            method: 'POST',
            body: [{
                id: generateUuid(),
                employee_id: employeeId,
                training_need_id: tnRef?.id,
                current_level: managerScore,
                manager_score: managerScore,
                gap_level: gapLevel,
                priority,
                status: 'identified',
                identified_by: actor.employee_id,
                identified_at: new Date().toISOString(),
                notes: item.notes || null,
                competency: competencyName,
                assessment_period: period
            }],
            prefer: 'return=representation'
        });
        if (recordRows[0]) createdNeeds.push(recordRows[0]);
    }
    return res.json({ success: true, needs: createdNeeds });
}

async function selfSubmitAssessment(req, res) {
    const actor = requireAuth(req);
    const employeeId = String(req.body?.employee_id || '').trim();
    const period = String(req.body?.period || '').trim();
    const selfAssessments = req.body?.self_assessments || [];

    if (!employeeId || !period || !Array.isArray(selfAssessments)) {
        throw { status: 400, message: 'employee_id, period, and self_assessments are required', code: 'INVALID_INPUT' };
    }

    if (actor.role === 'employee' && String(actor.employee_id) !== employeeId) {
        throw { status: 403, message: 'Access denied', code: 'FORBIDDEN' };
    }

    const now = new Date().toISOString();
    for (const item of selfAssessments) {
        const needId = String(item.need_id || '').trim();
        if (!needId) continue;

        await supabaseTableRequest({
            table: 'training_need_records',
            method: 'PATCH',
            filters: { id: { type: 'eq', value: needId } },
            body: {
                self_assessment_score: Number(item.self_assessment_score || 0),
                self_assessment_notes: item.self_assessment_notes || null,
                self_assessed_at: now
            }
        });
    }
    return res.json({ success: true });
}

async function getAssessment(req, res) {
    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();

    if (!employeeId || !period) {
        throw { status: 400, message: 'employee_id and period are required', code: 'INVALID_INPUT' };
    }

    const employeeRows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        filters: { employee_id: { type: 'eq', value: employeeId } },
        limit: 1
    });

    const records = await supabaseTableRequest({
        table: 'training_need_records',
        method: 'GET',
        filters: {
            employee_id: { type: 'eq', value: employeeId },
            assessment_period: { type: 'eq', value: period }
        }
    });

    return res.json({
        success: true,
        assessment: {
            employee: employeeRows[0] || null,
            period,
            competencies: records
        }
    });
}

async function listAssessments(req, res) {
    const actor = requireAuth(req);
    const department = String(getInput(req, 'department', '')).trim();
    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();
    const status = String(getInput(req, 'status', '')).trim();

    let employeeIds = [];
    if (department || actor.role === 'manager') {
        const filters = {};
        if (department) filters.department = { type: 'eq', value: department };
        if (actor.role === 'manager') filters.manager_id = { type: 'eq', value: actor.employee_id };
        
        const employees = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id',
            filters
        });
        employeeIds = employees.map(e => e.employee_id);
        if (actor.role === 'manager') {
            if (!employeeIds.includes(actor.employee_id)) employeeIds.push(actor.employee_id);
        }
    }

    const filters = {};
    if (employeeId) {
        filters.employee_id = { type: 'eq', value: employeeId };
    } else if (employeeIds.length > 0) {
        filters.employee_id = { type: 'in', value: employeeIds };
    } else if (actor.role === 'employee') {
        filters.employee_id = { type: 'eq', value: actor.employee_id };
    }

    if (period) filters.assessment_period = { type: 'eq', value: period };
    if (status) filters.status = { type: 'eq', value: status };

    const records = await supabaseTableRequest({
        table: 'training_need_records',
        method: 'GET',
        filters
    });

    const groups = new Map();
    for (const rec of records) {
        const key = `${rec.employee_id}::${rec.assessment_period || 'unset'}`;
        if (!groups.has(key)) {
            groups.set(key, {
                employee_id: rec.employee_id,
                period: rec.assessment_period || null,
                competency_count: 0,
                total_gap: 0,
                status: rec.status,
                assessed_at: rec.identified_at
            });
        }
        const g = groups.get(key);
        g.competency_count++;
        g.total_gap += Number(rec.gap_level || 0);
    }

    const finalEmployeeIds = [...new Set([...groups.values()].map(g => g.employee_id))];
    const employees = finalEmployeeIds.length > 0 ? await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,name',
        filters: { employee_id: { type: 'in', value: finalEmployeeIds } }
    }) : [];
    const nameMap = new Map(employees.map(e => [e.employee_id, e.name]));

    const assessments = [...groups.values()].map(g => ({
        ...g,
        employee_name: nameMap.get(g.employee_id) || 'Unknown',
        avg_gap: g.competency_count > 0 ? g.total_gap / g.competency_count : 0
    }));

    return res.json({ success: true, assessments });
}

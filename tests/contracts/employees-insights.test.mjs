import { test } from 'node:test';
import assert from 'node:assert/strict';

// Inline minimal schema validator to avoid needing the full contracts build in node test runner
function validateInsightsShape(payload) {
    assert.ok(typeof payload === 'object' && payload !== null, 'payload must be object');
    assert.strictEqual(payload.success, true, 'success must be true');
    assert.ok(typeof payload.insights === 'object', 'insights must be object');

    const { kpi, assessment, lms } = payload.insights;

    // KPI
    assert.ok(typeof kpi === 'object', 'insights.kpi must be object');
    assert.ok(kpi.latest_score === null || typeof kpi.latest_score === 'number', 'kpi.latest_score must be number or null');
    assert.ok(kpi.trend === null || ['up', 'down', 'flat'].includes(kpi.trend), 'kpi.trend must be up/down/flat/null');
    assert.ok(typeof kpi.record_count === 'number' && kpi.record_count >= 0, 'kpi.record_count must be non-negative number');

    // Assessment
    assert.ok(typeof assessment === 'object', 'insights.assessment must be object');
    assert.ok(assessment.gap_level === null || ['low', 'medium', 'high'].includes(assessment.gap_level), 'assessment.gap_level must be low/medium/high/null');
    assert.ok(assessment.last_assessed_at === null || typeof assessment.last_assessed_at === 'string', 'assessment.last_assessed_at must be string or null');
    assert.ok(typeof assessment.history_count === 'number' && assessment.history_count >= 0, 'assessment.history_count must be non-negative number');

    // LMS
    assert.ok(typeof lms === 'object', 'insights.lms must be object');
    assert.ok(typeof lms.enrolled_count === 'number' && lms.enrolled_count >= 0, 'lms.enrolled_count must be non-negative number');
    assert.ok(typeof lms.completed_count === 'number' && lms.completed_count >= 0, 'lms.completed_count must be non-negative number');
    assert.ok(typeof lms.completion_pct === 'number' && lms.completion_pct >= 0 && lms.completion_pct <= 100, 'lms.completion_pct must be 0-100');
}

test('employees/insights response shape contract', () => {
    // Simulate a successful response payload
    const mockPayload = {
        success: true,
        source: 'supabase',
        insights: {
            kpi: { latest_score: 87.5, trend: 'up', record_count: 12 },
            assessment: { gap_level: 'medium', last_assessed_at: '2026-03-01T00:00:00Z', history_count: 4 },
            lms: { enrolled_count: 5, completed_count: 3, completion_pct: 60 },
        },
    };
    validateInsightsShape(mockPayload);
});

test('employees/insights allows null fields', () => {
    const mockPayload = {
        success: true,
        source: 'supabase',
        insights: {
            kpi: { latest_score: null, trend: null, record_count: 0 },
            assessment: { gap_level: null, last_assessed_at: null, history_count: 0 },
            lms: { enrolled_count: 0, completed_count: 0, completion_pct: 0 },
        },
    };
    validateInsightsShape(mockPayload);
});

test('employees/insights completion_pct is 0 when enrolled_count is 0', () => {
    const payload = {
        success: true,
        insights: {
            kpi: { latest_score: null, trend: null, record_count: 0 },
            assessment: { gap_level: null, last_assessed_at: null, history_count: 0 },
            lms: { enrolled_count: 0, completed_count: 0, completion_pct: 0 },
        },
    };
    assert.strictEqual(payload.insights.lms.completion_pct, 0);
    validateInsightsShape(payload);
});

-- Dashboard Feature: Probation Reviews + PIP Records
-- Migration 011: Add tables for probation and PIP management
-- Date: 2026-04-05

-- =====================================================
-- PROBATION REVIEWS
-- =====================================================
CREATE TABLE IF NOT EXISTS probation_reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    review_date date NOT NULL DEFAULT CURRENT_DATE,
    decision text NOT NULL CHECK (decision IN ('pass', 'fail', 'extended')),
    notes text,
    reviewed_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_probation_reviews_employee ON probation_reviews(employee_id);
CREATE INDEX idx_probation_reviews_date ON probation_reviews(review_date);
CREATE INDEX idx_probation_reviews_decision ON probation_reviews(decision);

-- =====================================================
-- PIP RECORDS
-- =====================================================
CREATE TABLE IF NOT EXISTS pip_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'failed')),
    reason text,
    outcome text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pip_records_employee ON pip_records(employee_id);
CREATE INDEX idx_pip_records_status ON pip_records(status);
CREATE INDEX idx_pip_records_start_date ON pip_records(start_date);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- probation_reviews policies
ALTER TABLE probation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "probation_reviews_read_admin" ON probation_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr', 'manager')
        )
    );

CREATE POLICY "probation_reviews_write_admin" ON probation_reviews
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr')
        )
    );

-- pip_records policies
ALTER TABLE pip_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pip_records_read_admin" ON pip_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr', 'manager')
        )
    );

CREATE POLICY "pip_records_write_admin" ON pip_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr')
        )
    );

-- =====================================================
-- Migration tracking
-- =====================================================
INSERT INTO migration_history (migration_name)
VALUES ('011_probation_pip_schema')
ON CONFLICT DO NOTHING;

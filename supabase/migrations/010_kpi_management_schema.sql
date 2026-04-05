-- KPI Management Schema: definitions, targets, governance
-- Migration 010: Add tables for full KPI lifecycle management
-- Date: 2026-04-05

-- =====================================================
-- KPI DEFINITIONS (expanded from existing minimal table)
-- =====================================================
-- Note: kpi_definitions table already exists with basic columns.
-- This migration adds missing columns if they don't exist.

-- Add missing columns to kpi_definitions (safe ALTER with IF NOT EXISTS pattern)
DO $$
BEGIN
    -- Add formula column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'formula'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN formula text;
    END IF;

    -- Add kpi_type column (direct | ratio)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'kpi_type'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN kpi_type text NOT NULL DEFAULT 'direct';
    END IF;

    -- Add applies_to_position column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'applies_to_position'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN applies_to_position text;
    END IF;

    -- Add target_value column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'target_value'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN target_value numeric;
    END IF;

    -- Add effective_date column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'effective_date'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN effective_date date NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    -- Add version column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'version'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN version integer DEFAULT 1;
    END IF;

    -- Add created_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN created_by text;
    END IF;

    -- Add change_note column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'change_note'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN change_note text;
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kpi_definitions' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE kpi_definitions ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- Update status default to 'approved' if currently 'active'
    UPDATE kpi_definitions SET status = 'approved' WHERE status = 'active';
END $$;

-- =====================================================
-- KPI TARGETS (personalized per-employee per-period)
-- =====================================================
CREATE TABLE IF NOT EXISTS kpi_targets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    kpi_definition_id uuid NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    period text NOT NULL,              -- YYYY-MM
    target_value numeric NOT NULL,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, kpi_definition_id, period)
);

CREATE INDEX idx_kpi_targets_employee ON kpi_targets(employee_id);
CREATE INDEX idx_kpi_targets_period ON kpi_targets(period);
CREATE INDEX idx_kpi_targets_definition ON kpi_targets(kpi_definition_id);

-- =====================================================
-- KPI GOVERNANCE (global settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS kpi_governance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    require_hr_approval boolean DEFAULT false,
    updated_by text,
    updated_at timestamptz DEFAULT now()
);

-- Insert default governance row if none exists
INSERT INTO kpi_governance (require_hr_approval)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM kpi_governance);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- kpi_targets policies
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_targets_read_self" ON kpi_targets
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE employee_id = kpi_targets.employee_id
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr')
        )
        OR EXISTS (
            SELECT 1 FROM employees e
            JOIN profiles p ON p.employee_id = e.employee_id
            WHERE p.id = auth.uid()
            AND e.manager_id = kpi_targets.employee_id
        )
    );

CREATE POLICY "kpi_targets_write_admin" ON kpi_targets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr')
        )
    );

-- kpi_governance policies
ALTER TABLE kpi_governance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_governance_read_all" ON kpi_governance
    FOR SELECT USING (true);

CREATE POLICY "kpi_governance_write_superadmin" ON kpi_governance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'superadmin'
        )
    );

-- Enhanced kpi_definitions policies
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_definitions_read_all" ON kpi_definitions
    FOR SELECT USING (true);

CREATE POLICY "kpi_definitions_write_admin" ON kpi_definitions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'hr')
        )
    );

CREATE POLICY "kpi_definitions_pending_manager" ON kpi_definitions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'manager'
        )
        AND (
            SELECT require_hr_approval FROM kpi_governance LIMIT 1
        ) = true
    );

-- =====================================================
-- Migration tracking
-- =====================================================
INSERT INTO migration_history (migration_name)
VALUES ('010_kpi_management_schema')
ON CONFLICT DO NOTHING;

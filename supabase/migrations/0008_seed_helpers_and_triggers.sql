-- 0008_seed_helpers_and_triggers.sql
-- Helper functions and triggers to keep compatibility fields synchronized.

create or replace function public.sync_training_need_record_compat()
returns trigger
language plpgsql
as $$
begin
    if new.gap_score is null then
        new.gap_score := new.gap_level;
    end if;

    if coalesce(new.competency, '') = '' then
        select tn.competency_name
        into new.competency
        from public.training_needs tn
        where tn.id = new.training_need_id
        limit 1;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_training_need_records_compat on public.training_need_records;
create trigger trg_training_need_records_compat
before insert or update on public.training_need_records
for each row
execute function public.sync_training_need_record_compat();

create or replace function public.recalculate_training_plan_total_cost(p_plan_id uuid)
returns void
language plpgsql
as $$
begin
    update public.training_plans tp
    set total_cost = coalesce((
        select sum(coalesce(tpi.cost, 0))
        from public.training_plan_items tpi
        where tpi.plan_id = p_plan_id
    ), 0)
    where tp.id = p_plan_id;
end;
$$;

create or replace function public.sync_training_plan_total_cost()
returns trigger
language plpgsql
as $$
declare
    target_plan_id uuid;
begin
    target_plan_id := coalesce(new.plan_id, old.plan_id);
    if target_plan_id is not null then
        perform public.recalculate_training_plan_total_cost(target_plan_id);
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_training_plan_items_total_cost on public.training_plan_items;
create trigger trg_training_plan_items_total_cost
after insert or update or delete on public.training_plan_items
for each row
execute function public.sync_training_plan_total_cost();

create or replace function public.sync_course_enrollment_progress_flags()
returns trigger
language plpgsql
as $$
begin
    if new.progress_percent >= 100 and new.status <> 'completed' then
        new.status := 'completed';
        new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
    end if;

    if new.status = 'completed' and new.completed_at is null then
        new.completed_at := timezone('utc', now());
    end if;

    return new;
end;
$$;

drop trigger if exists trg_course_enrollments_progress_flags on public.course_enrollments;
create trigger trg_course_enrollments_progress_flags
before insert or update on public.course_enrollments
for each row
execute function public.sync_course_enrollment_progress_flags();

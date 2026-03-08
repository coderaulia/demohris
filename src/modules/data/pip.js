import {
    supabase,
    state,
    emit,
    asArray,
    toNumber,
    execSupabase,
    fetchOptionalCollection,
} from './runtime.js';

async function fetchPipPlans() {
    return fetchOptionalCollection({
        label: 'Fetch PIP plans',
        table: 'pip_plans',
        stateKey: 'pipPlans',
        eventName: 'data:pipPlans',
        orderBy: 'created_at',
        ascending: false,
    });
}

async function fetchPipActions() {
    return fetchOptionalCollection({
        label: 'Fetch PIP actions',
        table: 'pip_actions',
        stateKey: 'pipActions',
        eventName: 'data:pipActions',
        orderBy: 'created_at',
        ascending: false,
    });
}

async function savePipPlan(plan) {
    const payload = {
        ...plan,
        owner_manager_id: plan.owner_manager_id || state.currentUser?.id || null,
    };

    const { data } = await execSupabase(
        'Save PIP plan',
        () => supabase
            .from('pip_plans')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single(),
        { interactiveRetry: true, retries: 1 }
    );

    const idx = state.pipPlans.findIndex(r => r.id === data.id);
    if (idx >= 0) state.pipPlans[idx] = data;
    else state.pipPlans.push(data);
    emit('data:pipPlans', state.pipPlans);
    return data;
}

async function savePipActions(pipPlanId, actions = []) {
    const rows = asArray(actions)
        .map(item => ({
            id: item?.id,
            pip_plan_id: pipPlanId,
            action_title: String(item?.action_title || '').trim(),
            action_detail: String(item?.action_detail || '').trim(),
            due_date: item?.due_date || null,
            progress_pct: toNumber(item?.progress_pct, 0),
            status: String(item?.status || 'todo'),
            checkpoint_note: String(item?.checkpoint_note || '').trim(),
        }))
        .filter(item => item.action_title);

    if (rows.length === 0) return [];

    const { data } = await execSupabase(
        'Save PIP actions',
        () => supabase
            .from('pip_actions')
            .upsert(rows, { onConflict: 'id' })
            .select(),
        { interactiveRetry: true, retries: 1 }
    );

    const untouched = state.pipActions.filter(item => item.pip_plan_id !== pipPlanId);
    state.pipActions = [...untouched, ...(data || [])];
    emit('data:pipActions', state.pipActions);
    return data || [];
}

export {
    fetchPipPlans,
    fetchPipActions,
    savePipPlan,
    savePipActions,
};

import { state } from './store.js';

function getManagerScopeIds(db, managerId) {
    const mgrRec = db[managerId];
    if (!mgrRec) return [];
    if (mgrRec.department) {
        return Object.keys(db).filter(id => db[id].department === mgrRec.department);
    }
    return Object.keys(db).filter(id => db[id].manager_id === managerId || id === managerId);
}

export function getRoleScopedEmployeeIds() {
    const { db, currentUser } = state;
    if (!currentUser) return [];

    if (currentUser.role === 'employee') return [currentUser.id];
    if (currentUser.role === 'manager') {
        return getManagerScopeIds(db, currentUser.id);
    }
    return Object.keys(db);
}

export function getFilteredEmployeeIds() {
    const { db, reportFilters } = state;
    let ids = getRoleScopedEmployeeIds();

    if (reportFilters.department) {
        ids = ids.filter(id => (db[id]?.department || '') === reportFilters.department);
    }
    if (reportFilters.manager_id) {
        ids = ids.filter(id => (db[id]?.manager_id || '') === reportFilters.manager_id || id === reportFilters.manager_id);
    }

    return ids;
}

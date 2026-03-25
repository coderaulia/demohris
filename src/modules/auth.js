// ==================================================
// AUTH MODULE — Session Authentication via PHP API
// ==================================================

import { apiRequest } from '../lib/supabase.js';
import { state, emit } from '../lib/store.js';
import * as notify from '../lib/notify.js';

function getHashParams() {
    const hash = String(window.location.hash || '').replace(/^#/, '');
    return new URLSearchParams(hash);
}

export function isRecoveryMode() {
    const params = getHashParams();
    return params.get('type') === 'recovery';
}

export function clearAuthHash() {
    if (!window.location.hash) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

function normalizeProfile(profile = {}) {
    return {
        employee_id: profile.employee_id || profile.id || '',
        name: profile.name || '',
        auth_email: profile.auth_email || profile.email || '',
        role: profile.role || 'employee',
        auth_id: profile.auth_id || profile.employee_id || profile.id || '',
        position: profile.position || '',
        department: profile.department || '',
        seniority: profile.seniority || '',
        must_change_password: Boolean(profile.must_change_password),
    };
}

function setCurrentUser(profile) {
    const normalized = normalizeProfile(profile);
    state.currentUser = {
        id: normalized.employee_id,
        name: normalized.name || normalized.auth_email.split('@')[0] || normalized.employee_id,
        email: normalized.auth_email,
        role: normalized.role,
        auth_id: normalized.auth_id,
        position: normalized.position,
        department: normalized.department,
        seniority: normalized.seniority,
        must_change_password: normalized.must_change_password,
        reauthenticated_at: Date.now(),
    };
    sessionStorage.setItem('hr_user', JSON.stringify(state.currentUser));
    emit('auth:login', state.currentUser);
    return state.currentUser;
}

export async function signIn(email, password) {
    const response = await apiRequest('auth/login', {
        email: String(email || '').trim(),
        password: String(password || ''),
    });
    return setCurrentUser(response?.profile || {});
}

export async function signOut() {
    try {
        await apiRequest('auth/logout', {});
    } catch {
        // Clear browser state even if the server session was already invalidated.
    }

    state.currentUser = null;
    sessionStorage.removeItem('hr_user');
    emit('auth:logout');
    location.reload();
}

export async function restoreSession() {
    try {
        const response = await apiRequest('auth/session', {}, { method: 'GET' });
        if (!response?.profile?.employee_id) return null;
        return setCurrentUser(response.profile);
    } catch {
        return null;
    }
}

export async function createAuthUser(employeeId, email, password) {
    if (state.currentUser?.role !== 'superadmin') {
        throw new Error('Access denied. Superadmin only.');
    }

    return apiRequest('auth/create-user', {
        employee_id: String(employeeId || '').trim(),
        email: String(email || '').trim(),
        password: String(password || ''),
    });
}

export async function requestPasswordReset(email) {
    return apiRequest('auth/password-reset-request', {
        email: String(email || '').trim(),
    });
}

export async function updatePassword(newPassword, options = {}) {
    await apiRequest('auth/update-password', {
        password: String(newPassword || ''),
    });

    if (state.currentUser) {
        state.currentUser.reauthenticated_at = Date.now();
        if (options.clearMustChange) {
            state.currentUser.must_change_password = false;
            const { saveEmployee } = await import('./data.js');
            const rec = state.db[state.currentUser.id];
            if (rec) {
                rec.must_change_password = false;
                await saveEmployee(rec);
            }
        }
        sessionStorage.setItem('hr_user', JSON.stringify(state.currentUser));
    }
}

export async function promptChangePassword(options = {}) {
    const title = options.enforced ? 'Set New Password (Required)' : 'Change Password';
    const newPass = await notify.input({
        title,
        input: 'password',
        inputLabel: 'New password (minimum 8 characters)',
        inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
        confirmButtonText: 'Continue',
        cancelButtonText: options.enforced ? 'Logout' : 'Cancel',
        validate: value => {
            const v = String(value || '');
            if (!v || v.length < 8) return 'Password must be at least 8 characters.';
            return null;
        },
    });
    if (newPass === null) return false;

    const confirmPass = await notify.input({
        title: 'Confirm New Password',
        input: 'password',
        inputLabel: 'Re-enter the new password',
        inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
        confirmButtonText: 'Update Password',
        cancelButtonText: options.enforced ? 'Logout' : 'Cancel',
        validate: value => {
            if (String(value || '') !== String(newPass)) return 'Passwords do not match.';
            return null;
        },
    });
    if (confirmPass === null) return false;

    await notify.withLoading(async () => {
        await updatePassword(String(newPass), {
            clearMustChange: options.clearMustChange,
        });
    }, 'Updating Password', 'Applying new password...');

    await notify.success('Password updated successfully.');
    return true;
}

export async function enforcePasswordPolicyOnLogin() {
    if (isRecoveryMode()) {
        await notify.info('Password recovery mode is not configured for email links in this deployment. Please set a new password now.');
        const ok = await promptChangePassword({ enforced: true, clearMustChange: true });
        clearAuthHash();
        if (!ok) {
            await notify.error('Password update is required after recovery. You have been logged out.');
            await signOut();
            return false;
        }
    }

    if (state.currentUser?.must_change_password) {
        await notify.info('You are using a temporary password. Please change it before continuing.');
        const ok = await promptChangePassword({ enforced: true, clearMustChange: true });
        if (!ok) {
            await notify.error('Password change is required for first login. You have been logged out.');
            await signOut();
            return false;
        }
    }
    return true;
}

export async function requireRecentAuth(actionLabel = 'this action', maxAgeMs = 10 * 60 * 1000) {
    const user = state.currentUser;
    if (!user) return false;
    if (user.must_change_password) {
        await notify.warn('Please change your temporary password first.');
        return false;
    }

    const age = Date.now() - Number(user.reauthenticated_at || 0);
    if (age <= maxAgeMs) return true;

    const password = await notify.input({
        title: 'Re-authentication Required',
        text: `Please re-enter your password to continue with ${actionLabel}.`,
        input: 'password',
        inputLabel: `Account: ${user.email}`,
        confirmButtonText: 'Verify',
        validate: value => {
            const v = String(value || '');
            if (!v) return 'Password is required.';
            return null;
        },
    });
    if (password === null) return false;

    try {
        await apiRequest('auth/verify-password', {
            password: String(password),
        });
    } catch (error) {
        await notify.error('Re-authentication failed: ' + error.message);
        return false;
    }

    user.reauthenticated_at = Date.now();
    sessionStorage.setItem('hr_user', JSON.stringify(user));
    return true;
}

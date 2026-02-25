// ==================================================
// ADMIN MODULE — Competencies Configuration
// (Superadmin only)
// ==================================================

import { state, emit, isAdmin } from '../lib/store.js';
import { escapeHTML } from '../lib/utils.js';
import { saveConfig, deleteConfig } from './data.js';

let tempCompetencies = [];

export function renderAdminList() {
    const listEl = document.getElementById('admin-pos-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Hide form for non-admins
    const formEl = document.getElementById('admin-form-panel');
    if (formEl) formEl.style.display = isAdmin() ? 'block' : 'none';

    const { appConfig } = state;

    if (!appConfig || Object.keys(appConfig).length === 0) {
        listEl.innerHTML = '<li class="list-group-item text-muted fst-italic">No positions configured. Add one on the left.</li>';
        return;
    }

    const positions = Object.keys(appConfig).sort();

    positions.forEach(pos => {
        const comps = appConfig[pos].competencies || [];
        const compCount = comps.length;
        const safePos = escapeHTML(pos);

        // Show competency preview
        let preview = '';
        if (compCount > 0) {
            const previewComps = comps.slice(0, 3).map(c => escapeHTML(c.name)).join(', ');
            const more = compCount > 3 ? ` +${compCount - 3} more` : '';
            preview = `<div class="small text-muted mt-1">${previewComps}${more}</div>`;
        }

        const actions = isAdmin() ? `
      <div>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="window.__app.loadPositionForEdit('${safePos}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="window.__app.deletePositionConfig('${safePos}')"><i class="bi bi-trash"></i></button>
      </div>` : '';

        listEl.innerHTML += `
      <li class="admin-list-item">
        <div>
          <span class="fw-bold fs-6">${safePos}</span>
          <span class="badge bg-primary text-white ms-2">${compCount} Competencies</span>
          ${preview}
        </div>
        ${actions}
      </li>`;
    });
}

function renderTempCompetencies() {
    const listEl = document.getElementById('comp-temp-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (tempCompetencies.length === 0) {
        listEl.innerHTML = '<li class="list-group-item text-muted fst-italic small py-1">No competencies added yet.</li>';
        return;
    }

    tempCompetencies.forEach((c, index) => {
        listEl.innerHTML += `
        <li class="list-group-item list-group-item-sm py-1 border-light">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold small">${escapeHTML(c.name)}</div>
                    <div class="text-muted" style="font-size: 10px;">${escapeHTML(c.rec)}</div>
                </div>
                <button class="btn btn-sm btn-link text-danger p-0" onclick="window.__app.removeCompetencyRow(${index})"><i class="bi bi-x-circle-fill"></i></button>
            </div>
        </li>`;
    });
}

export function addCompetencyRow() {
    const nameInput = document.getElementById('comp-input-name');
    const recInput = document.getElementById('comp-input-rec');
    const descInput = document.getElementById('comp-input-desc');

    const name = nameInput.value.trim();
    const rec = recInput.value.trim() || 'General training recommended.';
    const desc = descInput.value.trim() || '';

    if (!name) {
        alert('Please enter a Skill Name.');
        return;
    }

    tempCompetencies.push({ name, rec, desc });

    nameInput.value = '';
    recInput.value = '';
    descInput.value = '';

    renderTempCompetencies();
    nameInput.focus();
}

export function removeCompetencyRow(index) {
    tempCompetencies.splice(index, 1);
    renderTempCompetencies();
}

export async function savePositionConfig() {
    if (!isAdmin()) { alert('Access Denied'); return; }

    const posName = document.getElementById('admin-pos-name').value.trim();

    if (!posName) { alert('Please enter a Position Name.'); return; }
    if (tempCompetencies.length === 0) { alert('Please add at least one competency.'); return; }

    try {
        await saveConfig(posName, tempCompetencies);
        alert(`Configuration saved! ${tempCompetencies.length} competencies for "${posName}".`);
        renderAdminList();
        clearAdminForm();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

export function loadPositionForEdit(posName) {
    if (!isAdmin()) return;
    const config = state.appConfig[posName];
    if (!config) return;

    document.getElementById('admin-pos-name').value = posName;
    document.getElementById('editor-title').innerHTML = `<i class="bi bi-pencil-square"></i> Editing: <span class="text-primary">${escapeHTML(posName)}</span>`;

    tempCompetencies = config.competencies ? [...config.competencies] : [];
    renderTempCompetencies();
}

export async function deletePositionConfig(posName) {
    if (!isAdmin()) return;
    if (confirm(`Delete configuration for "${posName}"?`)) {
        await deleteConfig(posName);
        renderAdminList();
    }
}

export function clearAdminForm() {
    document.getElementById('admin-pos-name').value = '';
    document.getElementById('comp-input-name').value = '';
    document.getElementById('comp-input-rec').value = '';
    document.getElementById('comp-input-desc').value = '';
    document.getElementById('editor-title').innerHTML = '<i class="bi bi-pencil-square"></i> Add / Edit Position';

    tempCompetencies = [];
    renderTempCompetencies();
}

export function exportConfigJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.appConfig, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'competencies_config.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function triggerConfigImport() {
    document.getElementById('config-import').click();
}

export async function importConfigJSON(input) {
    if (!isAdmin()) { alert('Access Denied'); return; }
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const json = JSON.parse(e.target.result);
            let count = 0;
            for (const posName in json) {
                await saveConfig(posName, json[posName].competencies || []);
                count++;
            }
            renderAdminList();
            alert(`Imported ${count} position configs successfully!`);
        } catch (err) {
            alert('Invalid JSON file.');
            console.error(err);
        }
        input.value = '';
    };
    reader.readAsText(file);
}

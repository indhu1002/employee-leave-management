const serviceUrl = '/odata/v4/leave';
const state = { user: null, csrfToken: null, employees: [], requests: [], page: 'home', loginRole: 'Employee' };
const $ = (selector) => document.querySelector(selector);

function showMessage(text, kind) {
    const element = $('#message');
    element.textContent = text;
    element.className = 'message ' + kind;
    element.hidden = false;
}

async function api(path, options = {}) {
    const headers = { Accept: 'application/json', ...options.headers };
    if (options.method && options.method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        headers['X-CSRF-Token'] = state.csrfToken;
    }
    const response = await fetch(serviceUrl + path, { ...options, credentials: 'same-origin', headers });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) showLogin();
    if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status}).`);
    return result;
}

function cell(row, value, className) {
    const item = row.insertCell();
    item.textContent = value ?? '—';
    if (className) item.className = className;
    return item;
}

function renderSummary() {
    const requests = state.requests;
    $('#total-count').textContent = requests.length;
    for (const status of ['Pending', 'Approved', 'Rejected']) {
        $('#' + status.toLowerCase() + '-count').textContent = requests.filter((request) => request.status === status).length;
    }
    $('#welcome-heading').textContent = `Welcome, ${state.user.name}!`;
    $('#profile-name').textContent = state.user.name;
    $('#profile-role').textContent = state.user.role;
    $('#welcome-subtitle').textContent = state.user.role === 'Manager'
        ? 'Review requests, support your team and keep decisions moving.'
        : 'Apply for leave, track your requests and stay connected.';
    $('.stat-card small').textContent = state.user.role === 'Manager' ? 'Across your team' : 'Your total leave requests';
}

function renderRequests() {
    const body = $('#request-rows');
    body.replaceChildren();
    const requests = state.user.role === 'Manager' && ['home', 'approvals'].includes(state.page)
        ? state.requests.filter((request) => request.status === 'Pending')
        : state.requests;
    $('#requests-title').textContent = state.user.role === 'Employee' ? 'My Leave Requests'
        : state.page === 'all' ? 'All Leave Requests' : 'Pending Approvals';
    if (!requests.length) {
        const item = body.insertRow().insertCell();
        item.colSpan = 8;
        item.className = 'empty';
        item.textContent = 'No leave requests yet.';
        return;
    }
    requests.forEach((request, index) => {
        const row = body.insertRow();
        cell(row, index + 1);
        const employeeCell = row.insertCell();
        employeeCell.className = 'employee-cell';
        const avatar = document.createElement('span');
        avatar.className = 'employee-avatar';
        avatar.textContent = (request.employee?.name || '?').charAt(0).toUpperCase();
        const meta = document.createElement('span');
        meta.className = 'employee-meta';
        const name = document.createElement('strong');
        name.textContent = request.employee?.name || 'Unknown';
        const position = document.createElement('small');
        position.textContent = [request.employee?.department, request.employee?.jobTitle].filter(Boolean).join(' - ');
        meta.append(name, position);
        employeeCell.append(avatar, meta);
        cell(row, request.leaveType);
        cell(row, request.fromDate);
        cell(row, request.toDate);
        const statusCell = row.insertCell();
        const badge = document.createElement('span');
        badge.className = 'status ' + request.status.toLowerCase();
        badge.textContent = request.status;
        statusCell.append(badge);
        cell(row, request.reason, 'reason-cell');
        const actionsCell = row.insertCell();
        const actions = document.createElement('div');
        actions.className = 'actions';
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'view-button';
        view.textContent = state.user.role === 'Manager' && request.status === 'Pending' ? 'Review' : 'View';
        view.addEventListener('click', () => showDetails(request));
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'more-button';
        more.textContent = '···';
        more.setAttribute('aria-label', `More actions for ${request.employee?.name || 'request'}`);
        more.addEventListener('click', () => showDetails(request));
        actions.append(view, more);
        actionsCell.append(actions);
    });
}

function renderEmployees() {
    const body = $('#employee-rows');
    body.replaceChildren();
    for (const employee of state.employees) {
        const row = body.insertRow();
        cell(row, employee.ID);
        cell(row, employee.name);
        cell(row, employee.email);
        cell(row, employee.department);
        cell(row, employee.jobTitle);
    }
}

function renderReports() {
    const counts = new Map();
    for (const request of state.requests) counts.set(request.leaveType, (counts.get(request.leaveType) || 0) + 1);
    const content = $('#report-content');
    content.replaceChildren();
    const total = document.createElement('p');
    total.textContent = `Total leave requests: ${state.requests.length}`;
    content.append(total);
    for (const [type, count] of counts) {
        const item = document.createElement('p');
        item.textContent = `${type}: ${count}`;
        content.append(item);
    }
}

function renderRecentDecisions() {
    const container = $('#recent-decisions');
    container.replaceChildren();
    const decisions = state.requests.filter((request) => request.status !== 'Pending').slice(-4).reverse();
    if (!decisions.length) {
        const empty = document.createElement('p');
        empty.className = 'recent-empty';
        empty.textContent = 'No decisions yet.';
        container.append(empty);
        return;
    }
    for (const request of decisions) {
        const item = document.createElement('div');
        item.className = 'recent-item';
        const detail = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = request.employee?.name || 'Employee';
        const description = document.createElement('small');
        description.textContent = `${request.leaveType} · ${request.fromDate} to ${request.toDate}`;
        detail.append(name, description);
        const badge = document.createElement('span');
        badge.className = 'status ' + request.status.toLowerCase();
        badge.textContent = request.status;
        item.append(detail, badge);
        container.append(item);
    }
}

function render() {
    renderSummary();
    renderRequests();
    renderEmployees();
    renderReports();
    renderRecentDecisions();
}

function showDetails(request) {
    const details = $('#modal-details');
    details.replaceChildren();
    for (const [label, value] of [
        ['Employee', request.employee?.name || 'Unknown'],
        ['Leave type', request.leaveType],
        ['From', request.fromDate],
        ['To', request.toDate],
        ['Status', request.status],
        ['Reason', request.reason]
    ]) {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        details.append(term, description);
    }
    const actions = $('#modal-actions');
    actions.replaceChildren();
    if (state.user.role === 'Manager' && request.status === 'Pending') {
        for (const [status, label, style] of [
            ['Approved', 'Approve', 'approve'],
            ['Rejected', 'Reject', 'reject']
        ]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = style;
            button.textContent = label;
            button.addEventListener('click', () => updateStatus(request, status));
            actions.append(button);
        }
    }
    $('#detail-modal').hidden = false;
    $('#modal-close').focus();
}

async function updateStatus(request, status) {
    $('#modal-actions').querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try {
        await api(`/LeaveRequests(${request.ID})`, { method: 'PATCH', body: JSON.stringify({ status }) });
        $('#detail-modal').hidden = true;
        await loadRequests();
        showMessage(`Request ${status.toLowerCase()}.`, 'success');
    } catch (error) {
        showMessage(error.message, 'error');
        $('#detail-modal').hidden = true;
    }
}

async function loadRequests() {
    const result = await api('/LeaveRequests?$expand=employee&$orderby=fromDate%20asc');
    state.requests = result.value;
    render();
}

async function loadData() {
    const requests = await api('/LeaveRequests?$expand=employee&$orderby=fromDate%20asc');
    state.requests = requests.value;
    if (state.user.role === 'Manager') {
        const employees = await api('/Employees?$orderby=name');
        state.employees = employees.value.sort((a, b) =>
            Number(b.email === 'indhudande@company.com') - Number(a.email === 'indhudande@company.com'));
    }
    render();
}

function activatePage(page) {
    if (state.user.role === 'Employee' && !['home', 'mine', 'apply'].includes(page)) return;
    if (state.user.role === 'Manager' && !['home', 'approvals', 'all', 'employees', 'reports'].includes(page)) return;
    state.page = page;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
    const alternate = page === 'employees' || page === 'reports';
    $('#dashboard-content').hidden = alternate;
    $('#hero').hidden = alternate;
    $('#employees-panel').hidden = page !== 'employees';
    $('#reports-panel').hidden = page !== 'reports';
    renderRequests();
    if (page === 'apply') {
        $('#apply-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#leave-type').focus();
    } else if (page === 'mine' || page === 'all' || page === 'approvals') {
        $('#requests-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

$('#request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.user.role !== 'Employee') return;
    const leaveType = $('#leave-type').value;
    const fromDate = $('#from-date').value;
    const toDate = $('#to-date').value;
    const reason = $('#reason').value.trim();
    if (!leaveType || !fromDate || !toDate || !reason) {
        showMessage('Complete all fields before submitting.', 'error');
        return;
    }
    if (fromDate > toDate) {
        showMessage('The end date must be on or after the start date.', 'error');
        return;
    }
    const button = $('#submit-button');
    button.disabled = true;
    try {
        await api('/LeaveRequests', {
            method: 'POST',
            body: JSON.stringify({ leaveType, fromDate, toDate, reason })
        });
        $('#request-form').reset();
        await loadRequests();
        showMessage('Leave request submitted.', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => activatePage(button.dataset.page)));
$('#view-all-button').addEventListener('click', () => activatePage('all'));
$('#notifications-button').addEventListener('click', () => {
    const count = state.requests.filter((request) => request.status === 'Pending').length;
    showMessage(count ? `${count} request${count === 1 ? '' : 's'} awaiting approval.` : 'No pending requests.', 'success');
});
$('#modal-close').addEventListener('click', () => { $('#detail-modal').hidden = true; });
$('#detail-modal').addEventListener('click', (event) => {
    if (event.target === $('#detail-modal')) $('#detail-modal').hidden = true;
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $('#detail-modal').hidden = true;
});

function showLogin() {
    state.user = null;
    state.csrfToken = null;
    state.employees = [];
    state.requests = [];
    $('#app-shell').hidden = true;
    $('#login-screen').hidden = false;
    $('#detail-modal').hidden = true;
    $('#login-form').reset();
    $('#login-error').hidden = true;
}

async function showApp(session) {
    state.user = session.user;
    state.csrfToken = session.csrfToken;
    state.page = 'home';
    document.querySelectorAll('.employee-only').forEach((item) => { item.hidden = state.user.role !== 'Employee'; });
    document.querySelectorAll('.manager-only').forEach((item) => { item.hidden = state.user.role !== 'Manager'; });
    $('#view-all-button').hidden = state.user.role !== 'Manager';
    $('#login-screen').hidden = true;
    $('#app-shell').hidden = false;
    activatePage('home');
    await loadData();
}

document.querySelectorAll('.role-tab').forEach((button) => button.addEventListener('click', () => {
    state.loginRole = button.dataset.role;
    document.querySelectorAll('.role-tab').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
    });
    $('#login-form').reset();
    $('#login-error').hidden = true;
}));

$('#toggle-password').addEventListener('click', () => {
    const input = $('#login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
    $('#toggle-password').textContent = input.type === 'password' ? 'Show' : 'Hide';
});

$('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#login-button');
    button.disabled = true;
    $('#login-error').hidden = true;
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: $('#login-email').value.trim(),
                password: $('#login-password').value,
                role: state.loginRole
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not sign in.');
        await showApp(result);
    } catch (error) {
        $('#login-error').textContent = error.message;
        $('#login-error').hidden = false;
    } finally {
        button.disabled = false;
    }
});

$('#logout-button').addEventListener('click', async () => {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': state.csrfToken }
        });
    } finally {
        showLogin();
    }
});

fetch('/auth/me', { credentials: 'same-origin' })
    .then(async (response) => response.ok ? showApp(await response.json()) : showLogin())
    .catch(() => showLogin());

fetch('/auth/config')
    .then((response) => response.json())
    .then((config) => { $('.demo-help').hidden = !config.demoAccess; })
    .catch(() => {});

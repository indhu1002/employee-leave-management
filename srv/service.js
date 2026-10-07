import cds from '@sap/cds';

const leaveTypes = new Set(['Casual Leave', 'Sick Leave', 'Annual Leave']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export default function () {
    const { Employees, LeaveRequests } = this.entities;

    this.before('READ', Employees, (req) => {
        if (req.user.is('Manager')) return;
        req.query.where({ ID: req.user.attr.employeeId });
    });

    this.before('READ', LeaveRequests, (req) => {
        if (req.user.is('Manager')) return;
        req.query.where({ employee_ID: req.user.attr.employeeId });
    });

    this.before('CREATE', LeaveRequests, async (req) => {
        if (!req.user.is('Employee') || !req.user.attr.employeeId) {
            return req.reject(403, 'Only employees can submit leave requests.');
        }
        const data = req.data;
        data.employee_ID = req.user.attr.employeeId;
        const employee = await cds.run(SELECT.one.from(Employees).where({ ID: data.employee_ID }));
        if (!employee) {
            return req.reject(400, 'The selected employee does not exist.');
        }
        if (!leaveTypes.has(data.leaveType)) {
            return req.reject(400, 'Choose a valid leave type.');
        }
        if (!datePattern.test(data.fromDate || '') || !datePattern.test(data.toDate || '') ||
            data.fromDate > data.toDate) {
            return req.reject(400, 'Enter a valid date range.');
        }
        if (!data.reason || !data.reason.trim()) {
            return req.reject(400, 'Enter a reason.');
        }
        data.reason = data.reason.trim();
        data.status = 'Pending';
    });

    this.before('UPDATE', LeaveRequests, async (req) => {
        if (!req.user.is('Manager')) {
            return req.reject(403, 'Only managers can approve or reject requests.');
        }
        const changes = Object.keys(req.data).filter((key) => key !== 'ID');
        if (changes.length !== 1 || changes[0] !== 'status' ||
            !['Approved', 'Rejected'].includes(req.data.status)) {
            return req.reject(400, 'Only approval or rejection is allowed.');
        }
        const existing = await cds.run(SELECT.one.from(LeaveRequests).where({ ID: req.data.ID }));
        if (!existing || existing.status !== 'Pending') {
            return req.reject(400, 'Only pending requests can be updated.');
        }
    });

    this.before('DELETE', LeaveRequests, (req) => {
        req.reject(405, 'Leave requests cannot be deleted.');
    });
}

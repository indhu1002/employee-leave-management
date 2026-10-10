import assert from 'node:assert/strict';
import cds from '@sap/cds';
import { repairDemoProfileEmails } from '../lib/demo-profile-emails.mjs';

const { SELECT, INSERT, UPDATE } = cds.ql;
const model = await cds.load('db/schema.cds');
const db = await cds.deploy(model, {}, []).to('sqlite::memory:');
try {
    await db.run(INSERT.into('my.company.leave.Employees').entries([
        { ID: 1, name: 'Rahul', email: 'rahul@gmail.com' },
        { ID: 2, name: 'Priya', email: 'priya@gmail.com' },
        { ID: 3, name: 'Another employee', email: 'other@example.com' }
    ]));
    await db.run(INSERT.into('my.company.leave.LeaveRequests').entries({
        ID: '00000000-0000-4000-8000-000000000001', employee_ID: 2,
        status: 'Approved', reason: 'Preserve this request'
    }));
    assert.equal(await repairDemoProfileEmails(db), 2);
    assert.equal(await repairDemoProfileEmails(db), 0);
    const rows = await db.run(SELECT.from('my.company.leave.Employees').orderBy('ID'));
    assert.deepEqual(rows.map(row => row.email), ['rahul@company.com', 'priya@company.com', 'other@example.com']);
    const leaves = await db.run(SELECT.from('my.company.leave.LeaveRequests'));
    assert.equal(leaves.length, 1);
    assert.equal(leaves[0].status, 'Approved');
    assert.equal(leaves[0].reason, 'Preserve this request');
    await db.run(UPDATE('my.company.leave.Employees').set({ email: 'custom@example.com' }).where({ ID: 2 }));
    assert.equal(await repairDemoProfileEmails(db), 0);
    const custom = await db.run(SELECT.one.from('my.company.leave.Employees').where({ ID: 2 }));
    assert.equal(custom.email, 'custom@example.com');
    console.log('PASS: sample emails corrected; repeat run and custom profiles safe; leave records preserved.');
} finally {
    await db.disconnect();
}

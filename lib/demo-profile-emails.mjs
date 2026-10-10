import cds from '@sap/cds';

const { UPDATE } = cds.ql;

// Correct only the original sample profiles; preserve custom employee records.
export async function repairDemoProfileEmails(db) {
    return db.tx(async (tx) => {
        let changed = 0;
        for (const [ID, name, oldEmail, email] of [
            [1, 'Rahul', 'rahul@gmail.com', 'rahul@company.com'],
            [2, 'Priya', 'priya@gmail.com', 'priya@company.com']
        ]) {
            changed += await tx.run(
                UPDATE('my.company.leave.Employees')
                    .set({ email })
                    .where({ ID, name, email: oldEmail })
            );
        }
        return changed;
    });
}

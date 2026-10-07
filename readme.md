# Employee Leave Management

A SAP CAP leave service with separate employee and manager workspaces. The browser UI uses the CAP OData API and local assets; it does not need a CDN.

###  Live url-  https://employee-leave-management-grth.onrender.com/

## Run locally

For free online hosting with Render and Neon, see [DEPLOYMENT.md](DEPLOYMENT.md). Local development uses SQLite; production uses PostgreSQL configured through `DATABASE_URL`.

Open PowerShell in the project folder containing `package.json`:

```powershell
cd 'C:\Users\narasimha\Downloads\employee-leave-management\SAP\employee-leave-management'
npm ci
npm start
```

Open <http://localhost:4004/leave-management/webapp/index.html>.

### Demo sign-in

| Account type | Name | Email | Password |
| --- | --- | --- | --- |
| Employee | Indu | `indhudande@company.com` | `Employee@123!` |
| Employee | Rahul | `rahul@company.com` | `Employee@123!` |
| Employee | Priya | `priya@company.com` | `Employee@123!` |
| Manager | Asha Menon | `manager@company.com` | `Manager@123!` |

The development database is `db.sqlite` in the project folder. On its first start, the app creates this database and imports the CSV files from `db/data`. Subsequent starts use the existing database without reimporting the CSV files.

## Which files do I edit to add a user?

| File or setting | What to change |
| --- | --- |
| `srv/auth.cjs` | Add a local login account to the `demoAccounts` array. |
| `db/data/my.company.leave-Employees.csv` | Add the employee profile for new database installations. |
| Existing `db.sqlite` | Insert the employee profile into the current database as described below. |
| `app/leave-management/webapp/index.html` | Optional: update the visible demo login details. This does not create accounts. |
| `AUTH_USERS_JSON` environment variable | Configure accounts when this variable is in use, including production. It replaces the entire `demoAccounts` list. |

There is currently no Add Employee or Add Manager form in the website. Follow the steps below to add accounts manually.

## 1. Generate a password salt and hash

Do this once for each new employee or manager. Passwords are verified using scrypt; do not put a plain password in the account's `hash` field.

Run the following in PowerShell. The prompt hides the password and keeps it out of the command text:

```powershell
$accountPassword = Read-Host 'Enter the new account password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($accountPassword)
try {
    $env:LEAVE_SETUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    node -e "const c=require('node:crypto'); const salt=c.randomBytes(16).toString('hex'); const hash=c.scryptSync(process.env.LEAVE_SETUP_PASSWORD,salt,64).toString('hex'); console.log(JSON.stringify({salt,hash},null,2));"
} finally {
    Remove-Item Env:\LEAVE_SETUP_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $accountPassword.Dispose()
}
```

Copy the generated `salt` and `hash` into the new account entry. Give the password privately to the person who will sign in.

## 2. Add an employee

The following example adds **Kavya**. Replace the example details with the actual employee details.

### A. Add the login account

Open `srv/auth.cjs`. Inside `const demoAccounts = [ ... ];`, add:

```js
{
    id: 'kavya',
    email: 'kavya@company.com',
    name: 'Kavya',
    role: 'Employee',
    employeeId: 12,
    salt: 'PASTE_GENERATED_SALT_HERE',
    hash: 'PASTE_GENERATED_HASH_HERE'
},
```

- Use a unique account `id`, email address, and employee ID.
- The employee ID must be a positive integer and must match the database profile's `ID`.
- IDs 1 through 11 are already present in the supplied data; Indu uses 11. Check your current database before using 12 or any later number.
- Keep the role exactly `Employee`, including capitalization.
- Separate account entries with commas. Do not replace existing accounts.

### B. Add the employee to the CSV seed file

Open `db/data/my.company.leave-Employees.csv` and add this row below the header:

```csv
12,Kavya,kavya@company.com,IT,Developer
```

The columns are:

```csv
ID,name,email,department,jobTitle
```

Keep only one header row. Quote any field containing a comma, for example `"Engineering, Platform"`.

### C. Add the employee to the existing database

**If `db.sqlite` already exists, editing the CSV is not enough.** Do not delete or recreate the database: it contains existing leave requests and decisions.

If there is no database yet, skip this step; the next start imports the CSV.

For an existing database:

1. Stop the app with `Ctrl+C` in its server terminal. Close any other processes using this database.
2. Back up the database using the commands below.
3. Run the insert command from the project folder. It uses Node.js's built-in SQLite module, available in the project's Node.js 22.17 environment. An experimental SQLite warning may appear.

```powershell
$employeeBackup = Join-Path 'work' ('database-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $employeeBackup -Force | Out-Null
foreach ($databaseFile in @('db.sqlite', 'db.sqlite-wal', 'db.sqlite-shm')) {
    if (Test-Path -LiteralPath $databaseFile) {
        Copy-Item -LiteralPath $databaseFile -Destination $employeeBackup
    }
}
```

The command below inserts the same employee used in the examples. Edit the `employee` values to match your new account and CSV row before running it:

```powershell
@'
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const employee = {
    ID: 12,
    name: 'Kavya',
    email: 'kavya@company.com',
    department: 'IT',
    jobTitle: 'Developer'
};
if (!fs.existsSync('db.sqlite')) {
    throw new Error('No existing db.sqlite. Start the app to import the CSV instead.');
}
const db = new DatabaseSync('db.sqlite');
try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare(
        'SELECT ID FROM my_company_leave_Employees WHERE ID = ? OR lower(email) = lower(?)'
    ).get(employee.ID, employee.email);
    if (existing) throw new Error('This employee ID or email already exists.');
    db.prepare(
        'INSERT INTO my_company_leave_Employees (ID, name, email, department, jobTitle) VALUES (?, ?, ?, ?, ?)'
    ).run(employee.ID, employee.name, employee.email, employee.department, employee.jobTitle);
    db.exec('COMMIT');
    console.log('Employee added:', employee.name);
} catch (error) {
    db.exec('ROLLBACK');
    throw error;
} finally {
    db.close();
}
'@ | node
```

This command only inserts the employee profile. It does not create the login account or update the CSV; complete steps A and B too. Store database backups privately and exclude them from Git.

### D. Restart and verify

```powershell
npm start
```

Choose **Employee** on the login page, enter the new email and the password you generated, and sign in. Check that the welcome message shows the correct name. A newly created employee starts with no leave requests. The employee can submit requests but cannot approve or reject them.

## 3. Add a manager

Generate a fresh salt and password hash using section 1. Then add this entry inside `demoAccounts` in `srv/auth.cjs`:

```js
{
    id: 'manager-vikram',
    email: 'vikram@company.com',
    name: 'Vikram',
    role: 'Manager',
    employeeId: null,
    salt: 'PASTE_GENERATED_SALT_HERE',
    hash: 'PASTE_GENERATED_HASH_HERE'
},
```

- Replace Vikram's example details with the actual manager details.
- Use a unique account ID and email address.
- Keep the role exactly `Manager` and use the JavaScript value `null` for `employeeId`, without quotes.
- A manager-only login does not need a row in the Employees CSV or database.
- All managers currently have access to all employees and requests; there is no team-specific manager assignment.
- Managers can approve or reject pending requests. They cannot submit leave requests through this service.

Restart the app, select **Manager** on the login page, and sign in with the new credentials. Confirm the manager workspace and pending approvals are visible.

## 4. Adding accounts when deployed

When `AUTH_USERS_JSON` is set, the app uses its account array instead of `demoAccounts`. Production startup requires this variable.

In your hosting dashboard, edit the `AUTH_USERS_JSON` secret/environment variable:

1. Keep all existing accounts that should retain access.
2. Append the employee or manager account with the same fields shown above.
3. Use valid JSON: double-quoted property names and strings, no comments, and no trailing commas. The value must be an array enclosed in `[` and `]`.
4. Use generated salt and hash values, not placeholders or plain passwords.
5. For an employee, also insert the matching profile into the database used by the deployed app. The local SQLite command above is only for the current local database.
6. Restart or redeploy so the app loads the new account list.

Changing the local `demoAccounts` list does not change accounts supplied through `AUTH_USERS_JSON`. Do not commit deployment secrets or actual user passwords to Git.

## 5. Display order and demo login details

- Put an entry at the beginning of `demoAccounts` to list it first in that source array. This alone does not change the website's employee table order.
- `app/leave-management/webapp/app.js`, in `loadData()`, currently sorts Indu (`indhudande@company.com`) to the top of the manager's employee list. Other employees retain the name order returned by the API. Change that preferred email if a different employee should appear first, or remove that sort to keep everyone in name order.
- Optional: update the **Demo account details** section in `app/leave-management/webapp/index.html`. This is display text only. Do not add actual production passwords to the page.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Incorrect email, password, or account type | Select the right login tab; verify email, role, salt, and hash; restart the app after editing accounts. |
| New account is ignored | Check whether `AUTH_USERS_JSON` is set; it overrides the local account list. |
| Login works, but applying for leave says the employee does not exist | Insert the matching employee profile into the existing database; the CSV alone does not update it. |
| Employee ID or email already exists | Check existing profiles and choose an unused ID/email. Do not overwrite another employee's ID. |
| Syntax error after editing `auth.cjs` | Check commas, braces, and quotes. Run `node --check srv/auth.cjs`. |
| Manager is absent from the employee directory | Manager-only accounts have no employee profile and do not appear in that directory. |
| Too many login attempts | Wait 15 minutes after five failed attempts before trying again. |

## Roles and security

- Employees can see only their own leave requests and submit new requests. The server assigns the employee ID from the authenticated session.
- Managers can see all requests and employees, and approve or reject pending requests.
- Anonymous API requests are rejected. Approval authorization and employee row filtering are enforced on the server.
- Sign-in creates an eight-hour, HttpOnly, SameSite cookie session. State-changing API calls require a CSRF token. Login attempts are rate limited.

Sessions are held in memory, so users must sign in again after a server restart. For deployment across multiple app instances, use a shared session store or an external identity provider. Use a managed identity provider and managed database for a production deployment.

## Assets

The office header image was generated for this project. The bundled SAP 72 font files come from [SAP theming-base-content](https://github.com/SAP/theming-base-content) under Apache License 2.0; the license is included in `app/leave-management/webapp/assets/SAP-72-LICENSE.txt`.

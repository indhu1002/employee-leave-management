import cds from '@sap/cds';

export function configureDatabase() {
    if (process.env.NODE_ENV !== 'production') return;
    if (!process.env.DATABASE_URL) {
        throw new Error('Set DATABASE_URL to your PostgreSQL connection string before starting in production.');
    }
    let url;
    try { url = new URL(process.env.DATABASE_URL); }
    catch { throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) {
        throw new Error('DATABASE_URL must include a PostgreSQL host, username and database name.');
    }
    // Pass fields explicitly: the CAP adapter does not consume a connectionString credential.
    // Always verify the server certificate for the hosted database.
    cds.env.requires.db.credentials = {
        host: url.hostname,
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.slice(1)),
        ssl: { rejectUnauthorized: true }
    };
}

export async function initializeCloudDatabase() {
    const db = await cds.connect.to('db');
    const [state] = await db.run("SELECT to_regclass('public.cds_model') AS deployed");
    if (!state.deployed) {
        // First deployment only. Subsequent starts must not reset seeded leave decisions.
        await cds.deploy('*', { schema_evolution: 'auto' }).to(db);
    }
}

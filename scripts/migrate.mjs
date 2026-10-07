import cds from '@sap/cds';
import { configureDatabase } from '../lib/database.mjs';

if (process.env.NODE_ENV !== 'production') {
    throw new Error('This command is for PostgreSQL. Set NODE_ENV=production and DATABASE_URL.');
}
await cds.plugins;
configureDatabase();
try {
    // An empty data source list prevents seed CSVs from overwriting live records.
    await cds.deploy('*', { schema_evolution: 'auto' }, []).to('db');
    console.log('PostgreSQL schema updated without reimporting seed data.');
} finally {
    await cds.db?.disconnect();
}

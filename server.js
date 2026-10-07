import cds from '@sap/cds';
import sessionAuth from './srv/auth.cjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { configureDatabase, initializeCloudDatabase } from './lib/database.mjs';

configureDatabase();

cds.on('bootstrap', (app) => {
    if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
    app.get('/', (_req, res) => res.redirect('/leave-management/webapp/index.html'));
    app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
    sessionAuth.registerRoutes(app);
});

export default async function start(options) {
    if (process.env.NODE_ENV === 'production') {
        await initializeCloudDatabase();
        return cds.server(options);
    }
    const databasePath = resolve(cds.root, 'db.sqlite');
    if (!existsSync(databasePath)) {
        await cds.deploy('*').to(`sqlite:${databasePath}`);
    }
    return cds.server(options);
}

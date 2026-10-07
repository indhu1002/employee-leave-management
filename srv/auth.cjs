const cds = require('@sap/cds');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const SESSION_MS = 8 * 60 * 60 * 1000;
const ATTEMPT_MS = 15 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();

const demoAccounts = [
    {
        id: 'indu', email: 'indhudande@company.com', name: 'Indu', role: 'Employee', employeeId: 11,
        salt: '5dc83d4b8c1d11bc6a4ba892f700b16b',
        hash: '4442a61ff3344b1be79b71a63632d219bf7c30de1acefcc7466ee2b4d9631ca3bf871b5167c00dfb50d290b23cb6f47553168f1344479a37846ad5bd777d0e6b'
    },
    {
        id: 'rahul', email: 'rahul@company.com', name: 'Rahul', role: 'Employee', employeeId: 1,
        salt: '2f347d4bb2db9d892bd3846af45e2541',
        hash: '313af68417b00e76fa86b4a0f40886a768e6659feeaa69565291bfdcc1f86052ce587722ae29879dc8ab52b7ad5abfe616ad253fe8100013f88723f563fec238'
    },
    {
        id: 'priya', email: 'priya@company.com', name: 'Priya', role: 'Employee', employeeId: 2,
        salt: '91b253dad7447d4c7ada47415abe011d',
        hash: '3fb1e39e5a5c53cba3fc146560c3f3f91ee5e1cfeff50f52d7bec128a6988ef453ea2477d4fa7030c38158515d257ba63224fdf22a902f60a508786adbf40dbd'
    },
    {
        id: 'manager', email: 'manager@company.com', name: 'Asha Menon', role: 'Manager', employeeId: null,
        salt: 'ae176f21e5b3832a5cce33c5982be399',
        hash: 'a83deefba497582542a6c61d75932b66641d22d67d81641d5ffabd29504e8322d08a18c6fbd72cf19220111fca5fefd225b2b96f46e68254f55fa1b1f2fa8aa8'
    }
];

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_USERS_JSON) {
    throw new Error('Configure AUTH_USERS_JSON before starting in production.');
}
const accounts = process.env.AUTH_USERS_JSON ? JSON.parse(process.env.AUTH_USERS_JSON) : demoAccounts;

function publicUser(account) {
    return { id: account.id, name: account.name, email: account.email, role: account.role, employeeId: account.employeeId };
}

function sessionFor(req) {
    const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('leave_session='));
    if (!cookie) return null;
    const session = sessions.get(cookie.slice('leave_session='.length));
    if (!session) return null;
    if (session.expires < Date.now()) {
        sessions.delete(cookie.slice('leave_session='.length));
        return null;
    }
    return session;
}

function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function validCsrf(req, session) {
    const supplied = req.headers['x-csrf-token'];
    if (typeof supplied !== 'string' || !sameOrigin(req)) return false;
    const actual = Buffer.from(session.csrf);
    const candidate = Buffer.from(supplied);
    return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}

function clearCookie(req) {
    return 'leave_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (req.secure ? '; Secure' : '');
}

function setCookie(req, token) {
    return `leave_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}` + (req.secure ? '; Secure' : '');
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let oversized = false;
        req.on('data', (chunk) => {
            if (oversized) return;
            body += chunk;
            if (body.length > 4096) {
                oversized = true;
                reject(new Error('Request body is too large.'));
            }
        });
        req.on('end', () => {
            if (oversized) return;
            try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON.')); }
        });
        req.on('error', reject);
    });
}

function registerRoutes(app) {
    app.get('/auth/config', (_req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({ demoAccess: !process.env.AUTH_USERS_JSON });
    });

    app.get('/auth/me', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const session = sessionFor(req);
        if (!session) return res.status(401).json({ error: 'Sign in to continue.' });
        res.json({ user: publicUser(session.account), csrfToken: session.csrf });
    });

    app.post('/auth/login', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
        let data;
        try { data = await readJson(req); } catch (error) { return res.status(400).json({ error: error.message }); }
        const email = String(data.email || '').trim().toLowerCase();
        const password = String(data.password || '');
        const role = String(data.role || '');
        const key = `${req.ip}:${email}`;
        const attempt = attempts.get(key);
        if (attempt && attempt.until > Date.now() && attempt.count >= 5) {
            return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
        }
        const account = accounts.find((item) => item.email.toLowerCase() === email && item.role === role);
        const expected = Buffer.from(account?.hash || demoAccounts[0].hash, 'hex');
        const candidate = scryptSync(password, account?.salt || demoAccounts[0].salt, expected.length);
        const valid = account && timingSafeEqual(expected, candidate);
        if (!valid) {
            attempts.set(key, { count: (attempt?.until > Date.now() ? attempt.count : 0) + 1, until: Date.now() + ATTEMPT_MS });
            return res.status(401).json({ error: 'Incorrect email, password, or account type.' });
        }
        attempts.delete(key);
        const token = randomBytes(32).toString('hex');
        const csrf = randomBytes(32).toString('hex');
        sessions.set(token, { account, csrf, expires: Date.now() + SESSION_MS });
        res.setHeader('Set-Cookie', setCookie(req, token));
        res.json({ user: publicUser(account), csrfToken: csrf });
    });

    app.post('/auth/logout', (req, res) => {
        const session = sessionFor(req);
        if (!session || !validCsrf(req, session)) return res.status(403).json({ error: 'Invalid session.' });
        const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('leave_session='));
        sessions.delete(token.slice('leave_session='.length));
        res.setHeader('Set-Cookie', clearCookie(req));
        res.set('Cache-Control', 'no-store');
        res.json({ signedOut: true });
    });
}

function capAuth() {
    return function authenticate(req, res, next) {
        const session = sessionFor(req);
        if (!session) return res.status(401).json({ error: { message: 'Sign in to continue.' } });
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !validCsrf(req, session)) {
            return res.status(403).json({ error: { message: 'Invalid security token.' } });
        }
        req.user = new cds.User({
            id: session.account.id,
            roles: [session.account.role],
            attr: { employeeId: session.account.employeeId }
        });
        cds.context.user = req.user;
        next();
    };
}

module.exports = capAuth;
module.exports.registerRoutes = registerRoutes;

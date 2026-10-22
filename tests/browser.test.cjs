const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { spawn } = require('node:child_process');
const http = require('node:http');
const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
const chrome = candidates.find(file => fs.existsSync(file));
test('browser DOM fixtures for Chess.com and Lichess', { skip: !chrome && 'Set CHROME_PATH to run DOM fixtures', timeout: 30000 }, () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-alert-dom-'));
    try {
        const run = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--allow-file-access-from-files', `--user-data-dir=${profile}`,
            '--dump-dom', pathToFileURL(path.join(__dirname, 'browser.html')).href], { encoding: 'utf8', timeout: 25000 });
        assert.ifError(run.error);
        assert.equal(run.status, 0, run.stderr);
        assert.match(run.stdout, /<pre id="result">PASS 9 DOM checks<\/pre>/, run.stdout + run.stderr);
    } finally {
        // Only the fresh, explicitly named temporary profile belongs to this test.
        const resolved = path.resolve(profile);
        const parent = path.resolve(os.tmpdir());
        if (path.dirname(resolved) === parent && path.basename(resolved).startsWith('chess-alert-dom-')) {
            fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    }
});

const firefox = process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe';
for (const page of [
    { name: 'site DOM', url: '/tests/browser.html', result: 'PASS 9 DOM checks' },
    { name: 'popup', url: '/popup/popup.html', result: 'PASS 19 popup checks' },
    { name: 'preset lifecycle and overflow', url: '/popup/popup.html?presets=1', result: /^PASS \d+ preset checks$/, script: 'presets-fixtures', size: '390,400' },
    { name: 'Quiet Mint alerts layout', url: '/popup/popup.html?layout=alerts', result: 'PASS Quiet Mint layout', layout: 'alerts' },
    { name: 'Quiet Mint settings layout', url: '/popup/popup.html?layout=settings', result: 'PASS Quiet Mint layout', layout: 'settings' },
    { name: 'Quiet Mint preset editor layout', url: '/popup/popup.html?layout=preset', result: 'PASS Quiet Mint layout', layout: 'preset' }
]) test(`Firefox ${page.name} fixtures`, { skip: !fs.existsSync(firefox), timeout: 30000 }, async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-alert-firefox-'));
    let processHandle, report, resolveReport;
    const heldLoads = [];
    const reported = new Promise(resolve => { resolveReport = resolve; });
    const allowed = new Map([
        ['/tests/browser.html', ['tests/browser.html', 'text/html']],
        ['/tests/browser-fixtures.js', ['tests/browser-fixtures.js', 'application/javascript']],
        ['/core.js', ['core.js', 'application/javascript']], ['/sites.js', ['sites.js', 'application/javascript']],
        ['/settings.js', ['settings.js', 'application/javascript']],
        ['/popup/popup.html', ['popup/popup.html', 'text/html']],
        ['/popup/popup.js', ['popup/popup.js', 'application/javascript']],
        ['/popup/popup.css', ['popup/popup.css', 'text/css']],
        ['/popup/fonts/material-symbols-outlined.woff2', ['popup/fonts/material-symbols-outlined.woff2', 'font/woff2']],
        ['/tests/popup-mock.js', ['tests/popup-mock.js', 'application/javascript']],
        ['/tests/popup-fixtures.js', ['tests/popup-fixtures.js', 'application/javascript']],
        ['/tests/popup-layout.js', ['tests/popup-layout.js', 'application/javascript']],
        ['/tests/presets-fixtures.js', ['tests/presets-fixtures.js', 'application/javascript']]
    ]);
    const server = http.createServer((request, response) => {
        // Keep page load open until asynchronous checks finish, so --screenshot cannot exit before their report.
        if (request.url === '/__hold') {
            if (report) { response.writeHead(204); response.end(); }
            else heldLoads.push(response);
            return;
        }
        if (request.url === '/__result' && request.method === 'POST') {
            let body = '';
            request.on('data', chunk => body += chunk);
            request.on('end', () => {
                report = body; response.end('OK');
                heldLoads.forEach(load => { load.writeHead(204); load.end(); }); resolveReport();
            });
            return;
        }
        const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
        const entry = allowed.get(pathname);
        if (!entry) { response.writeHead(404); response.end(); return; }
        response.setHeader('Content-Type', entry[1]);
        let body = fs.readFileSync(path.join(__dirname, '..', entry[0]));
        if (entry[1] !== 'font/woff2') body = body.toString('utf8');
        if (pathname === '/popup/popup.html') body = body.replace('<head>', '<head><script src="/tests/popup-mock.js"></script>')
            .replace('</body>', `<script src="/tests/${page.script || (page.layout ? 'popup-layout' : 'popup-fixtures')}.js"></script></body>`);
        if (entry[1] === 'text/html') body += '<img src="/__hold" hidden alt="">';
        response.end(body);
    });
    let timer;
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const url = `http://127.0.0.1:${server.address().port}${page.url}`;
        processHandle = spawn(firefox, ['--headless', '--no-remote', '--profile', profile,
            '--screenshot', path.join(profile, 'fixtures.png'), '--window-size', page.size || (page.layout ? '390,600' : '900,700'), url], { stdio: 'ignore' });
        const exited = new Promise((resolve, reject) => {
            processHandle.on('error', reject);
            processHandle.on('exit', code => code === 0 ? resolve() : reject(new Error(`Firefox exited ${code}`)));
        });
        await Promise.race([Promise.all([reported, exited]), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Firefox fixture timeout')), 25000);
        })]);
        if (page.result instanceof RegExp) assert.match(report, page.result);
        else assert.equal(report, page.result);
        assert.ok(fs.existsSync(path.join(profile, 'fixtures.png')));
        if (page.layout) {
            const previewDir = path.join(__dirname, '..', 'dist', 'previews');
            fs.mkdirSync(previewDir, { recursive: true });
            fs.copyFileSync(path.join(profile, 'fixtures.png'), path.join(previewDir, `quiet-mint-${page.layout}.png`));
        }
    } finally {
        clearTimeout(timer);
        if (processHandle && processHandle.exitCode === null) processHandle.kill();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        const resolved = path.resolve(profile);
        if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('chess-alert-firefox-')) {
            fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    }
});

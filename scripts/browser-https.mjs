// Local test server only. WebKit correctly refuses Secure cookies over HTTP;
// exercise the real cookie policy over TLS, without installing a trusted CA.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:https';
import { connect } from 'node:net';
import path from 'node:path';

const directory = path.resolve('data/e2e-tls');
mkdirSync(directory, { recursive: true });
const key = path.join(directory, 'key.pem');
const cert = path.join(directory, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=localhost'], { stdio: 'ignore' });
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '-p', '47105'], {
  stdio: 'inherit', env: { ...process.env, PGLITE_DATA_DIR: 'data/e2e-devices' },
});
const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (incoming, outgoing) => {
  const upstream = request({ hostname: '127.0.0.1', port: 47105, path: incoming.url, method: incoming.method,
    headers: { ...incoming.headers, 'x-forwarded-proto': 'https' },
  }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
  incoming.pipe(upstream);
});
// Next's development client waits for its HMR connection before hydration.
// Forward that local WebSocket too; production browser checks do not use HMR.
const upgraded = new Set();
server.on('upgrade', (incoming, socket, head) => {
  const upstream = connect(47105, '127.0.0.1', () => {
    const headers = incoming.rawHeaders.reduce((lines, value, index, all) => index % 2 ? lines : [...lines, `${value}: ${all[index + 1]}`], []);
    upstream.write([`${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}`, ...headers, '', ''].join('\r\n'));
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upgraded.add(socket);
  socket.on('close', () => { upgraded.delete(socket); upstream.destroy(); });
  socket.on('error', () => upstream.destroy());
  upstream.on('error', () => socket.destroy());
});
server.listen(47104, 'localhost');
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  server.closeAllConnections();
  for (const socket of upgraded) socket.destroy();
  child.kill('SIGTERM');
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => { stop(); process.exitCode = code ?? 0; });

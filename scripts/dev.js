const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('Hãy chạy lệnh này bằng "npm run dev".');
  process.exit(1);
}

const server = spawn(process.execPath, ['server/server.js'], {
  cwd: root,
  stdio: 'inherit',
});
const client = spawn(process.execPath, [npmCli, '--prefix', 'client', 'run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
});

function stop() {
  server.kill();
  client.kill();
}

server.on('exit', (code) => {
  client.kill();
  process.exitCode = code ?? 0;
});
client.on('exit', (code) => {
  server.kill();
  process.exitCode = code ?? 0;
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

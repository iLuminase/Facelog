import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function findLanAddress() {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);

  return (
    addresses.find((address) => address.startsWith('192.168.22.')) ??
    addresses.find((address) => /^192\.168\./.test(address)) ??
    addresses.find((address) => /^10\./.test(address)) ??
    addresses.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address)) ??
    addresses[0]
  );
}

const host = process.env.DEV_HTTPS_HOST || findLanAddress();

if (!host) {
  console.error('Không tìm thấy IP LAN. Đặt DEV_HTTPS_HOST rồi chạy lại, ví dụ:');
  console.error('$env:DEV_HTTPS_HOST="192.168.1.10"; npm run dev:https');
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const nextBinary = path.resolve(scriptDirectory, '..', 'node_modules', 'next', 'dist', 'bin', 'next');

console.log(`Frontend HTTPS: https://${host}:3000`);
console.log('Lần chạy đầu có thể yêu cầu quyền cài CA phát triển.');

const child = spawn(
  process.execPath,
  [nextBinary, 'dev', '--hostname', host, '--port', '3000', '--experimental-https'],
  { stdio: 'inherit', env: process.env }
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

import { networkInterfaces } from 'node:os';
import { homedir } from 'node:os';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { isIP } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mkcertVersion = 'v1.4.4';

function getMkcertPaths() {
  const architecture = process.arch === 'x64' ? 'amd64' : process.arch;
  const platformNames = { win32: 'windows', darwin: 'darwin', linux: 'linux' };
  const platformName = platformNames[process.platform];
  if (!platformName) throw new Error(`Hệ điều hành ${process.platform} chưa được hỗ trợ để tạo HTTPS certificate.`);

  const binaryName = `mkcert-${mkcertVersion}-${platformName}-${architecture}${process.platform === 'win32' ? '.exe' : ''}`;
  const systemCache = process.platform === 'win32'
    ? (process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'))
    : process.platform === 'darwin'
      ? path.join(homedir(), 'Library', 'Caches')
      : (process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'));
  const cacheDirectory = path.join(systemCache, 'mkcert');
  return {
    binaryName,
    binaryPath: path.join(cacheDirectory, binaryName),
    cacheDirectory,
    rootCAPath: path.join(cacheDirectory, 'rootCA.pem')
  };
}

async function downloadMkcert(binaryPath, binaryName, cacheDirectory) {
  if (existsSync(binaryPath)) return;
  mkdirSync(cacheDirectory, { recursive: true });
  console.log('Đang tải mkcert để tạo certificate phát triển...');
  const url = `https://github.com/FiloSottile/mkcert/releases/download/${mkcertVersion}/${binaryName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không thể tải mkcert (${response.status}).`);
  writeFileSync(binaryPath, Buffer.from(await response.arrayBuffer()));
  if (process.platform !== 'win32') chmodSync(binaryPath, 0o755);
}

function certificateMatchesHost(certPath, keyPath, host) {
  if (!existsSync(certPath) || !existsSync(keyPath)) return false;
  try {
    const certificate = new X509Certificate(readFileSync(certPath));
    const privateKey = createPrivateKey(readFileSync(keyPath));
    const identity = isIP(host) ? certificate.checkIP(host) : certificate.checkHost(host);
    return Boolean(identity) && certificate.checkPrivateKey(privateKey);
  } catch {
    return false;
  }
}

async function ensureCertificate(host, frontendDirectory) {
  const certificateDirectory = path.join(frontendDirectory, 'certificates');
  const keyPath = path.join(certificateDirectory, 'localhost-key.pem');
  const certPath = path.join(certificateDirectory, 'localhost.pem');
  const mkcert = getMkcertPaths();
  mkdirSync(certificateDirectory, { recursive: true });

  await downloadMkcert(mkcert.binaryPath, mkcert.binaryName, mkcert.cacheDirectory);

  if (!existsSync(mkcert.rootCAPath)) {
    console.log('Lần chạy đầu cần cài CA phát triển. Hệ điều hành có thể yêu cầu xác nhận quyền.');
    const install = spawnSync(mkcert.binaryPath, ['-install'], { stdio: 'inherit' });
    if (install.error || !existsSync(mkcert.rootCAPath)) {
      throw install.error || new Error('Không thể tạo CA phát triển bằng mkcert.');
    }
    if (install.status !== 0) {
      console.warn('mkcert không cài được CA vào một trust store phụ; tiếp tục dùng CA đã tạo cho trình duyệt hệ thống.');
    }
  }

  if (!certificateMatchesHost(certPath, keyPath, host)) {
    console.log(`Đang tạo HTTPS certificate cho ${host}...`);
    const generate = spawnSync(mkcert.binaryPath, [
      '-key-file', keyPath,
      '-cert-file', certPath,
      'localhost', '127.0.0.1', '::1', host
    ], { stdio: 'inherit' });
    if (generate.error || generate.status !== 0) {
      throw generate.error || new Error(`mkcert kết thúc với mã lỗi ${generate.status}.`);
    }
  }

  return { keyPath, certPath, rootCAPath: mkcert.rootCAPath };
}

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
const frontendDirectory = path.resolve(scriptDirectory, '..');
const nextBinary = path.join(frontendDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');

let certificate;
try {
  certificate = await ensureCertificate(host, frontendDirectory);
} catch (error) {
  console.error('Không thể chuẩn bị HTTPS certificate:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Frontend HTTPS: https://${host}:3000`);

const child = spawn(
  process.execPath,
  [
    nextBinary, 'dev', '--hostname', host, '--port', '3000', '--experimental-https',
    '--experimental-https-key', certificate.keyPath,
    '--experimental-https-cert', certificate.certPath,
    '--experimental-https-ca', certificate.rootCAPath
  ],
  { stdio: 'inherit', env: process.env }
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

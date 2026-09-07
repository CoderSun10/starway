/**
 * 确保 electron 二进制完整。
 * 若 path.txt / electron.exe 缺失，尝试：
 * 1) 官方 install.js
 * 2) 本机 electron / electron-builder 缓存 zip
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createHash } = require('crypto');

const electronRoot = path.join(__dirname, '..', 'node_modules', 'electron');
const distDir = path.join(electronRoot, 'dist');
const pathTxt = path.join(electronRoot, 'path.txt');
const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron';
const exePath = path.join(distDir, exeName);

function ok() {
  return fs.existsSync(exePath) && fs.existsSync(pathTxt);
}

function writePathTxt() {
  fs.writeFileSync(pathTxt, exeName, 'utf8');
}

function tryInstallJs() {
  const installJs = path.join(electronRoot, 'install.js');
  if (!fs.existsSync(installJs)) return false;
  try {
    execSync(`node "${installJs}"`, {
      cwd: electronRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ELECTRON_MIRROR:
          process.env.ELECTRON_MIRROR ||
          'https://npmmirror.com/mirrors/electron/',
      },
    });
  } catch {
    // continue fallback
  }
  return ok();
}

function findCachedZip(version) {
  const name = `electron-v${version}-win32-x64.zip`;
  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache'),
    path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache'),
    path.join(process.env.USERPROFILE || '', '.electron'),
  ];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name === name || e.name.includes('electron-v') && e.name.endsWith('win32-x64.zip')) {
          if (e.name.includes(version) || e.name === name) return p;
        }
      }
    }
  }
  return null;
}

function extractZip(zipPath) {
  fs.mkdirSync(distDir, { recursive: true });
  // 清空不完整 dist（保留也行，expand 覆盖）
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(
        /'/g,
        "''"
      )}' -DestinationPath '${distDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o "${zipPath}" -d "${distDir}"`, { stdio: 'inherit' });
  }
  writePathTxt();
}

function main() {
  if (!fs.existsSync(electronRoot)) {
    console.warn('[ensure-electron] node_modules/electron 不存在，请先 npm install');
    return;
  }
  if (ok()) {
    console.log('[ensure-electron] OK:', exePath);
    return;
  }

  console.log('[ensure-electron] 二进制缺失，尝试修复…');

  if (tryInstallJs()) {
    console.log('[ensure-electron] install.js 成功');
    return;
  }

  let version = '33.4.11';
  try {
    version = JSON.parse(
      fs.readFileSync(path.join(electronRoot, 'package.json'), 'utf8')
    ).version;
  } catch {
    // default
  }

  if (process.platform === 'win32') {
    const zip = findCachedZip(version);
    if (zip) {
      console.log('[ensure-electron] 使用缓存 zip:', zip);
      extractZip(zip);
      if (ok()) {
        console.log('[ensure-electron] 已从缓存恢复');
        return;
      }
    }
  }

  console.error(
    '[ensure-electron] 修复失败。请执行：\n' +
      '  set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/\n' +
      '  npm run fix:electron\n' +
      '或删除 node_modules 后重新 npm install'
  );
  process.exitCode = 1;
}

main();

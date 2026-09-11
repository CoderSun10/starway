/**
 * 开发启动前清理残留的 electron（托盘 / 未退出进程）
 * 避免旧窗口仍开着、新进程秒退，看起来像「改了没生效」
 */
const { execSync } = require('child_process');

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore', windowsHide: true });
  } catch {
    // 没有进程可杀时会报错，忽略
  }
}

if (process.platform === 'win32') {
  // 只杀 electron 开发进程；打包后的「星程.exe」不杀
  run('taskkill /F /IM electron.exe /T');
} else {
  run('pkill -f "electron ." || true');
}

console.log('[dev] cleared leftover electron processes');

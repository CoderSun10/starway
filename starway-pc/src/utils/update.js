/**
 * 检查更新：读 GitHub Releases，和 package.json 里的版本号比。
 * 版本号直接取 package.json，开发和生产都是同一个来源。
 */
import pkg from '../../package.json';

export const GITHUB_REPO = 'CoderSun10/starway';
export const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const API_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export const APP_VERSION = pkg.version || '0.0.0';

/** 'v1.2.3' / '1.2.3-beta.1' → [1,2,3]，解析不了返回 null */
export function parseVersion(input) {
  const s = String(input || '').trim().replace(/^v/i, '');
  const core = s.split(/[-+]/)[0];
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split('.').map(Number);
}

/** remote 比 local 新？ */
export function isNewer(remote, local) {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

function baseName(url) {
  const s = String(url || '');
  const i = s.lastIndexOf('/');
  return i === -1 ? s : s.slice(i + 1);
}

/**
 * 按平台挑安装包。Windows 优先安装版（Setup），其次便携版；
 * Linux 用 .deb。挑不到就退化成发布页链接。
 */
export function pickAssets(assets = [], platform = '') {
  const win = /^win/.test(platform);
  const linux = /^linux/.test(platform);
  const exe = assets.filter((a) => /\.exe$/i.test(a.name || ''));
  const ordered = win
    ? [
        ...exe.filter((a) => /setup|install/i.test(a.name)),
        ...exe.filter((a) => !/setup|install/i.test(a.name)),
        ...assets.filter((a) => /\.msi$/i.test(a.name || '')),
      ]
    : linux
      ? [
          ...assets.filter((a) => /\.deb$/i.test(a.name || '')),
          ...assets.filter((a) => /\.appimage$/i.test(a.name || '')),
        ]
      : [...assets];

  const seen = new Set();
  const unique = ordered.filter((a) => {
    if (!a?.browser_download_url || seen.has(a.browser_download_url)) return false;
    seen.add(a.browser_download_url);
    return true;
  });
  const first = unique[0] || null;
  return {
    recommended: first,
    others: unique.slice(1),
  };
}

/**
 * 取最新 release。
 * 返回 { status, release?, message }：
 *   ok      有可用版本
 *   none    仓库还没有发布
 *   limited 匿名调用次数用尽
 *   offline 网络不通
 *   error   其他
 */
export async function fetchLatestRelease() {
  let res;
  try {
    res = await fetch(API_LATEST, {
      headers: {
        Accept: 'application/vnd.github+json',
        // 不用应用自己的 axios 实例：那个会带上我们的 JWT，不该发给 GitHub
      },
    });
  } catch {
    return { status: 'offline', message: '网络不通，稍后再试' };
  }

  if (res.status === 404) {
    return { status: 'none', message: '这个仓库还没有发布过版本' };
  }
  if (res.status === 403 || res.status === 429) {
    return { status: 'limited', message: '请求过于频繁，过一会儿再试' };
  }
  if (!res.ok) {
    return { status: 'error', message: `GitHub 返回 ${res.status}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { status: 'error', message: '返回内容解析失败' };
  }

  return {
    status: 'ok',
    release: {
      tag: data.tag_name || '',
      name: data.name || data.tag_name || '',
      version: parseVersion(data.tag_name) ? data.tag_name : '',
      publishedAt: data.published_at || '',
      notes: data.body || '',
      pageUrl: data.html_url || RELEASES_PAGE,
      assets: (data.assets || []).map((a) => ({
        name: a.name || baseName(a.browser_download_url),
        size: Number(a.size) || 0,
        url: a.browser_download_url,
        downloads: Number(a.download_count) || 0,
      })),
    },
  };
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

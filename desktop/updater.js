// Checks GitHub Releases for a newer version and, if the user accepts,
// downloads the installer asset for the current platform. On Windows the
// downloaded NSIS installer replaces files itself, so the app just quits and
// hands off to it. macOS has no equivalent silent handoff for a plain (code
// signing is not configured for this project) app, so the .dmg is mounted for
// the user to drag-install instead.

const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const REPO_OWNER = 'hankarun';
const REPO_NAME = 'nodeviewCalibrator';
const RELEASES_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

/**
 * Pull the first x.y.z run out of a version string (tag names are commonly
 * prefixed with "v").
 * @param {string} raw
 * @returns {[number, number, number] | null}
 */
function parseVersion(raw) {
  const match = String(raw).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** @returns {boolean} Whether `remote` is strictly newer than `local`. */
function isNewerVersion(remote, local) {
  for (let i = 0; i < 3; i++) {
    if (remote[i] > local[i]) return true;
    if (remote[i] < local[i]) return false;
  }
  return false;
}

/** @returns {Promise<Object>} The latest release, per the GitHub REST API. */
async function fetchLatestRelease() {
  const response = await fetch(RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }
  return response.json();
}

const PLATFORM_ASSET_PATTERNS = {
  win32: /\.exe$/i,
  darwin: /\.dmg$/i
};

/** @returns {Object|null} The release asset that matches this platform's installer format. */
function findInstallerAsset(release) {
  const pattern = PLATFORM_ASSET_PATTERNS[process.platform];
  if (!pattern) return null;
  const assets = release.assets || [];
  return assets.find((asset) => pattern.test(asset.name)) || null;
}

/**
 * Stream a release asset to a temp file, reporting fractional progress.
 * @param {Object} asset - GitHub release asset
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadInstaller(asset, onProgress) {
  const response = await fetch(asset.browser_download_url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download installer (status ${response.status})`);
  }

  const total = Number(response.headers.get('content-length')) || asset.size || 0;
  const destPath = path.join(os.tmpdir(), asset.name);

  let received = 0;
  const sourceStream = Readable.fromWeb(response.body);
  sourceStream.on('data', (chunk) => {
    received += chunk.length;
    if (onProgress && total) onProgress(received / total);
  });

  await pipeline(sourceStream, fs.createWriteStream(destPath));
  return destPath;
}

/** Hand off to the downloaded Windows installer and exit so it can replace files in use. */
function runInstallerAndQuit(installerPath) {
  spawn(installerPath, [], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

/**
 * Check GitHub Releases for an update and, if the user opts in, download and
 * launch the installer.
 * @param {Object} options
 * @param {Electron.BrowserWindow} [options.window] - Parent for dialogs and taskbar progress
 * @param {boolean} [options.silent] - Suppress "no update available" / error dialogs
 */
async function checkForUpdates({ window, silent = false } = {}) {
  let release;
  try {
    release = await fetchLatestRelease();
  } catch (error) {
    if (!silent) {
      dialog.showErrorBox('Update Check Failed', `Could not check for updates: ${error.message}`);
    }
    return;
  }

  const remoteVersion = parseVersion(release.tag_name);
  const localVersion = parseVersion(app.getVersion());
  const hasUpdate = remoteVersion && localVersion && isNewerVersion(remoteVersion, localVersion);

  if (release.draft || release.prerelease || !hasUpdate) {
    if (!silent) {
      dialog.showMessageBox(window, {
        type: 'info',
        title: 'No Updates',
        message: `You're up to date (v${app.getVersion()}).`
      });
    }
    return;
  }

  const asset = findInstallerAsset(release);
  if (!asset) {
    if (!silent) {
      const { response } = await dialog.showMessageBox(window, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${release.tag_name} is available, but no installer was found for this platform.`,
        detail: 'Open the GitHub releases page to download it manually.',
        buttons: ['Open Releases Page', 'Close'],
        defaultId: 0,
        cancelId: 1
      });
      if (response === 0) shell.openExternal(release.html_url);
    }
    return;
  }

  const { response } = await dialog.showMessageBox(window, {
    type: 'info',
    title: 'Update Available',
    message: `Node View Calibrator ${release.tag_name} is available (you have v${app.getVersion()}).`,
    detail: 'Download and install now? The app will restart to finish installing.',
    buttons: ['Download & Install', 'Later'],
    defaultId: 0,
    cancelId: 1
  });
  if (response !== 0) return;

  try {
    const installerPath = await downloadInstaller(asset, (fraction) => {
      if (window && !window.isDestroyed()) window.setProgressBar(fraction);
    });
    if (window && !window.isDestroyed()) window.setProgressBar(-1);

    if (process.platform === 'darwin') {
      await shell.openPath(installerPath);
      dialog.showMessageBox(window, {
        type: 'info',
        title: 'Update Downloaded',
        message: 'The update disk image has been downloaded and opened.',
        detail: 'Drag Node View Calibrator to Applications to finish, then relaunch the app.',
        buttons: ['OK']
      });
      return;
    }

    const { response: installResponse } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Downloaded',
      message: 'The update has been downloaded.',
      detail: 'Node View Calibrator needs to restart to finish installing. Restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    if (installResponse === 0) runInstallerAndQuit(installerPath);
  } catch (error) {
    if (window && !window.isDestroyed()) window.setProgressBar(-1);
    dialog.showErrorBox('Update Failed', `Could not download the update: ${error.message}`);
  }
}

module.exports = { checkForUpdates };

// Simple JSON-backed preferences store for the desktop app.
// Persists window geometry and the recent-files list in the Electron
// userData directory so the app reopens the way the user left it.

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const MAX_RECENT_FILES = 10;

const STORE_PATH = path.join(app.getPath('userData'), 'preferences.json');

const DEFAULTS = {
  // Left null so the first launch can size itself from the actual work area
  windowBounds: null,
  windowMaximized: false,
  recentFiles: []
};

let cache = null;

/**
 * Read the preferences file, falling back to defaults when it is missing or
 * corrupt. The parsed object is cached for the lifetime of the process.
 * @returns {Object} Preferences object
 */
function load() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

/**
 * Persist the in-memory preferences to disk. Write failures are non-fatal —
 * losing preferences must never take the app down.
 */
function flush() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(load(), null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save preferences:', error.message);
  }
}

/**
 * @param {string} key - Preference key
 * @returns {*} Stored value, or the default when unset
 */
function get(key) {
  return load()[key];
}

/**
 * @param {string} key - Preference key
 * @param {*} value - Value to store
 */
function set(key, value) {
  load()[key] = value;
  flush();
}

/**
 * Move a file to the top of the recent-files list, de-duplicating and
 * trimming to MAX_RECENT_FILES.
 * @param {string} filePath - Absolute path of the opened/saved file
 * @returns {string[]} The updated recent-files list
 */
function addRecentFile(filePath) {
  if (!filePath) return get('recentFiles');
  const normalized = path.normalize(filePath);
  const recent = get('recentFiles').filter(p => path.normalize(p) !== normalized);
  recent.unshift(normalized);
  set('recentFiles', recent.slice(0, MAX_RECENT_FILES));
  return get('recentFiles');
}

/**
 * Drop paths that no longer exist on disk, so the File > Open Recent menu
 * never offers a dead entry.
 * @returns {string[]} The pruned recent-files list
 */
function pruneRecentFiles() {
  const recent = get('recentFiles').filter(p => fs.existsSync(p));
  if (recent.length !== get('recentFiles').length) set('recentFiles', recent);
  return recent;
}

/** Empty the recent-files list. */
function clearRecentFiles() {
  set('recentFiles', []);
}

module.exports = { get, set, addRecentFile, pruneRecentFiles, clearRecentFiles };

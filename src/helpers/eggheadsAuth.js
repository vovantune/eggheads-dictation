const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
let electron = {};
try {
  electron = require("electron");
} catch {
  electron = {};
}

const app = electron.app || null;
const shell = electron.shell || null;

const ISSUER = "eggheads-ai-employees-dictation";
const DEFAULT_AUTH_URL = "https://eggheads.solutions";
const DEFAULT_API_URL = "https://ai-backend.eggheads.solutions";
const AUTH_PATH = "/ai-employees-dictation/auth";
const ALLOWED_PROTOCOLS = new Set(["openwhispr", "openwhispr-dev", "openwhispr-staging"]);
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function normalizeBaseUrl(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  const base = raw || fallback;
  return base.replace(/\/+$/, "");
}

function getAuthBaseUrl(runtimeEnv = {}) {
  return normalizeBaseUrl(
    process.env.EGGHEADS_AUTH_URL ||
      process.env.VITE_EGGHEADS_AUTH_URL ||
      runtimeEnv.VITE_EGGHEADS_AUTH_URL,
    DEFAULT_AUTH_URL
  );
}

function getApiBaseUrl(runtimeEnv = {}) {
  return normalizeBaseUrl(
    process.env.EGGHEADS_API_URL ||
      process.env.VITE_EGGHEADS_API_URL ||
      runtimeEnv.VITE_EGGHEADS_API_URL,
    DEFAULT_API_URL
  );
}

function validateProtocol(protocol) {
  const normalized = typeof protocol === "string" ? protocol.trim().toLowerCase() : "";
  if (!ALLOWED_PROTOCOLS.has(normalized)) {
    throw new Error("Invalid EGGHEADS dictation auth protocol");
  }
  return normalized;
}

function validateDeviceId(deviceId) {
  const normalized = typeof deviceId === "string" ? deviceId.trim() : "";
  if (!DEVICE_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid EGGHEADS dictation device id");
  }
  return normalized;
}

function getDeviceIdFile() {
  if (!app?.getPath) {
    return path.join(process.cwd(), ".eggheads-device-id");
  }
  return path.join(app.getPath("userData"), "eggheads-device-id");
}

function getStableDeviceId() {
  const file = getDeviceIdFile();
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, "utf8").trim();
      if (DEVICE_ID_PATTERN.test(existing)) return existing;
    }
  } catch {
    // Regenerate below.
  }

  const next = `ehd-${crypto.randomUUID()}`;
  fs.writeFileSync(file, next, { mode: 0o600 });
  return next;
}

function getDeviceName() {
  const name = os.hostname() || `${os.platform()}-${os.arch()}`;
  return name.trim().slice(0, 128) || "Desktop";
}

function buildAuthUrl({ authBaseUrl = DEFAULT_AUTH_URL, protocol, deviceId, deviceName }) {
  const safeProtocol = validateProtocol(protocol);
  const safeDeviceId = validateDeviceId(deviceId);
  const url = new URL(`${normalizeBaseUrl(authBaseUrl, DEFAULT_AUTH_URL)}${AUTH_PATH}`);
  url.searchParams.set("protocol", safeProtocol);
  url.searchParams.set("deviceId", safeDeviceId);
  const safeDeviceName = typeof deviceName === "string" ? deviceName.trim().slice(0, 128) : "";
  if (safeDeviceName) url.searchParams.set("deviceName", safeDeviceName);
  return url.toString();
}

function buildTranscriptionUrl(apiBaseUrl = DEFAULT_API_URL) {
  const base = normalizeBaseUrl(apiBaseUrl, DEFAULT_API_URL);
  if (base.endsWith("/v1")) {
    return `${base}/audio/transcriptions`;
  }
  return `${base}/v1/audio/transcriptions`;
}

function isEggheadsToken(token) {
  return typeof token === "string" && /^ehd_[A-Za-z0-9._:-]+$/.test(token.trim());
}

function sanitizeProfile(profile = {}) {
  const pick = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return {
    user_id: pick(profile.user_id || profile.userId),
    login: pick(profile.login),
    display_name: pick(profile.display_name || profile.displayName),
  };
}

function buildSession(token, profile = {}) {
  if (!isEggheadsToken(token)) {
    throw new Error("Invalid EGGHEADS dictation token");
  }
  return {
    issuer: ISSUER,
    token: token.trim(),
    profile: sanitizeProfile(profile),
    updated_at: new Date().toISOString(),
  };
}

function sessionToUser(session) {
  if (!session || session.issuer !== ISSUER || !isEggheadsToken(session.token)) return null;
  const profile = sanitizeProfile(session.profile || {});
  const login = profile.login || "";
  const displayName = profile.display_name || login || "EGGHEADS";
  return {
    id: profile.user_id || login || "eggheads-user",
    email: login.includes("@") ? login : null,
    name: displayName,
    image: null,
    login,
    display_name: profile.display_name,
  };
}

async function openAuthHandoff({ protocol, runtimeEnv } = {}) {
  if (!shell?.openExternal) {
    throw new Error("Electron shell is not available");
  }
  const url = buildAuthUrl({
    authBaseUrl: getAuthBaseUrl(runtimeEnv),
    protocol,
    deviceId: getStableDeviceId(),
    deviceName: getDeviceName(),
  });
  await shell.openExternal(url);
  return { success: true, url };
}

module.exports = {
  ISSUER,
  DEFAULT_AUTH_URL,
  DEFAULT_API_URL,
  AUTH_PATH,
  buildAuthUrl,
  buildTranscriptionUrl,
  buildSession,
  getApiBaseUrl,
  getAuthBaseUrl,
  getDeviceName,
  getStableDeviceId,
  isEggheadsToken,
  openAuthHandoff,
  sanitizeProfile,
  sessionToUser,
  validateDeviceId,
  validateProtocol,
};

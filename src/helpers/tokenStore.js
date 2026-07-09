const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const debugLogger = require("./debugLogger");
const secretCrypto = require("./secretCrypto");
const { ISSUER, buildSession, isEggheadsToken, sessionToUser } = require("./eggheadsAuth");

const tokenFile = () => path.join(app.getPath("userData"), "auth-token.bin");
const sessionFile = () => path.join(app.getPath("userData"), "eggheads-auth-session.bin");

let cached = null;
let cachedSession = null;

function readEncryptedFile(file) {
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  if (!secretCrypto.isAvailable()) {
    return buf.toString("utf8");
  }
  const { value, needsReencrypt } = secretCrypto.decrypt(buf);
  if (needsReencrypt) writeEncryptedFile(file, value);
  return value;
}

function writeEncryptedFile(file, value) {
  const data = secretCrypto.isAvailable()
    ? secretCrypto.encrypt(value)
    : Buffer.from(value, "utf8");
  fs.writeFileSync(file, data, { mode: 0o600 });
}

function parseSession(raw) {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session?.issuer !== ISSUER || !isEggheadsToken(session?.token)) return null;
    return session;
  } catch {
    return null;
  }
}

function getSession() {
  if (cachedSession !== null) return cachedSession;
  try {
    cachedSession = parseSession(readEncryptedFile(sessionFile()));
    return cachedSession;
  } catch (err) {
    debugLogger.error("tokenStore.getSession failed", { error: err?.message });
    cachedSession = null;
    return null;
  }
}

function get() {
  const session = getSession();
  cached = session?.token || "";
  return cached || null;
}

function set(token) {
  try {
    setSession(buildSession(token));
  } catch (err) {
    debugLogger.error("tokenStore.set failed", { error: err?.message });
  }
}

function setSession(sessionOrToken, profile = {}) {
  try {
    const session =
      typeof sessionOrToken === "string" ? buildSession(sessionOrToken, profile) : sessionOrToken;
    if (session?.issuer !== ISSUER || !isEggheadsToken(session?.token)) {
      throw new Error("Invalid EGGHEADS auth session");
    }
    writeEncryptedFile(sessionFile(), JSON.stringify(session));
    cachedSession = session;
    cached = session.token;
  } catch (err) {
    debugLogger.error("tokenStore.setSession failed", { error: err?.message });
  }
}

function clear() {
  cached = "";
  cachedSession = null;
  try {
    fs.rmSync(tokenFile(), { force: true });
    fs.rmSync(sessionFile(), { force: true });
  } catch (err) {
    debugLogger.error("tokenStore.clear failed", { error: err?.message });
  }
}

function getUser() {
  return sessionToUser(getSession());
}

module.exports = { get, set, setSession, getSession, getUser, clear };

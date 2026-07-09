const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildAuthUrl,
  buildSession,
  buildTranscriptionUrl,
  isEggheadsToken,
  sessionToUser,
} = require("../src/helpers/eggheadsAuth");

test("buildAuthUrl creates the EGGHEADS browser handoff URL", () => {
  const url = new URL(
    buildAuthUrl({
      authBaseUrl: "https://eggheads.solutions/",
      protocol: "openwhispr",
      deviceId: "ehd-device-123456",
      deviceName: "Vova Mac",
    })
  );

  assert.equal(url.origin, "https://eggheads.solutions");
  assert.equal(url.pathname, "/ai-employees-dictation/auth");
  assert.equal(url.searchParams.get("protocol"), "openwhispr");
  assert.equal(url.searchParams.get("deviceId"), "ehd-device-123456");
  assert.equal(url.searchParams.get("deviceName"), "Vova Mac");
});

test("buildAuthUrl rejects unknown protocol and invalid device id", () => {
  assert.throws(
    () =>
      buildAuthUrl({
        protocol: "openwhispr-legacy",
        deviceId: "ehd-device-123456",
      }),
    /Invalid EGGHEADS dictation auth protocol/
  );

  assert.throws(
    () =>
      buildAuthUrl({
        protocol: "openwhispr",
        deviceId: "bad",
      }),
    /Invalid EGGHEADS dictation device id/
  );
});

test("buildSession accepts only EGGHEADS desktop dictation bearer tokens", () => {
  assert.equal(isEggheadsToken("ehd_valid-token.123"), true);
  assert.equal(isEggheadsToken("signed_token_from_legacy_auth"), false);

  assert.throws(
    () => buildSession("signed_token_from_legacy_auth"),
    /Invalid EGGHEADS dictation token/
  );

  const session = buildSession("ehd_valid-token.123", {
    user_id: "u-1",
    login: "user@example.com",
    display_name: "User Example",
  });
  const user = sessionToUser(session);

  assert.equal(session.issuer, "eggheads-ai-employees-dictation");
  assert.equal(user.email, "user@example.com");
  assert.equal(user.name, "User Example");
});

test("buildTranscriptionUrl targets the compatibility transcription endpoint once", () => {
  assert.equal(
    buildTranscriptionUrl("https://ai-backend.eggheads.solutions"),
    "https://ai-backend.eggheads.solutions/v1/audio/transcriptions"
  );
  assert.equal(
    buildTranscriptionUrl("https://ai-backend.eggheads.solutions/v1"),
    "https://ai-backend.eggheads.solutions/v1/audio/transcriptions"
  );
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const disabledPreloadKeys = [
  "transcribeLocalWhisper",
  "downloadWhisperModel",
  "whisperServerStart",
  "transcribeLocalParakeet",
  "downloadParakeetModel",
  "parakeetServerStart",
  "downloadDiarizationModels",
  "modelDownload",
  "modelCheckRuntime",
  "processLocalReasoning",
  "llamaServerStart",
  "downloadLlamaVulkanBinary",
  "checkSystemAudioAccess",
  "meetingTranscriptionPrepare",
  "meetingTranscriptionStart",
  "meetingTranscriptionSend",
  "registerMeetingHotkey",
  "updateAgentHotkey",
  "updateVoiceAgentHotkey",
  "gcalStartOAuth",
  "meetingDetectionGetPreferences",
  "getOpenAIKey",
  "saveOpenAIKey",
  "getAnthropicKey",
  "saveAnthropicKey",
  "getGeminiKey",
  "saveGeminiKey",
  "getGroqKey",
  "saveGroqKey",
  "getXaiKey",
  "saveXaiKey",
  "proxyXaiTranscription",
  "getMistralKey",
  "saveMistralKey",
  "proxyMistralTranscription",
  "getCortiClientId",
  "saveCortiClientId",
  "getCortiClientSecret",
  "saveCortiClientSecret",
  "proxyCortiTranscription",
  "getTinfoilKey",
  "saveTinfoilKey",
  "getCustomTranscriptionKey",
  "saveCustomTranscriptionKey",
  "getCleanupCustomKey",
  "saveCleanupCustomKey",
  "getBedrockRegion",
  "saveBedrockRegion",
  "getBedrockProfile",
  "saveBedrockProfile",
  "getBedrockAccessKeyId",
  "saveBedrockAccessKeyId",
  "getBedrockSecretAccessKey",
  "saveBedrockSecretAccessKey",
  "getBedrockSessionToken",
  "saveBedrockSessionToken",
  "getAzureEndpoint",
  "saveAzureEndpoint",
  "getAzureApiKey",
  "saveAzureApiKey",
  "getAzureDeployment",
  "saveAzureDeployment",
  "getAzureApiVersion",
  "saveAzureApiVersion",
  "getVertexProject",
  "saveVertexProject",
  "getVertexLocation",
  "saveVertexLocation",
  "getVertexApiKey",
  "saveVertexApiKey",
  "testEnterpriseConnection",
  "processAnthropicReasoning",
  "processEnterpriseReasoning",
  "cloudReason",
  "cloudStreamingUsage",
  "cloudUsage",
  "cloudCheckout",
  "cloudBillingPortal",
  "cloudSwitchPlan",
  "cloudPreviewSwitch",
  "cloudApiRequest",
  "getReferralStats",
  "sendReferralInvite",
  "getReferralInvites",
  "getDictionary",
  "setDictionary",
  "onDictionaryUpdated",
  "getSnippets",
  "setSnippets",
  "onSnippetsUpdated",
  "setAutoLearnEnabled",
  "onCorrectionsLearned",
  "undoLearnedCorrections",
  "saveNote",
  "getNote",
  "getNotes",
  "updateNote",
  "deleteNote",
  "exportNote",
  "exportTranscript",
  "exportDictionary",
  "searchNotes",
  "semanticSearchNotes",
  "semanticReindexAll",
  "onSemanticReindexProgress",
  "updateNoteCloudId",
  "getFolders",
  "createFolder",
  "deleteFolder",
  "renameFolder",
  "getFolderNoteCounts",
  "noteFilesSetEnabled",
  "noteFilesSetPath",
  "noteFilesRebuild",
  "noteFilesGetDefaultPath",
  "noteFilesPickFolder",
  "showNoteFile",
  "showFolderInExplorer",
  "onNoteAdded",
  "onNoteUpdated",
  "onNoteDeleted",
  "getSpeakerMappings",
  "setSpeakerMapping",
  "removeSpeakerMapping",
  "getSpeakerProfiles",
  "attachSpeakerEmail",
  "saveNoteSpeakerEmbeddings",
  "createAgentConversation",
  "getAgentConversations",
  "getAgentConversation",
  "deleteAgentConversation",
  "updateAgentConversationTitle",
  "addAgentMessage",
  "getAgentMessages",
  "getAgentConversationsWithPreview",
  "searchAgentConversations",
  "getConversationsForNote",
  "archiveAgentConversation",
  "unarchiveAgentConversation",
  "updateAgentConversationCloudId",
  "semanticSearchConversations",
  "startAgentStream",
  "onAgentStreamChunk",
  "onAgentStreamError",
  "onAgentStreamEnd",
  "agentWebSearch",
  "getPendingNotes",
  "getPendingNoteDeletes",
  "getNoteByClientId",
  "upsertNoteFromCloud",
  "markNoteSynced",
  "markNoteSyncError",
  "hardDeleteNote",
  "getPendingFolders",
  "getFolderByClientId",
  "upsertFolderFromCloud",
  "markFolderSynced",
  "adoptFolderIdentity",
  "getFolderIdMap",
  "getPendingFolderDeletes",
  "hardDeleteFolder",
  "getPendingConversations",
  "getPendingConversationDeletes",
  "getConversationByClientId",
  "upsertConversationFromCloud",
  "markConversationSynced",
  "hardDeleteConversation",
  "getPendingDictionary",
  "getPendingDictionaryDeletes",
  "getDictionaryByClientId",
  "upsertDictionaryFromCloud",
  "markDictionarySynced",
  "hardDeleteDictionary",
  "clearDictionaryCloudId",
  "broadcastDictionaryUpdated",
  "getPendingSnippets",
  "getPendingSnippetDeletes",
  "getSnippetForCloudMerge",
  "upsertSnippetFromCloud",
  "markSnippetSynced",
  "hardDeleteSnippet",
  "clearSnippetCloudId",
  "broadcastSnippetsUpdated",
  "selectAudioFile",
  "getFileSize",
  "transcribeAudioFile",
  "transcribeAudioFileCloud",
  "transcribeAudioFileByok",
  "onUploadTranscriptionProgress",
  "assemblyAiStreamingWarmup",
  "assemblyAiStreamingStart",
  "assemblyAiStreamingSend",
  "assemblyAiStreamingForceEndpoint",
  "assemblyAiStreamingStop",
  "assemblyAiStreamingStatus",
  "onAssemblyAiPartialTranscript",
  "onAssemblyAiFinalTranscript",
  "onAssemblyAiError",
  "onAssemblyAiSessionEnd",
  "deepgramStreamingWarmup",
  "deepgramStreamingStart",
  "deepgramStreamingSend",
  "deepgramStreamingFinalize",
  "deepgramStreamingStop",
  "deepgramStreamingStatus",
  "onDeepgramPartialTranscript",
  "onDeepgramFinalTranscript",
  "onDeepgramError",
  "onDeepgramSessionEnd",
  "cortiStreamingWarmup",
  "cortiStreamingStart",
  "cortiStreamingSend",
  "cortiStreamingFinalize",
  "cortiStreamingStop",
  "cortiStreamingStatus",
  "onCortiPartialTranscript",
  "onCortiFinalTranscript",
  "onCortiError",
  "onCortiSessionEnd",
  "dictationRealtimeWarmup",
  "dictationRealtimeStart",
  "dictationRealtimeSend",
  "dictationRealtimeStop",
  "onDictationRealtimePartial",
  "onDictationRealtimeFinal",
  "onDictationRealtimeError",
  "onDictationRealtimeSessionEnd",
  "startDictationPreview",
  "stopDictationPreview",
  "dismissDictationPreview",
  "completeDictationPreview",
  "hideDictationPreview",
  "resizeTranscriptionPreviewWindow",
  "sendDictationPreviewAudio",
];

const guardedIpcChannels = [
  "transcribe-local-whisper",
  "download-whisper-model",
  "whisper-server-start",
  "transcribe-local-parakeet",
  "download-parakeet-model",
  "parakeet-server-start",
  "download-diarization-models",
  "model-download",
  "model-check-runtime",
  "process-local-reasoning",
  "llama-server-start",
  "download-llama-vulkan-binary",
  "check-system-audio-access",
  "meeting-transcription-prepare",
  "meeting-transcription-start",
  "meeting-transcription-stop",
  "update-agent-hotkey",
  "update-voice-agent-hotkey",
  "gcal-start-oauth",
  "meeting-detection-get-preferences",
  "get-openai-key",
  "save-openai-key",
  "get-anthropic-key",
  "save-anthropic-key",
  "get-gemini-key",
  "save-gemini-key",
  "get-groq-key",
  "save-groq-key",
  "get-xai-key",
  "save-xai-key",
  "proxy-xai-transcription",
  "get-mistral-key",
  "save-mistral-key",
  "proxy-mistral-transcription",
  "get-corti-client-id",
  "save-corti-client-id",
  "get-corti-client-secret",
  "save-corti-client-secret",
  "proxy-corti-transcription",
  "get-tinfoil-key",
  "save-tinfoil-key",
  "get-custom-transcription-key",
  "save-custom-transcription-key",
  "get-cleanup-custom-key",
  "save-cleanup-custom-key",
  "get-bedrock-region",
  "save-bedrock-region",
  "get-bedrock-profile",
  "save-bedrock-profile",
  "get-bedrock-access-key-id",
  "save-bedrock-access-key-id",
  "get-bedrock-secret-access-key",
  "save-bedrock-secret-access-key",
  "get-bedrock-session-token",
  "save-bedrock-session-token",
  "get-azure-endpoint",
  "save-azure-endpoint",
  "get-azure-api-key",
  "save-azure-api-key",
  "get-azure-deployment",
  "save-azure-deployment",
  "get-azure-api-version",
  "save-azure-api-version",
  "get-vertex-project",
  "save-vertex-project",
  "get-vertex-location",
  "save-vertex-location",
  "get-vertex-api-key",
  "save-vertex-api-key",
  "test-enterprise-connection",
  "process-anthropic-reasoning",
  "process-enterprise-reasoning",
  "cloud-reason",
  "cloud-streaming-usage",
  "cloud-usage",
  "cloud-checkout",
  "cloud-billing-portal",
  "cloud-switch-plan",
  "cloud-preview-switch",
  "cloud-api-request",
  "get-referral-stats",
  "send-referral-invite",
  "get-referral-invites",
  "db-get-dictionary",
  "db-set-dictionary",
  "db-get-pending-dictionary",
  "db-get-pending-dictionary-deletes",
  "db-get-dictionary-by-client-id",
  "db-upsert-dictionary-from-cloud",
  "db-mark-dictionary-synced",
  "db-hard-delete-dictionary",
  "db-clear-dictionary-cloud-id",
  "db-broadcast-dictionary-updated",
  "db-get-snippets",
  "db-set-snippets",
  "db-get-pending-snippets",
  "db-get-pending-snippet-deletes",
  "db-get-snippet-for-cloud-merge",
  "db-upsert-snippet-from-cloud",
  "db-mark-snippet-synced",
  "db-hard-delete-snippet",
  "db-clear-snippet-cloud-id",
  "db-broadcast-snippets-updated",
  "undo-learned-corrections",
  "db-save-note",
  "db-get-note",
  "db-get-notes",
  "db-update-note",
  "db-delete-note",
  "db-search-notes",
  "db-semantic-search-notes",
  "db-semantic-reindex-all",
  "db-update-note-cloud-id",
  "db-get-folders",
  "db-create-folder",
  "db-delete-folder",
  "db-rename-folder",
  "db-get-folder-note-counts",
  "export-note",
  "export-transcript",
  "export-dictionary",
  "agent-open-note",
  "db-create-agent-conversation",
  "db-get-conversations-for-note",
  "db-get-agent-conversations",
  "db-get-agent-conversation",
  "db-delete-agent-conversation",
  "db-update-agent-conversation-title",
  "db-add-agent-message",
  "db-get-agent-messages",
  "db-get-agent-conversations-with-preview",
  "db-search-agent-conversations",
  "db-archive-agent-conversation",
  "db-unarchive-agent-conversation",
  "db-update-agent-conversation-cloud-id",
  "db-semantic-search-conversations",
  "agent-web-search",
  "db-get-pending-notes",
  "db-get-pending-note-deletes",
  "db-get-note-by-client-id",
  "db-upsert-note-from-cloud",
  "db-mark-note-synced",
  "db-mark-note-sync-error",
  "db-hard-delete-note",
  "db-get-pending-folders",
  "db-get-folder-by-client-id",
  "db-upsert-folder-from-cloud",
  "db-mark-folder-synced",
  "db-adopt-folder-identity",
  "db-get-folder-id-map",
  "db-get-pending-folder-deletes",
  "db-hard-delete-folder",
  "db-get-pending-conversations",
  "db-get-pending-conversation-deletes",
  "db-get-conversation-by-client-id",
  "db-upsert-conversation-from-cloud",
  "db-mark-conversation-synced",
  "db-hard-delete-conversation",
  "note-files-set-enabled",
  "note-files-set-path",
  "note-files-rebuild",
  "note-files-get-default-path",
  "note-files-pick-folder",
  "show-note-file",
  "show-folder-in-explorer",
  "get-speaker-mappings",
  "set-speaker-mapping",
  "remove-speaker-mapping",
  "get-speaker-profiles",
  "attach-speaker-email",
  "save-note-speaker-embeddings",
  "select-audio-file",
  "get-file-size",
  "transcribe-audio-file",
  "transcribe-audio-file-cloud",
  "transcribe-audio-file-byok",
  "assemblyai-streaming-warmup",
  "assemblyai-streaming-start",
  "assemblyai-streaming-stop",
  "assemblyai-streaming-status",
  "deepgram-streaming-warmup",
  "deepgram-streaming-start",
  "deepgram-streaming-stop",
  "deepgram-streaming-status",
  "corti-streaming-warmup",
  "corti-streaming-start",
  "corti-streaming-stop",
  "corti-streaming-status",
  "dictation-realtime-warmup",
  "dictation-realtime-start",
  "dictation-realtime-stop",
  "start-dictation-preview",
  "stop-dictation-preview",
  "dismiss-dictation-preview",
  "complete-dictation-preview",
  "hide-dictation-preview",
  "resize-transcription-preview-window",
];

const guardedIpcSendChannels = [
  "auto-learn-changed",
  "meeting-transcription-send",
  "assemblyai-streaming-send",
  "assemblyai-streaming-force-endpoint",
  "deepgram-streaming-send",
  "deepgram-streaming-finalize",
  "corti-streaming-send",
  "corti-streaming-finalize",
  "dictation-realtime-send",
  "dictation-preview-audio",
  "cloud-agent-stream-start",
];

function findIpcRegistration(source, method, channel) {
  const quoted = `"${channel}"`;
  const direct = source.indexOf(`ipcMain.${method}(${quoted}`);
  if (direct !== -1) return direct;
  const multiline = source.indexOf(`ipcMain.${method}(\n      ${quoted}`);
  if (multiline !== -1) return multiline;
  return source.indexOf(`ipcMain.${method}(\n      ${quoted},`);
}

test("dictation-only preload removes disabled runtime and persistence APIs", () => {
  const preload = read("preload.js");
  assert.match(preload, /const EGGHEADS_DICTATION_ONLY = true;/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\("electronAPI", electronAPI\)/);

  for (const key of disabledPreloadKeys) {
    assert.match(preload, new RegExp(`"${key}"`), `${key} must be in the removal list`);
  }
});

test("dictation-only main process does not warm Windows loopback audio", () => {
  const main = read("main.js");
  const probeIndex = main.indexOf("windowsLoopbackAudioManager.getCapability().catch(() => {});");
  assert.notEqual(probeIndex, -1);

  const guardIndex = main.lastIndexOf("if (!EGGHEADS_DICTATION_ONLY)", probeIndex);
  assert.notEqual(guardIndex, -1);
  assert.ok(probeIndex - guardIndex < 600, "Windows loopback probe must stay behind the guard");
});

test("dictation-only IPC handlers fail closed before disabled runtimes", () => {
  const handlers = read("src/helpers/ipcHandlers.js");

  for (const channel of guardedIpcChannels) {
    const handleIndex = findIpcRegistration(handlers, "handle", channel);
    assert.notEqual(handleIndex, -1, `${channel} handler must exist`);
    const bodyStart = handlers.indexOf("{", handleIndex);
    const firstStatements = handlers.slice(bodyStart, bodyStart + 220);
    assert.match(
      firstStatements,
      /if \(EGGHEADS_DICTATION_ONLY\)/,
      `${channel} must guard dictation-only before touching managers`
    );
  }

  for (const channel of guardedIpcSendChannels) {
    const sendIndex = findIpcRegistration(handlers, "on", channel);
    assert.notEqual(sendIndex, -1, `${channel} listener must exist`);
    assert.match(
      handlers.slice(sendIndex, sendIndex + 180),
      /if \(EGGHEADS_DICTATION_ONLY\) return/,
      `${channel} must return before touching payloads or streaming managers`
    );
  }
});

test("dictation-only app settings hide disabled hotkey controls", () => {
  const settings = read("src/components/SettingsPage.tsx");
  const hotkeysCaseIndex = settings.indexOf('case "hotkeys":');
  assert.notEqual(hotkeysCaseIndex, -1);
  const hotkeysRender = settings.slice(hotkeysCaseIndex, settings.indexOf('case "speechToText":'));
  const guardIndex = hotkeysRender.indexOf("{!EGGHEADS_DICTATION_ONLY && (");
  assert.notEqual(guardIndex, -1);

  for (const marker of [
    "settingsPage.general.voiceAgentHotkey.title",
    "settingsPage.general.meetingHotkey.title",
    "agentMode.settings.hotkey",
  ]) {
    const markerIndex = hotkeysRender.indexOf(marker);
    assert.notEqual(markerIndex, -1, `${marker} should still exist for non-dictation builds`);
    assert.ok(markerIndex > guardIndex, `${marker} must render only behind the dictation guard`);
  }
});

test("dictation-only history and account settings hide unsupported upsells and account deletion", () => {
  const historyView = read("src/components/HistoryView.tsx");
  const aiCtaIndex = historyView.indexOf('t("controlPanel.aiCta.title")');
  assert.notEqual(aiCtaIndex, -1);
  const aiGuardIndex = historyView.lastIndexOf("!EGGHEADS_DICTATION_ONLY", aiCtaIndex);
  assert.notEqual(aiGuardIndex, -1, "AI enhancement CTA must be guarded in dictation-only builds");

  const settings = read("src/components/SettingsPage.tsx");
  const deleteAccountIndex = settings.indexOf("settingsPage.account.deleteAccount.label");
  assert.notEqual(deleteAccountIndex, -1);
  const deleteGuardIndex = settings.lastIndexOf("!EGGHEADS_DICTATION_ONLY", deleteAccountIndex);
  assert.notEqual(
    deleteGuardIndex,
    -1,
    "Delete Account UI must be guarded in dictation-only builds"
  );
  assert.ok(
    deleteAccountIndex - deleteGuardIndex < 260,
    "Delete Account guard must be adjacent to the unsupported section"
  );
});

test("dictation-only defaults are hold activation and Russian language without stale startup override", () => {
  const store = read("src/stores/settingsStore.ts");
  assert.match(store, /const DEFAULT_UI_LANGUAGE = EGGHEADS_DICTATION_ONLY \? "ru" : "en";/);
  assert.match(
    store,
    /const DEFAULT_TRANSCRIPTION_LANGUAGE = EGGHEADS_DICTATION_ONLY \? "ru" : "auto";/
  );
  assert.match(
    store,
    /const DEFAULT_ACTIVATION_MODE: "tap" \| "push" = EGGHEADS_DICTATION_ONLY \? "push" : "tap";/
  );
  assert.match(
    store,
    /EGGHEADS_DICTATION_ONLY && !hasStoredActivationMode && envMode === "tap"/
  );

  const environment = read("src/helpers/environment.js");
  assert.match(environment, /if \(!mode && EGGHEADS_DICTATION_ONLY\) return "push";/);
  assert.match(environment, /EGGHEADS_DICTATION_ONLY \? "ru" : "en"/);

  const i18n = read("src/i18n.ts");
  assert.match(i18n, /storageLanguage \|\| \(EGGHEADS_DICTATION_ONLY \? "ru" : browserLanguage\)/);
});

test("dictation-only reauth copy and auth logo are EGGHEADS branded", () => {
  const audioManager = read("src/helpers/audioManager.js");
  assert.doesNotMatch(
    audioManager,
    /Your OpenWhispr Cloud session is unavailable/,
    "runtime 401 fallback must not mention OpenWhispr Cloud"
  );
  assert.match(audioManager, /sign in to EGGHEADS again/);

  for (const locale of ["en", "ru"]) {
    const translation = read(`src/locales/${locale}/translation.json`);
    assert.doesNotMatch(
      translation,
      /OpenWhispr Cloud (session|недоступна)|Сессия OpenWhispr Cloud/,
      `${locale} session-expired copy must not mention OpenWhispr Cloud`
    );
    assert.match(translation, /EGGHEADS/);
  }

  const authStep = read("src/components/AuthenticationStep.tsx");
  assert.match(authStep, /import eggheadsLogo from "\.\.\/assets\/eggheads-logo\.svg";/);
  assert.match(authStep, /src=\{eggheadsLogo\}/);
});

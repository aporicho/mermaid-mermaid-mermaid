const SHARED_CONFIGURATION_COMMANDS = new Set([
  "login", "logout", "upsert_provider_config", "delete_provider_config", "replace_settings",
  "package_install", "package_remove", "package_update", "trust_set"
]);

function shouldBroadcastAgentConfiguration(type) {
  return SHARED_CONFIGURATION_COMMANDS.has(type);
}

function isInteractiveAgentRequest(method) {
  return !["notify", "setStatus", "setWidget", "setTitle", "set_editor_text"].includes(method);
}

function broadcastAgentConfiguration(records, source, commandType, emit) {
  for (const record of records.values()) {
    if (record.ownerId === source.ownerId && record !== source) emit(record, { lane: "control", payload: { type: "configuration_changed", commandType } });
  }
}

module.exports = { broadcastAgentConfiguration, isInteractiveAgentRequest, shouldBroadcastAgentConfiguration };

// In-memory only — both values reset to defaults (all AI on) on every container restart.
// The admin page re-fetches on load, so a restart silently re-enables everything.
let _globalAiEnabled = true;
const _userAiDisabled = new Set<string>(); // lineUserIds with AI manually disabled

export function isAiEnabled(): boolean { return _globalAiEnabled; }
export function setAiEnabled(enabled: boolean): void {
  _globalAiEnabled = enabled;
  console.log(`[ai-settings] Global AI ${enabled ? "ENABLED" : "DISABLED"}`);
}

export function isUserAiEnabled(userId: string): boolean {
  return !_userAiDisabled.has(userId);
}
export function setUserAiEnabled(userId: string, enabled: boolean): void {
  if (enabled) { _userAiDisabled.delete(userId); }
  else         { _userAiDisabled.add(userId); }
  console.log(`[ai-settings] User ${userId} AI ${enabled ? "ENABLED" : "DISABLED"}`);
}

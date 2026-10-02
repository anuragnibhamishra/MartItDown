export const scrollSyncStorageKey = 'markitdown-scrollsync'
export const autoPairStorageKey = 'markitdown-autopair'

function readBooleanSetting(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'on'
  } catch {
    return fallback
  }
}

function writeBooleanSetting(key: string, enabled: boolean): boolean {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}

export function loadScrollSyncEnabled(): boolean {
  return readBooleanSetting(scrollSyncStorageKey, true)
}

export function persistScrollSyncEnabled(enabled: boolean): boolean {
  return writeBooleanSetting(scrollSyncStorageKey, enabled)
}

export function loadAutoPairEnabled(): boolean {
  return readBooleanSetting(autoPairStorageKey, true)
}

export function persistAutoPairEnabled(enabled: boolean): boolean {
  return writeBooleanSetting(autoPairStorageKey, enabled)
}
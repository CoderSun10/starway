/** Read localStorage, copying a one-time legacy key if present. */
export function storageGet(key, legacyKey) {
  try {
    let value = localStorage.getItem(key);
    if (value == null && legacyKey) {
      value = localStorage.getItem(legacyKey);
      if (value != null) {
        localStorage.setItem(key, value);
        localStorage.removeItem(legacyKey);
      }
    }
    return value;
  } catch {
    return null;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

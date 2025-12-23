/**
 * Very simple “login”: user enters a name.
 * We store it in localStorage so refresh keeps them logged in.
 */

const KEY = "unc_tenting_name";

export function getSavedName() {
  return localStorage.getItem(KEY);
}

export function saveName(name) {
  localStorage.setItem(KEY, name);
}

export function clearName() {
  localStorage.removeItem(KEY);
}

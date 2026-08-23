const STORAGE_KEY = 'nwd_theme';

function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY);
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialTheme() {
  return getStoredTheme() || (systemPrefersDark() ? 'dark' : 'light');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export { getInitialTheme, applyTheme };

export type AppColorTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'personal-ai-knowledge-os-theme'

export function getInitialTheme(storedTheme: string | null, prefersDark: boolean): AppColorTheme {
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  return prefersDark ? 'dark' : 'light'
}

export function applyTheme(theme: AppColorTheme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

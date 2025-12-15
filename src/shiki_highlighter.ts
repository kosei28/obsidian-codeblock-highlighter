import {
  type BundledLanguage,
  bundledLanguagesInfo,
  createHighlighter,
  type Highlighter,
  type ThemeInput,
} from 'shiki';
import type ShikiHighlightPlugin from './main';

export class ShikiHighlighter {
  private highlighter: Highlighter | null = null;
  private currentTheme: string;
  private loadingLanguages: Set<string> = new Set();
  private plugin: ShikiHighlightPlugin;

  constructor(theme: string, plugin: ShikiHighlightPlugin) {
    this.currentTheme = theme;
    this.plugin = plugin;
  }

  async initialize() {
    this.highlighter = await createHighlighter({
      themes: [this.currentTheme as ThemeInput],
      langs: [], // Start with no languages loaded
    });
  }

  async loadTheme(theme: string) {
    if (!this.highlighter) return;

    if (!this.highlighter.getLoadedThemes().includes(theme)) {
      await this.highlighter.loadTheme(theme as ThemeInput);
    }
    this.currentTheme = theme;
  }

  async loadLanguage(lang: string) {
    if (!this.highlighter || this.loadingLanguages.has(lang)) return;

    // Check if the language is valid
    const langInfo = bundledLanguagesInfo.find((l) => l.id === lang || l.aliases?.includes(lang));
    if (!langInfo) return;

    this.loadingLanguages.add(lang);

    try {
      await this.highlighter.loadLanguage(langInfo.id as BundledLanguage);
      this.loadingLanguages.delete(lang);
      this.plugin.refreshViews();
    } catch (e) {
      console.warn(`[Shiki] Failed to load language ${lang}:`, e);
      this.loadingLanguages.delete(lang);
    }
  }

  highlight(code: string, lang: string) {
    if (!this.highlighter) return [];

    const loadedLanguages = this.highlighter.getLoadedLanguages();
    if (!loadedLanguages.includes(lang) && !this.loadingLanguages.has(lang)) {
      // Trigger load if not loaded and not currently loading
      // We do this floating (no await)
      this.loadLanguage(lang);
      return [];
    }

    if (!loadedLanguages.includes(lang)) {
      return [];
    }

    try {
      const result = this.highlighter.codeToTokens(code, {
        lang: lang as BundledLanguage,
        theme: this.currentTheme,
      });
      return result.tokens;
    } catch (e) {
      console.warn(`[Shiki] Failed to highlight ${lang}:`, e);
      return [];
    }
  }

  highlightHtml(code: string, lang: string) {
    if (!this.highlighter) return code;

    const loadedLanguages = this.highlighter.getLoadedLanguages();
    if (!loadedLanguages.includes(lang)) {
      // checks implicitly if valid in loadLanguage
      this.loadLanguage(lang);
      // For HTML output (used in Reading View), we might want to return plain code
      // and rely on a re-render trigger later, or we just return unhighlighted
      return code;
    }

    try {
      return this.highlighter.codeToHtml(code, {
        lang: lang as BundledLanguage,
        theme: this.currentTheme,
      });
    } catch (e) {
      console.warn(`[Shiki] Failed to highlight HTML ${lang}:`, e);
      return code;
    }
  }

  getThemeColors(): { fg: string; bg: string } | undefined {
    if (!this.highlighter) return;
    const theme = this.highlighter.getTheme(this.currentTheme);
    return { fg: theme.fg, bg: theme.bg };
  }
}

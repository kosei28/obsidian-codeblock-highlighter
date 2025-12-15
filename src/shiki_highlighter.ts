import {
  type BundledLanguage,
  bundledLanguagesInfo,
  createHighlighter,
  type Highlighter,
  type ThemeInput,
} from 'shiki';

export class ShikiHighlighter {
  private highlighter: Highlighter | null = null;
  private currentTheme: string;

  constructor(theme: string) {
    this.currentTheme = theme;
  }

  async initialize() {
    this.highlighter = await createHighlighter({
      themes: [this.currentTheme as ThemeInput],
      langs: bundledLanguagesInfo.map((l) => l.id),
    });
  }

  async loadTheme(theme: string) {
    if (!this.highlighter) return;

    if (!this.highlighter.getLoadedThemes().includes(theme)) {
      await this.highlighter.loadTheme(theme as ThemeInput);
    }
    this.currentTheme = theme;
  }

  highlight(code: string, lang: string) {
    if (!this.highlighter) return [];

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

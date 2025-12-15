import { createHighlighter, Highlighter, type ThemeInput } from 'shiki';
import { themes } from 'tm-themes';

export class ShikiHighlighter {
    private highlighter: Highlighter | null = null;
    private currentTheme: string = 'github-dark';

    async initialize(theme: string) {
        this.currentTheme = theme;
        this.highlighter = await createHighlighter({
            themes: [theme as ThemeInput],
            langs: ['javascript', 'typescript', 'css', 'html', 'json', 'markdown'] 
        });
    }

    async loadTheme(theme: string) {
        if (!this.highlighter) return;
        
        if (!this.highlighter.getLoadedThemes().includes(theme)) {
             await this.highlighter.loadTheme(theme as ThemeInput);
        }
        this.currentTheme = theme;
    }

    getThemeList(): string[] {
        return themes.map(t => t.name);
    }

    highlight(code: string, lang: string) {
        if (!this.highlighter) return [];
        
        try {
            return this.highlighter.codeToTokens(code, {
                lang: lang as any,
                theme: this.currentTheme
            });
        } catch (e) {
            console.warn(`[Shiki] Failed to highlight ${lang}:`, e);
            return []; 
        }
    }

    highlightHtml(code: string, lang: string): string {
        if (!this.highlighter) return code;
        
        try {
            return this.highlighter.codeToHtml(code, {
                lang: lang as any,
                theme: this.currentTheme
            });
        } catch (e) {
            console.warn(`[Shiki] Failed to highlight HTML ${lang}:`, e);
            return code;
        }
    }
    
    async loadLanguage(lang: string) {
        if (!this.highlighter) return;
        if (!this.highlighter.getLoadedLanguages().includes(lang)) {
             await this.highlighter.loadLanguage(lang as any);
        }
    }
}

import type { EditorView } from '@codemirror/view';
import { type App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { bundledThemesInfo } from 'shiki';
import { ShikiHighlighter } from './shiki_highlighter';
import { createShikiViewPlugin, themeChangeEffect } from './view_plugin';

interface ShikiHighlightSettings {
  theme: string;
}

const DEFAULT_SETTINGS: ShikiHighlightSettings = {
  theme: 'catppuccin-mocha', // Modern default
};

export default class ShikiHighlightPlugin extends Plugin {
  settings: ShikiHighlightSettings;
  highlighter: ShikiHighlighter;

  styleEl: HTMLStyleElement;

  async onload() {
    console.log('Loading Shiki Highlighter Plugin');
    await this.loadSettings();

    this.highlighter = new ShikiHighlighter(this.settings.theme, this);

    this.styleEl = document.createElement('style');
    this.styleEl.id = 'shiki-highlight-styles';
    document.head.appendChild(this.styleEl);

    // Notify user if initialization takes time
    try {
      await this.highlighter.initialize();
      console.log('Shiki initialized with theme:', this.settings.theme);
      this.updateThemeStyles();
    } catch (e) {
      console.error('Failed to initialize Shiki:', e);
      new Notice('Shiki Highlighter: Failed to initialize. Check console.');
    }

    this.registerEditorExtension(createShikiViewPlugin(this));

    this.registerMarkdownPostProcessor((el, _ctx) => {
      el.querySelectorAll('pre > code').forEach(async (codeElement) => {
        const pre = codeElement.parentElement as HTMLElement;
        if (!pre || pre.classList.contains('shiki')) return;

        const classes = Array.from(codeElement.classList);
        const langClass = classes.find((c) => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : 'text';

        const code = codeElement.textContent || '';

        const html = this.highlighter.highlightHtml(code, lang);

        const div = document.createElement('div');
        div.innerHTML = html;
        const newPre = div.querySelector('pre');

        if (newPre) {
          pre.replaceWith(newPre);
        }
      });
    });
    this.addSettingTab(new ShikiHighlightSettingTab(this.app, this));
  }

  onunload() {
    if (this.styleEl) {
      this.styleEl.remove();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Reload highlighter theme when settings are saved
    if (this.highlighter) {
      await this.highlighter.loadTheme(this.settings.theme);
      this.updateThemeStyles();
    }

    this.refreshViews();
  }

  refreshViews() {
    // Trigger refresh in all editor views
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        const editor = view.editor;
        // Obsidian exposes the CM6 EditorView via .cm
        if ('cm' in editor) {
          (editor.cm as EditorView).dispatch({
            effects: themeChangeEffect.of(null),
          });
        }

        // Refresh Reading View (Preview)
        if (view.getMode() === 'preview') {
          view.previewMode.rerender(true);
        }
      }
    });
  }

  updateThemeStyles() {
    if (!this.highlighter) return;
    const colors = this.highlighter.getThemeColors();
    if (!colors) return;

    this.styleEl.textContent = `
      body {
        --shiki-fg: color-mix(in srgb, ${colors.fg}, transparent 30%);
        --shiki-bg: ${colors.bg};
      }
      
      /* Source Mode / Live Preview */
      .markdown-source-view.mod-cm6 .cm-content > .HyperMD-codeblock {
        color: var(--shiki-fg) !important;
        caret-color: var(--shiki-fg) !important;
        background-color: var(--shiki-bg) !important;

        .code-block-flair {
          color: var(--shiki-fg) !important;
        }
      }
    `;
  }
}

class ShikiHighlightSettingTab extends PluginSettingTab {
  plugin: ShikiHighlightPlugin;

  constructor(app: App, plugin: ShikiHighlightPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Shiki Highlighter Settings' });

    const themes = bundledThemesInfo;
    // Create a record for the dropdown
    const themeOptions: Record<string, string> = {};
    themes.forEach((t) => {
      themeOptions[t.id] = `${t.displayName} (${t.type})`;
    });

    new Setting(containerEl)
      .setName('Theme')
      .setDesc('Select the syntax highlighting theme.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(themeOptions)
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            this.plugin.settings.theme = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

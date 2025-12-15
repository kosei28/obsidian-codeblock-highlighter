import type { EditorView } from '@codemirror/view';
import { type App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { bundledThemesInfo } from 'shiki';
import { ShikiHighlighter } from './shiki_highlighter';
import { createShikiViewPlugin, themeChangeEffect } from './view_plugin';

export type ShikiHighlightSettings = {
  theme: string;
  languageMappings: Record<string, string>;
};

const DEFAULT_SETTINGS: ShikiHighlightSettings = {
  theme: 'catppuccin-mocha',
  languageMappings: {},
};

export default class ShikiHighlightPlugin extends Plugin {
  settings: ShikiHighlightSettings;
  highlighter: ShikiHighlighter;

  private styleEl: HTMLStyleElement;

  async onload() {
    await this.loadSettings();

    this.highlighter = new ShikiHighlighter(this.settings.theme, this);

    this.styleEl = document.createElement('style');
    this.styleEl.id = 'shiki-highlight-styles';
    document.head.appendChild(this.styleEl);

    try {
      await this.highlighter.initialize();
      this.updateThemeStyles();
    } catch (e) {
      console.error('Failed to initialize Shiki:', e);
      new Notice('Shiki Highlighter: Failed to initialize. Check console.');
    }

    this.registerEditorExtension(createShikiViewPlugin(this));

    this.registerMarkdownPostProcessor((el) => {
      el.querySelectorAll('pre > code').forEach(async (codeElement) => {
        const pre = codeElement.parentElement as HTMLElement;
        if (!pre || pre.classList.contains('shiki')) return;

        const classes = Array.from(codeElement.classList);
        const langClass = classes.find((className) => className.startsWith('language-'));
        let lang = langClass ? langClass.replace('language-', '') : 'text';

        if (this.settings.languageMappings[lang]) {
          lang = this.settings.languageMappings[lang];
        }

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

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.highlighter) {
      await this.highlighter.loadTheme(this.settings.theme);
      this.updateThemeStyles();
    }

    this.refreshViews();
  }

  refreshViews() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        const editor = view.editor;

        if ('cm' in editor) {
          (editor.cm as EditorView).dispatch({
            effects: themeChangeEffect.of(null),
          });
        }

        if (view.getMode() === 'preview') {
          view.previewMode.rerender(true);
        }
      }
    });
  }

  private updateThemeStyles() {
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
  private plugin: ShikiHighlightPlugin;

  constructor(app: App, plugin: ShikiHighlightPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const themes = bundledThemesInfo;
    const themeOptions: Record<string, string> = {};
    themes.forEach((theme) => {
      themeOptions[theme.id] = `${theme.displayName} (${theme.type})`;
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

    new Setting(containerEl)
      .setName('Language Mappings')
      .setDesc('Map shorter or alternative language names to Shiki languages (e.g., "dataviewjs" -> "javascript").');

    const mappingsContainer = containerEl.createDiv();

    const renderMappings = () => {
      mappingsContainer.empty();

      let newAlias = '';
      let newTarget = '';

      const addMappingSetting = new Setting(mappingsContainer).addText((text) =>
        text.setPlaceholder('Alias (e.g. dataviewjs)').onChange((value) => {
          newAlias = value;
        })
      );
      addMappingSetting.controlEl.createSpan({ text: ' → ', cls: 'codeblock-highlighter-mapping-arrow' });
      addMappingSetting
        .addText((text) =>
          text.setPlaceholder('Target (e.g. javascript)').onChange((value) => {
            newTarget = value;
          })
        )
        .addButton((btn) => {
          btn
            .setButtonText('Add')
            .setClass('codeblock-highlighter-mapping-button')
            .setCta()
            .onClick(async () => {
              if (newAlias && newTarget) {
                this.plugin.settings.languageMappings[newAlias] = newTarget;
                await this.plugin.saveSettings();
                renderMappings();
              }
            });
        });

      Object.entries(this.plugin.settings.languageMappings).forEach(([alias, target]) => {
        const setting = new Setting(mappingsContainer)
          .setClass('codeblock-highlighter-mapping-item')
          .addText((text) => text.setValue(alias).setDisabled(true));
        setting.controlEl.createSpan({ text: ' → ', cls: 'codeblock-highlighter-mapping-arrow' });
        setting
          .addText((text) => text.setValue(target).setDisabled(true))
          .addButton((btn) => {
            btn
              .setButtonText('Delete')
              .setClass('codeblock-highlighter-mapping-button')
              .onClick(async () => {
                delete this.plugin.settings.languageMappings[alias];
                await this.plugin.saveSettings();
                renderMappings();
              });
          });
      });
    };

    renderMappings();
  }
}

import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { ShikiHighlighter } from './shiki_highlighter';
import { createShikiViewPlugin, themeChangeEffect } from './view_plugin';

interface ShikiHighlightSettings {
    theme: string;
}

const DEFAULT_SETTINGS: ShikiHighlightSettings = {
    theme: 'catppuccin-mocha', // Modern default
}

export default class ShikiHighlightPlugin extends Plugin {
    settings: ShikiHighlightSettings;
    highlighter: ShikiHighlighter;

    async onload() {
        console.log('Loading Shiki Highlighter Plugin');
        await this.loadSettings();

        this.highlighter = new ShikiHighlighter();
        
        // Notify user if initialization takes time
        try {
            await this.highlighter.initialize(this.settings.theme);
            console.log('Shiki initialized with theme:', this.settings.theme);
        } catch (e) {
            console.error('Failed to initialize Shiki:', e);
            new Notice('Shiki Highlighter: Failed to initialize. Check console.');
        }

        this.registerEditorExtension(createShikiViewPlugin(this));
        this.addSettingTab(new ShikiHighlightSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Reload highlighter theme when settings are saved
        if (this.highlighter) {
            await this.highlighter.loadTheme(this.settings.theme);
        }

        // Trigger refresh in all editor views
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view instanceof MarkdownView) {
                const editor = leaf.view.editor as any;
                // Obsidian exposes the CM6 EditorView via .cm
                if (editor.cm) {
                    (editor.cm as EditorView).dispatch({
                        effects: themeChangeEffect.of(null)
                    });
                }
            }
        });
    }
}

class ShikiHighlightSettingTab extends PluginSettingTab {
    plugin: ShikiHighlightPlugin;

    constructor(app: App, plugin: ShikiHighlightPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Shiki Highlighter Settings'});

        const themes = this.plugin.highlighter ? this.plugin.highlighter.getThemeList() : [];
        // Create a record for the dropdown
        const themeOptions: Record<string, string> = {};
        themes.forEach(t => themeOptions[t] = t);

        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Select the syntax highlighting theme.')
            .addDropdown(dropdown => dropdown
                .addOptions(themeOptions)
                .setValue(this.plugin.settings.theme)
                .onChange(async (value) => {
                    this.plugin.settings.theme = value;
                    await this.plugin.saveSettings();
                }));
    }
}

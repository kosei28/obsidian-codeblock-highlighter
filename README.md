# Obsidian Codeblock Highlighter

A simple plugin that highlights code blocks in Obsidian using the powerful [Shiki](https://shiki.style/) highlighter.

## Features

- **Accurate Highlighting**: Uses Shiki for VS Code-like syntax highlighting.
- **Theme Support**: Choose from a variety of bundled themes in the settings.
- **Source Mode / Live Preview / Reading View**: Works seamlessly in all view modes.

## Installation

1. Search for "Codeblock Highlighter" in Obsidian's Community Plugins (once released).
2. Enable the plugin in your settings.

## Settings

- **Theme**: Select your preferred syntax highlighting theme.
- **Language Mappings**: Map language aliases to supported languages (e.g., `dataviewjs` -> `javascript`).

## Development

To build the plugin from source:

```bash
bun install
bun run dev
```

## Credits

- [Shiki](https://shiki.style/): A beautiful and powerful syntax highlighter.
- [tm-themes](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-themes): A collection of shared TextMate themes bundled in this plugin.

import { syntaxTree } from '@codemirror/language';
import { type Range, StateEffect } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type ShikiHighlightPlugin from './main';

const FONT_STYLE = {
  ITALIC: 1,
  BOLD: 2,
  UNDERLINE: 4,
};

export const themeChangeEffect = StateEffect.define<null>();

export const createShikiViewPlugin = (plugin: ShikiHighlightPlugin) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = Decoration.none;
        this.updateDecorations(view, view.visibleRanges);
      }

      update(update: ViewUpdate) {
        this.decorations = this.decorations.map(update.changes);

        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((tr) => tr.effects.some((e) => e.is(themeChangeEffect)))
        ) {
          const rangesToUpdate: { from: number; to: number }[] = [];

          if (update.docChanged) {
            update.changes.iterChanges((_fromA, _toA, fromB, toB) => {
              rangesToUpdate.push({ from: fromB, to: toB });
            });
          }

          if (update.viewportChanged || !update.docChanged) {
            rangesToUpdate.push(...update.view.visibleRanges);
          }

          if (rangesToUpdate.length > 0) {
            this.updateDecorations(update.view, rangesToUpdate);
          }
        }
      }

      private updateDecorations(view: EditorView, ranges: readonly { from: number; to: number }[]) {
        if (!plugin.highlighter) {
          this.decorations = Decoration.none;
          return;
        }

        const add: Range<Decoration>[] = [];
        const uniqueBlocks = new Set<string>();

        const filter = (from: number) => {
          for (const range of ranges) {
            if (from >= range.from && from <= range.to) {
              return false;
            }
          }
          return true;
        };

        const doc = view.state.doc;

        for (const range of ranges) {
          syntaxTree(view.state).iterate({
            from: range.from,
            to: range.to,
            enter: (node) => {
              const name = node.name;

              if (name.includes('HyperMD-codeblock-begin') || name.includes('formatting-code-block-begin')) {
                const startLine = doc.lineAt(node.from);

                if (uniqueBlocks.has(startLine.from.toString())) return;
                uniqueBlocks.add(startLine.from.toString());

                const match = startLine.text.match(/^`{3,}(\S*)/);
                let lang = match ? match[1] : '';

                if (plugin.settings.languageMappings[lang]) {
                  lang = plugin.settings.languageMappings[lang];
                }

                const blockContentStart = startLine.to + 1;
                if (blockContentStart >= doc.length) return;

                let blockContentEnd = -1;
                let lineNo = startLine.number + 1;

                while (lineNo <= doc.lines) {
                  const line = doc.line(lineNo);
                  if (line.text.trim().startsWith('```')) {
                    blockContentEnd = line.from;
                    break;
                  }
                  lineNo++;
                }

                if (blockContentEnd === -1) {
                  blockContentEnd = doc.length;
                }

                if (blockContentEnd > blockContentStart) {
                  this.highlightBlock(view, add, lang, blockContentStart, blockContentEnd);
                }
              }
            },
          });
        }

        this.decorations = this.decorations.update({
          filter,
          add,
          sort: true,
        });
      }

      private highlightBlock(
        view: EditorView,
        decorations: Range<Decoration>[],
        lang: string,
        from: number,
        to: number
      ) {
        if (!plugin.highlighter || from >= to) return;

        const doc = view.state.doc;
        const code = doc.sliceString(from, to);

        const lines = plugin.highlighter.highlight(code, lang);

        let currentPos = from;

        for (const line of lines) {
          for (const token of line) {
            if (!token.content) continue;

            const tokenLen = token.content.length;

            let style = `color: ${token.color};`;
            if (token.fontStyle) {
              if (token.fontStyle & FONT_STYLE.ITALIC) style += 'font-style: italic;';
              if (token.fontStyle & FONT_STYLE.BOLD) style += 'font-weight: bold;';
              if (token.fontStyle & FONT_STYLE.UNDERLINE) style += 'text-decoration: underline;';
            }

            decorations.push(
              Decoration.mark({
                attributes: { style },
                class: 'shiki-token',
              }).range(currentPos, currentPos + tokenLen)
            );

            currentPos += tokenLen;
          }

          if (currentPos < to && doc.sliceString(currentPos, currentPos + 1) === '\n') {
            currentPos++;
          }
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

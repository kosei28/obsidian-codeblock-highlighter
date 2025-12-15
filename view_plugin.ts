import { ViewPlugin, DecorationSet, Decoration, ViewUpdate, EditorView } from '@codemirror/view';
import { StateEffect, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import ShikiHighlightPlugin from './main';

// Helper to check for bold/italic from Shiki fontstyle
// Shiki FontStyle: 1 = Italic, 2 = Bold, 4 = Underline
const FONT_STYLE = {
    ITALIC: 1,
    BOLD: 2,
    UNDERLINE: 4
};

export const themeChangeEffect = StateEffect.define<null>();

export const createShikiViewPlugin = (plugin: ShikiHighlightPlugin) => ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = Decoration.none;
        // Initial highlighting of the entire document or visible range
        // For safety/starting point, we use visible ranges, but expanded to full document scan
        // if we want to be sure. However, lazy loading key.
        // Let's start with visible ranges.
        this.updateDecorations(view, view.visibleRanges);
    }

    update(update: ViewUpdate) {
        // Step 1: Map existing decorations to new positions
        this.decorations = this.decorations.map(update.changes);

        // Step 2: Determine which ranges need updates
        // We update if the document changed, viewport changed, or theme changed
        if (update.docChanged || update.viewportChanged || update.transactions.some(tr => tr.effects.some(e => e.is(themeChangeEffect)))) {
            
            const rangesToUpdate: {from: number, to: number}[] = [];

            if (update.docChanged) {
                // If doc changed, update the changed ranges
                update.changes.iterChanges((fromA, toA, fromB, toB) => {
                    rangesToUpdate.push({ from: fromB, to: toB });
                });
            }

            // Always ensure visible ranges are up to date (handling lazy loading or scrolling)
            if (update.viewportChanged || !update.docChanged) {
                 rangesToUpdate.push(...update.view.visibleRanges);
            }

            // Highlighting
            if (rangesToUpdate.length > 0) {
                this.updateDecorations(update.view, rangesToUpdate);
            }
        }
    }

    updateDecorations(view: EditorView, ranges: readonly {from: number, to: number}[]) {
        if (!plugin.highlighter) {
            this.decorations = Decoration.none;
            return;
        }

        const add: Range<Decoration>[] = [];
        const uniqueBlocks = new Set<string>(); // To prevent duplicate work if ranges overlap
        
        // Define a filter to remove old decorations in the ranges we are about to update.
        // We remove any decoration that starts in the range we are scanning.
        const filter = (from: number, to: number) => {
            for (const range of ranges) {
                if (from >= range.from && from <= range.to) {
                    return false; // Remove
                }
            }
            return true; // Keep
        };

        const doc = view.state.doc;

        // Iterate through all requested ranges
        for (const range of ranges) {
            syntaxTree(view.state).iterate({
                from: range.from,
                to: range.to,
                enter: (node) => {
                    const name = node.name;
                    
                    if (name.includes('HyperMD-codeblock-begin') || name.includes('formatting-code-block-begin')) {
                        const startLine = doc.lineAt(node.from);
                        // Identify block by start position to deduplicate
                        if (uniqueBlocks.has(startLine.from.toString())) return;
                        uniqueBlocks.add(startLine.from.toString());

                        const match = startLine.text.match(/^`{3,}(\S*)/);
                        const lang = match ? match[1] : '';
                        
                        const blockContentStart = startLine.to + 1; // Start of next line
                        if (blockContentStart >= doc.length) return;

                        let blockContentEnd = -1;
                        let lineNo = startLine.number + 1;
                        
                        // Scan forward lines to find end
                        while(lineNo <= doc.lines) {
                           const l = doc.line(lineNo);
                           if (l.text.trim().startsWith('```')) {
                               blockContentEnd = l.from;
                               break;
                           }
                           lineNo++;
                        }
                        
                        // If no end found, highlight until end of doc (robustness)
                        if (blockContentEnd === -1) {
                            blockContentEnd = doc.length;
                        }

                        if (blockContentEnd > blockContentStart) {
                            this.highlightBlock(view, add, lang, blockContentStart, blockContentEnd);
                        }
                    }
                }
            });
        }
        
        // Apply update
        this.decorations = this.decorations.update({
             filter,
             add,
             sort: true // Ensure sorted ranges
        });
    }

    highlightBlock(view: EditorView, add: Range<Decoration>[], lang: string, from: number, to: number) {
        if (!plugin.highlighter || from >= to) return;
        
        const doc = view.state.doc;
        const code = doc.sliceString(from, to);
        
        const result = plugin.highlighter.highlight(code, lang);
        const lines = (result as any).tokens || result; 
        
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

                add.push(
                    Decoration.mark({
                        attributes: { style },
                        class: 'shiki-token'
                    }).range(currentPos, currentPos + tokenLen)
                );
                
                currentPos += tokenLen;
            }
            
            if (currentPos < to && doc.sliceString(currentPos, currentPos + 1) === '\n') {
                currentPos++;
            }
        }
    }
}, {
    decorations: v => v.decorations
});

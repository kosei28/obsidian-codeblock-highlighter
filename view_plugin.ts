import { ViewPlugin, DecorationSet, Decoration, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';
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
        this.updateDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.focusChanged || update.transactions.some(tr => tr.effects.some(e => e.is(themeChangeEffect)))) {
            this.updateDecorations(update.view);
        }
    }

    updateDecorations(view: EditorView) {
        if (!plugin.highlighter) {
            this.decorations = Decoration.none;
            return;
        }

        const builder = new RangeSetBuilder<Decoration>();
        const ranges = view.visibleRanges;
        const doc = view.state.doc;

        // We need to buffer code blocks to pass to Shiki
        // Simple strategy:
        // 1. Iterate tree to find ranges of code blocks (start/end lines)
        // 2. Extract content, highlight
        // 3. Map tokens back to document positions
        
        // Given Obsidian's structure, we might encounter multiple nodes per line.
        // We'll process by scanning line-by-line using the syntax tree to confirm it's a codeblock.
        
        for (const {from, to} of ranges) {
            // Expand range to cover full lines to ensure we capture block boundaries if they are just outside
            const startLine = doc.lineAt(from);
            const endLine = doc.lineAt(to);
            
            let inBlock = false;
            let blockStartPos = -1;
            let blockLang = '';
            let blockContentStart = -1;
            let blockContentEnd = -1;
            
            // Using internal iteration might be tricky with `iterate`.
            // Let's use a cursor for more control if needed, but iterate is fine if we respect order.
            
            // NOTE: This logic assumes we process "CodeBlock" or similar structure.
            // If traversing strictly by nodes:
            syntaxTree(view.state).iterate({
                from: startLine.from,
                to: endLine.to,
                enter: (node) => {
                    const name = node.name;
                    // Standard Markdown or Obsidian HyperMD
                    if (name.includes('HyperMD-codeblock-begin') || name.includes('formatting-code-block-begin')) {
                        inBlock = true;
                        blockStartPos = node.from;
                        // Extract language
                        const line = doc.lineAt(node.from);
                        const text = line.text;
                        const match = text.match(/^`{3,}(\S*)/);
                        blockLang = match ? match[1] : '';
                        blockContentStart = node.to; // Tentative, often includes newline
                    }
                    
                    if (name.includes('HyperMD-codeblock-end') || name.includes('formatting-code-block-end')) {
                        if (inBlock) {
                            blockContentEnd = node.from;
                            // Highlight the block
                            this.highlightBlock(view, builder, blockLang, blockContentStart, blockContentEnd);
                            inBlock = false;
                        }
                    }
                }
            });
        }
        this.decorations = builder.finish();
    }

    highlightBlock(view: EditorView, builder: RangeSetBuilder<Decoration>, lang: string, from: number, to: number) {
        if (!plugin.highlighter || from >= to) return;
        
        const doc = view.state.doc;
        const code = doc.sliceString(from, to);
        
        // Trim leading newline if present (Obsidian often puts content on next line)
        // Adjust 'from' accordingly
        // Shiki expects pure code.
        
        const result = plugin.highlighter.highlight(code, lang);
        // shiki v1 codeToTokens returns an object with 'tokens' property
        const lines = (result as any).tokens || result; 
        
        let currentPos = from;
        
        for (const line of lines) {
            for (const token of line) {
                if (!token.content) continue;
                
                // token.content is the string. We assume it matches the doc exactly.
                // We create a decoration for this range.
                const tokenLen = token.content.length;
                
                // Style construction
                let style = `color: ${token.color};`;
                if (token.fontStyle) {
                    if (token.fontStyle & FONT_STYLE.ITALIC) style += 'font-style: italic;';
                    if (token.fontStyle & FONT_STYLE.BOLD) style += 'font-weight: bold;';
                     if (token.fontStyle & FONT_STYLE.UNDERLINE) style += 'text-decoration: underline;';
                }

                // Add decoration
                // Ensure we don't overlap or go out of bounds?
                // RangeSetBuilder requires generic sorting.
                // We are iterating sequentially, so it should be fine.
                try {
                    builder.add(
                        currentPos,
                        currentPos + tokenLen,
                        Decoration.mark({
                            attributes: { style },
                            class: 'shiki-token'
                        })
                    );
                } catch (e) {
                    // Ignore overlap errors
                }
                
                currentPos += tokenLen;
            }
            // Shiki generic line break handling:
            // The tokens list usually doesn't contain the newline characters themselves?
            // "tokens is 2D array: line -> tokens".
            // We need to account for the newline in 'currentPos'.
            // Check if we need to advance for newline.
            // A simple way: currentPos++?
            // Depends on if code[currentPos] is \n.
            // Shiki splits by lines.
            
            // Check next char in doc
             if (currentPos < to && doc.sliceString(currentPos, currentPos + 1) === '\n') {
                currentPos++;
            }
        }
    }
}, {
    decorations: v => v.decorations
});

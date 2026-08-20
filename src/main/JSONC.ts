/*
 * Copyright (C) 2026 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

/** Controls how comments are removed by `JSONC.strip`. */
export type JSONCStripMode = "clean" | "preserve";

// ASCII character codes used by the scanner.
const HORIZONTAL_TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const DOUBLE_QUOTE = 0x22;
const ASTERISK = 0x2a;
const SLASH = 0x2f;
const BACKSLASH = 0x5c;

/**
 * Creates a position-preserving replacement for a comment.
 *
 * Every character except CR and LF is replaced with a space. Comments without line breaks use `String.repeat` directly and avoid the regular expression.
 *
 * @param text  - Complete JSONC source text.
 * @param start - Inclusive character offset of the comment.
 * @param end   - Exclusive character offset of the comment.
 * @returns Whitespace with the same length and CR/LF offsets as the comment.
 */
function preserveComment(text: string, start: number, end: number): string {
    // Scan for line breaks, which must remain at their original positions.
    for (let index = start; index < end; index++) {
        const char = text.charCodeAt(index);
        if (char === LINE_FEED || char === CARRIAGE_RETURN) {
            return text.slice(start, end).replace(/[^\r\n]/g, " ");
        }
    }

    // Fast path: A comment without line breaks can be replaced with an equally long whitespace string.
    return " ".repeat(end - start);
}

/**
 * Finds the closing quote of a JSON string.
 *
 * A quote closes the string only when preceded by an even number of backslashes. Native `indexOf` locates candidate quotes efficiently while
 * the short backwards scan determines their escape parity.
 *
 * @param text  - Complete JSONC source text.
 * @param start - Character offset immediately after the opening quote.
 * @returns Character offset of the closing quote, or `text.length` when the string is unterminated.
 */
function findStringEnd(text: string, start: number): number {
    let quote = start;
    while ((quote = text.indexOf("\"", quote)) !== -1) {
        let escape = quote - 1;

        // Count consecutive backslashes immediately preceding the quote.
        while (text.charCodeAt(escape) === BACKSLASH) {
            escape--;
        }

        // An even number of backslashes means the quote is not escaped.
        if ((quote - escape - 1 & 1) === 0) {
            return quote;
        }

        quote++;
    }

    // Return the text length when no closing quote was found.
    return text.length;
}

/**
 * Removes comments from JSONC source text with a single forward scan.
 *
 * Output storage is allocated lazily after the first actual comment. Clean mode also removes horizontal whitespace before comments and
 * complete comment-only lines. Preserve mode retains exact character offsets by replacing comment contents with whitespace.
 *
 * @param jsonc  - JSONC source text to transform.
 * @param clean  - `true` to produce clean output, `false` to preserve source offsets.
 * @returns Transformed JSON text, or the original string when no comment was found.
 * @throws {@link !SyntaxError} - When a block comment is not terminated.
 */
function stripComments(jsonc: string, clean: boolean): string {
    // Fast-path: Return JSON unchanged when there is no slash character at all.
    if (!jsonc.includes("/")) {
        return jsonc;
    }

    let parts: string[] | undefined;
    let copyStart = 0;
    let lastOutputChar = -1;

    // Forward scan through the JSONC string
    for (let index = 0; index < jsonc.length; index++) {
        const char = jsonc.charCodeAt(index);

        // Skip strings
        if (char === DOUBLE_QUOTE) {
            index = findStringEnd(jsonc, index + 1);
            continue;
        }

        // Skip non-slash characters
        if (char !== SLASH) {
            continue;
        }

        let commentEnd: number;
        const next = jsonc.charCodeAt(index + 1);
        if (next === SLASH) {
            // Find comment end in one-line comments
            commentEnd = index + 2;
            while (commentEnd < jsonc.length) {
                const commentChar = jsonc.charCodeAt(commentEnd);
                if (commentChar === LINE_FEED || commentChar === CARRIAGE_RETURN) {
                    break;
                }
                commentEnd++;
            }
        } else if (next === ASTERISK) {
            // Find comment end in multi-line comments
            const close = jsonc.indexOf("*/", index + 2);
            if (close === -1) {
                throw new SyntaxError(`Unterminated block comment at position ${index}`);
            }
            commentEnd = close + 2;
        } else {
            // Skip single slash. Not a comment.
            continue;
        }

        if (clean) {
            // Find start index of the comment (including leading whitespace) to remove
            let removeStart = index;
            while (removeStart > copyStart) {
                const previous = jsonc.charCodeAt(removeStart - 1);
                if (previous !== SPACE && previous !== HORIZONTAL_TAB) {
                    break;
                }
                removeStart--;
            }

            // Extend the removed range through trailing horizontal whitespace and the line break when this is a comment-only line.
            let removeEnd = commentEnd;
            const previous = removeStart === copyStart ? lastOutputChar : jsonc.charCodeAt(removeStart - 1);
            if (previous === -1 || previous === LINE_FEED || previous === CARRIAGE_RETURN) {
                let lineEnd = commentEnd;
                while (lineEnd < jsonc.length) {
                    const trailing = jsonc.charCodeAt(lineEnd);
                    if (trailing !== SPACE && trailing !== HORIZONTAL_TAB) {
                        break;
                    }
                    lineEnd++;
                }
                const lineBreak = jsonc.charCodeAt(lineEnd);
                if (lineBreak === CARRIAGE_RETURN) {
                    lineEnd++;
                    if (jsonc.charCodeAt(lineEnd) === LINE_FEED) {
                        lineEnd++;
                    }
                    removeEnd = lineEnd;
                } else if (lineBreak === LINE_FEED) {
                    removeEnd = lineEnd + 1;
                } else if (lineEnd === jsonc.length) {
                    removeEnd = lineEnd;
                }
            }

            // Append the text preceding the removed range.
            parts ??= [];
            if (removeStart > copyStart) {
                parts.push(jsonc.slice(copyStart, removeStart));
                lastOutputChar = jsonc.charCodeAt(removeStart - 1);
            }
            copyStart = removeEnd;
        } else {
            // Append the text preceding the comment and its position-preserving replacement.
            (parts ??= []).push(
                jsonc.slice(copyStart, index),
                preserveComment(jsonc, index, commentEnd)
            );
            copyStart = commentEnd;
        }
        index = commentEnd - 1;
    }

    // Return source unchanged when no comments were found
    if (parts === undefined) {
        return jsonc;
    }

    // Append remaining part of the JSONC source
    if (copyStart < jsonc.length) {
        parts.push(jsonc.slice(copyStart));
    }

    return parts.join("");
}

/** JSON-compatible parser and comment stripper. */
export class JSONC {
    private constructor() {}

    /**
     * Parses JSON with line and block comments.
     *
     * Comments are replaced with whitespace before the native `JSON.parse` is called, retaining their exact source offsets in parse errors.
     * The optional reviver is passed through unchanged.
     *
     * @param text    - JSONC source text to parse.
     * @param reviver - Optional native JSON reviver.
     * @returns Parsed JSON value.
     * @throws {@link !SyntaxError} - When the source text is not valid JSONC.
     */
    public static parse(text: string, reviver?: (this: any, key: string, value: any) => any): any {
        return JSON.parse(stripComments(text, false), reviver);
    }

    /**
     * Removes line and block comments from JSONC source text.
     *
     * Clean mode removes comment-only lines and preceding horizontal whitespace. Preserve mode replaces comment characters with spaces while
     * retaining the exact length and line-break offsets of the source text.
     *
     * @param text - JSONC source text.
     * @param mode - Comment removal mode. Defaults to `"clean"`.
     * @returns Strict JSON source text if the input was otherwise valid JSON.
     * @throws {@link !SyntaxError} - When a block comment is not terminated.
     */
    public static strip(text: string, mode: JSONCStripMode = "clean"): string {
        if (mode === "preserve") {
            return stripComments(text, false);
        }
        return stripComments(text, true);
    }
}

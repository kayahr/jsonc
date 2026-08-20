/*
 * Copyright (C) 2026 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from "node:test";
import { assertEquals, assertSame, assertThrowWithMessage, assertTrue } from "@kayahr/assert";
import { JSONC } from "../main/JSONC.ts";

describe("JSONC", () => {
    it("provides a static JSON-like API", () => {
        assertSame(typeof JSONC.parse, "function");
        assertSame(typeof JSONC.strip, "function");
        assertSame(JSONC.parse.length, JSON.parse.length);
    });

    it("returns comment-free JSON unchanged in both modes", () => {
        const text = "{\"answer\":42}";

        assertSame(JSONC.strip(text), text);
        assertSame(JSONC.strip(text, "preserve"), text);
    });

    it("leaves comment markers and escaped quotes inside strings untouched", () => {
        const text = String.raw`{"url":"https://example.test/a/*b*/","value":"\\\"// still a string"}`;

        assertSame(JSONC.strip(text), text);
        assertEquals(JSONC.parse(text), JSON.parse(text));
        assertSame(JSONC.strip("{\"unterminated\": \"//"), "{\"unterminated\": \"//");
    });

    it("ignores slashes which do not start a comment", () => {
        assertSame(JSONC.strip("1 / 2"), "1 / 2");
    });

    it("preserves character offsets and line endings", () => {
        const text = "{/* 😀 */\r\n// first\r\n\"a\": /* value */ 1}";
        const stripped = JSONC.strip(text, "preserve");

        assertSame(stripped, "{        \r\n        \r\n\"a\":             1}");
        assertSame(stripped.length, text.length);
        assertEquals([ ...stripped.matchAll(/\r|\n/g) ].map(match => match.index), [ ...text.matchAll(/\r|\n/g) ].map(match => match.index));
        assertEquals(JSON.parse(stripped), { a: 1 });
    });

    it("preserves line endings inside block comments", () => {
        const text = "{/* first\r\nsecond */\"a\": 1}";
        const stripped = JSONC.strip(text, "preserve");

        assertSame(stripped, "{        \r\n         \"a\": 1}");
        assertSame(stripped.length, text.length);
        assertEquals(JSON.parse(stripped), { a: 1 });
    });

    it("preserves long comments", () => {
        const text = `0/*${"x".repeat(300)}*/`;
        const stripped = JSONC.strip(text, "preserve");

        assertSame(stripped.length, text.length);
        assertSame(JSON.parse(stripped), 0);
    });

    it("uses clean mode by default and removes comment-only lines", () => {
        const text = [
            "{",
            "    // Description",
            "    \"name\": \"Knut\", // Application name",
            "    /* standalone block */",
            "    \"port\": /* Default port */ 8080",
            "}"
        ].join("\n");
        const expected = [
            "{",
            "    \"name\": \"Knut\",",
            "    \"port\": 8080",
            "}"
        ].join("\n");

        assertSame(JSONC.strip(text), expected);
        assertEquals(JSON.parse(expected), JSONC.parse(text));
    });

    it("handles CRLF and final comment lines in clean mode", () => {
        assertSame(JSONC.strip("{\r\n\t// first\r\n\t\"a\": 1\r\n}\r\n// end"), "{\r\n\t\"a\": 1\r\n}\r\n");
        assertSame(JSONC.strip("{}\n/* end */   "), "{}\n");
    });

    it("removes standalone multiline block comments", () => {
        const text = "{\n    /* first\n     * second\n     */\n    \"a\": 1\n}";

        assertSame(JSONC.strip(text), "{\n    \"a\": 1\n}");
    });

    it("removes lines containing multiple standalone block comments", () => {
        const text = "{\n    /* first */ /* second */\n    \"a\": 1\n}";

        assertSame(JSONC.strip(text), "{\n    \"a\": 1\n}");
        assertSame(JSONC.strip("/* first */ /* second */\n{}"), "{}");
    });

    it("parses a line comment at the end of input", () => {
        assertSame(JSONC.parse("42 // end"), 42);
    });

    it("rejects unterminated block comments", () => {
        assertThrowWithMessage(() => JSONC.parse("42 /* end"), SyntaxError, "Unterminated block comment at position 3");
        assertThrowWithMessage(() => JSONC.strip("42 /* end"), SyntaxError, "Unterminated block comment at position 3");
    });

    it("does not accidentally join invalid tokens", () => {
        assertThrowWithMessage(() => JSONC.parse("1/* comment */2"), SyntaxError, /.*/);
    });

    it("retains original positions in JSON.parse errors", () => {
        const text = "[/* comment */1 2]";

        assertThrowWithMessage(() => JSONC.parse(text), SyntaxError, /position 16 \(line 1 column 17\)$/);
    });

    it("retains strict JSON behavior", () => {
        assertThrowWithMessage(() => JSONC.parse("{\"a\": 1,}"), SyntaxError, /.*/);
        assertThrowWithMessage(() => JSONC.parse(""), SyntaxError, /.*/);
    });

    it("retains JSON.parse semantics for __proto__", () => {
        const value = JSONC.parse("{/* comment */\"__proto__\": {\"safe\": true}}") as Record<string, unknown>;

        assertTrue(Object.hasOwn(value, "__proto__"));
        assertSame(Object.getPrototypeOf(value), Object.prototype);
    });

    it("passes the JSON.parse reviver through", () => {
        const calls: Array<{ key: string; item: unknown }> = [];
        const value = JSONC.parse("{/* comment */\"value\": 21}", (key: string, item: unknown, context?: { source: string }) => {
            calls.push({ key, item });
            if (key === "value") {
                assertSame(context?.source, "21");
            }
            return key === "value" ? (item as number) * 2 : item;
        });

        assertEquals(value, { value: 42 });
        assertTrue(calls.some(call => call.key === "value" && call.item === 21));
    });

    it("handles unknown runtime modes like clean mode", () => {
        const text = "{\n    // comment\n    \"value\": 1\n}";

        assertSame(JSONC.strip(text, "pretty" as never), JSONC.strip(text));
    });
});

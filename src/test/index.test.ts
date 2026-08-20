/*
 * Copyright (C) 2026 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from "node:test";
import { assertAssignable, assertEquals } from "@kayahr/assert";
import * as exports from "../main/index.ts";
import { JSONC, type JSONCStripMode } from "../main/JSONC.ts";

describe("index", () => {
    it("exports relevant types and functions and nothing more", () => {
        // Check runtime exports
        assertEquals({ ...exports }, { JSONC });

        // Types can only be checked by TypeScript
        assertAssignable<JSONCStripMode, exports.JSONCStripMode>();
    });
});

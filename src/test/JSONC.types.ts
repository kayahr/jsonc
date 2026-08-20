/*
 * Copyright (C) 2026 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { JSONC } from "../main/index.ts";

// @ts-expect-error Unknown strip modes must be rejected at compile time.
JSONC.strip("{}", "pretty");

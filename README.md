# JSONC

[GitHub] | [NPM] | [API Doc]

A small and fast JSONC parser. It just removes comments and then delegates parsing to the native `JSON.parse` implementation.

## Features

- Uses native `JSON.parse`, including its optional reviver.
- Preserves exact source positions for parse errors.
- Can strip comments from JSON strings.
- Has no runtime dependencies.

Apart from comments, the input must be strict JSON. In particular, trailing commas are not accepted.

## Installation

```sh
npm install @kayahr/jsonc
```

## Parsing JSONC

Use `JSONC.parse` like `JSON.parse`:

```ts
import { JSONC } from "@kayahr/jsonc";

const config = JSONC.parse(`{
    // Server configuration
    "host": "localhost",
    "port": 8080
}`);
```

The optional reviver is passed directly to `JSON.parse`:

```ts
const config = JSONC.parse(source, (key, value) => key === "port" ? Number(value) : value);
```

Before parsing, every comment character is replaced with whitespace while CR and LF characters are retained. The resulting string therefore has the same length and line-break positions as the input, so positions reported by `JSON.parse` point into the original JSONC source.

## Stripping comments

`JSONC.strip` returns strict JSON without parsing it. It uses `"clean"` mode by default:

```ts
const jsonString = JSONC.strip(`{
    // Server configuration
    "host": "localhost", // Interface
    "port": 8080
}`);
```

The result keeps the surrounding formatting and removes standalone comment lines:

```json
{
    "host": "localhost",
    "port": 8080
}
```

Pass `"preserve"` when exact source offsets matter:

```ts
const jsonString = JSONC.strip(source, "preserve");
```

In `"preserve"` mode, comment characters become spaces and all CR and LF characters stay at their original offsets. `JSONC.parse` always uses this mode internally.

`JSONC.strip` is a lexical transformation and does not validate the result. Use `JSONC.parse` or `JSON.parse` when validation is required.

[GitHub]: https://github.com/kayahr/jsonc
[NPM]: https://www.npmjs.com/package/@kayahr/jsonc
[API Doc]: https://kayahr.github.io/jsonc/

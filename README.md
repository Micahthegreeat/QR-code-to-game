# QG Studio — maintainable source layout

This is a file-for-file refactor of the supplied single-page QG Studio. All codec algorithms and their encoded formats have been retained, including the optimized QG v2 prefix codes, 6-bit symbol slots, small-number coding, RGB555 palettes, base-5 and RLE sprite compression, Base39 sentinel conversion, and the v1 AST prototype.

## Files

- `index.html`: page markup and embedded default chess example
- `css/styles.css`: all original page styling
- `js/lexer-parser.js`: tokenizer and QG parser
- `js/legacy-codec.js`: v1 tagged AST encoder and decoder
- `js/binary-base39.js`: binary bit reader/writer, operators, and Base39 conversion
- `js/source-generator.js`: QG decompiler and HTML/JS runtime generator
- `js/optimized-codec.js`: optimized QG v2 compression and decompression
- `js/studio.js`: compile, decompile, preview, copy and download actions
- `js/routes.js`: version registry and game URL routing
- `js/startup.js`: startup event handlers and initial compilation
- `_redirects`: Cloudflare Pages route fallback

Run from this directory with `npx wrangler pages dev .` and open `http://localhost:8788`. Deploy the **entire directory**, not just `index.html`.

**Compatibility:** This preserves the supplied code's existing version registry: `/0/` uses optimized QG, `/1/` uses the AST prototype. The legacy Huffman `/0/` decoder was not present in the supplied source and has not been invented or added.

JavaScript files use classic deferred scripts, intentionally retaining shared top-level identifiers and their load order. No bundler is needed.


import argparse
from pathlib import Path

import minify_html


def minify_file(input_file, output_file=None):
    input_path = Path(input_file)

    if not input_path.is_file():
        print(f"File not found: {input_file}")
        return

    if output_file is None:
        output_path = input_path.with_name(
            input_path.stem + ".min.html"
        )
    else:
        output_path = Path(output_file)

    # Read original HTML
    html = input_path.read_text(encoding="utf-8")

    original_size = len(html.encode("utf-8"))

    # Minify HTML, embedded CSS, and embedded JavaScript
    compressed = minify_html.minify(
        html,
        minify_css=True,
        minify_js=True,
        remove_processing_instructions=False,
        keep_comments=False,
        keep_html_and_head_opening_tags=True,
        keep_closing_tags=True,
    )

    # Save compressed HTML
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(compressed, encoding="utf-8")

    compressed_size = len(compressed.encode("utf-8"))

    reduction = (
        (1 - compressed_size / original_size) * 100
        if original_size else 0
    )

    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Original size: {original_size:,} bytes")
    print(f"Compressed size: {compressed_size:,} bytes")
    print(f"Reduction: {reduction:.2f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Minify HTML with embedded CSS and JS"
    )

    parser.add_argument(
        "input",
        help="Input HTML file"
    )

    parser.add_argument(
        "-o", "--output",
        help="Output HTML file"
    )

    args = parser.parse_args()

    minify_file(args.input, args.output)

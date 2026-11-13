
# Examples:
# python Backend/main.py Backend/html-games/ Backend/trees/0.json
# python Backend/main.py Backend/html-text/ Backend/trees/1.json

import argparse
import subprocess
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

HTML_DIR = BASE_DIR / "html-games"
CONDENSED_DIR = BASE_DIR / "html-games-condensed"
ENCODED_DIR = BASE_DIR / "html-games-encoded"


def run_script(script, *args):
    """Run another Python script and stop if it fails."""
    command = [
        sys.executable,
        str(BASE_DIR / script),
        *map(str, args)
    ]

    print(f"\nRunning: {script}")

    subprocess.run(
        command,
        check=True,
        cwd=BASE_DIR
    )


def encode_html(filename, tree_file):
    # Resolve input HTML file
    input_path = Path(filename)

    if not input_path.is_absolute() and not input_path.exists():
        input_path = HTML_DIR / filename

    input_path = input_path.resolve()

    if not input_path.is_file():
        raise FileNotFoundError(
            f"HTML file not found: {input_path}"
        )

    # Resolve Huffman tree
    tree_path = Path(tree_file)

    if not tree_path.is_absolute() and not tree_path.exists():
        tree_path = BASE_DIR / tree_file

    tree_path = tree_path.resolve()

    if not tree_path.is_file():
        raise FileNotFoundError(
            f"Huffman tree not found: {tree_path}"
        )

    # Automatically determine tree ID from filename
    try:
        tree_id = int(tree_path.stem)
    except ValueError:
        raise ValueError(
            f"Tree filename must be a number, such as 0.json: {tree_path.name}"
        )

    if tree_id < 0:
        raise ValueError("Tree ID cannot be negative")

    # Create output directories
    CONDENSED_DIR.mkdir(parents=True, exist_ok=True)

    # Keep each tree's outputs separate
    tree_output_dir = ENCODED_DIR / str(tree_id)
    tree_output_dir.mkdir(parents=True, exist_ok=True)

    # Output filenames
    condensed_path = CONDENSED_DIR / input_path.name
    encoded_path = tree_output_dir / (
        input_path.stem + ".huff"
    )
    base39_path = tree_output_dir / (
        input_path.stem + ".txt"
    )
    qr_path = tree_output_dir / (
        input_path.stem + ".png"
    )

    print(f"Input HTML: {input_path}")
    print(f"Huffman tree: {tree_path}")
    print(f"Tree ID: {tree_id}")

    # Step 1: Minify HTML, CSS, and JavaScript
    run_script(
        "html-encode.py",
        input_path,
        "-o",
        condensed_path
    )

    # Step 2: Huffman encode the minified file
    run_script(
        "huffman.py",
        "encode",
        condensed_path,
        encoded_path,
        "-t",
        tree_path
    )

    # Step 3: Convert compressed bytes to Base-39
    run_script(
        "base39.py",
        encoded_path,
        "-o",
        base39_path
    )

    # Step 4: Generate QR code
    base39_data = base39_path.read_text(
        encoding="ascii"
    ).strip()

    url = (
        f"HTTPS://QR.MICAHKNOX.COM/"
        f"{tree_id}/{base39_data}"
    )

    run_script(
        "qr-generate.py",
        url,
        "-o",
        qr_path
    )

    # Print results
    original_size = input_path.stat().st_size
    condensed_size = condensed_path.stat().st_size
    encoded_size = encoded_path.stat().st_size

    print("\nENCODING COMPLETE")
    print("-" * 45)
    print(f"Tree ID:    {tree_id}")
    print(f"Original:   {original_size:,} bytes")
    print(f"Condensed:  {condensed_size:,} bytes")
    print(f"Encoded:    {encoded_size:,} bytes")

    if original_size:
        reduction = 100 * (
            1 - encoded_size / original_size
        )
        print(f"Reduction:  {reduction:.2f}%")

    print(f"\nQR URL: {url}")
    print(f"Output: {qr_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Minify and Huffman encode HTML using a selected tree"
    )

    parser.add_argument(
        "input",
        help="Original HTML filename or directory"
    )

    parser.add_argument(
        "tree",
        help="Huffman tree JSON filename or path (e.g. trees/0.json)"
    )

    args = parser.parse_args()

    try:
        input_path = Path(args.input)

        if not input_path.exists():
            input_path = HTML_DIR / args.input

        if input_path.is_dir():
            for file in sorted(input_path.rglob("*.html")):
                encode_html(file, args.tree)
        else:
            encode_html(input_path, args.tree)

    except (
        FileNotFoundError,
        subprocess.CalledProcessError,
        ValueError
    ) as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


import argparse
import subprocess
import sys
from pathlib import Path


# Directory containing main.py
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

    # Create output directories
    CONDENSED_DIR.mkdir(parents=True, exist_ok=True)
    ENCODED_DIR.mkdir(parents=True, exist_ok=True)

    # Output filenames
    condensed_path = CONDENSED_DIR / input_path.name
    encoded_path = ENCODED_DIR / (
        input_path.stem + ".huff"
    )

    print(f"Input HTML: {input_path}")
    print(f"Huffman tree: {tree_path}")

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

    # Step 3: encode to html string
    run_script(
        "base39.py",
        encoded_path,
        "-o",
        ENCODED_DIR / (input_path.stem + ".txt")
    )

    # Step 4: Generate QR code
    base39_path = ENCODED_DIR / (input_path.stem + ".txt")

    base39_data = base39_path.read_text(encoding="ascii").strip()

    url = "HTTPS://QR.MICAHKNOX.COM/0/" + base39_data

    qr_path = ENCODED_DIR / (input_path.stem + ".png")

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
    print(f"Original:   {original_size:,} bytes")
    print(f"Condensed:  {condensed_size:,} bytes")
    print(f"Encoded:    {encoded_size:,} bytes")

    if original_size:
        reduction = 100 * (
            1 - encoded_size / original_size
        )
        print(f"Reduction:  {reduction:.2f}%")

    print(f"\nOutput: {encoded_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Minify and Huffman encode an HTML game"
    )

    parser.add_argument(
        "input",
        help="Original HTML filename or path"
    )

    parser.add_argument(
        "tree",
        help="Huffman tree JSON filename or path"
    )

    args = parser.parse_args()

    try:
        input_path = Path(args.input)

        if not input_path.exists():
            input_path = HTML_DIR / args.input

        if input_path.is_dir():
            # Encode every HTML file in the folder
            for file in sorted(input_path.rglob("*.html")):
                encode_html(file, args.tree)
        else:
            # Encode a single file
            encode_html(input_path, args.tree)

    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

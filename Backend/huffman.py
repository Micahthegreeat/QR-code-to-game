
import argparse
import json
from pathlib import Path


def load_tree(tree_file):
    """Load the shared Huffman tree from JSON."""
    with open(tree_file, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_codes(tree, prefix="", codes=None):
    """Generate encoding codes from the Huffman tree."""
    if codes is None:
        codes = {}

    if isinstance(tree, int):
        codes[tree] = prefix or "0"
        return codes

    generate_codes(tree[0], prefix + "0", codes)
    generate_codes(tree[1], prefix + "1", codes)

    return codes


def encode(data, codes):
    """Compress bytes using Huffman encoding."""
    result = bytearray()
    current_byte = 0
    bit_count = 0

    for symbol in data:
        if symbol not in codes:
            raise ValueError(
                f"Byte {symbol} is missing from the Huffman tree"
            )

        for bit in codes[symbol]:
            current_byte = (current_byte << 1) | (bit == "1")
            bit_count += 1

            if bit_count == 8:
                result.append(current_byte)
                current_byte = 0
                bit_count = 0

    # Pad final byte with zeros
    if bit_count:
        current_byte <<= (8 - bit_count)
        result.append(current_byte)

    # Store original byte length in first 4 bytes
    if len(data) >= 2**32:
        raise ValueError("File exceeds 4 GB limit")

    return len(data).to_bytes(4, "big") + result


def decode(data, tree):
    """Decompress Huffman-encoded bytes."""
    if len(data) < 4:
        raise ValueError("Invalid compressed file")

    original_length = int.from_bytes(data[:4], "big")

    if original_length == 0:
        return b""

    result = bytearray()

    # Handle a tree containing only one symbol
    if isinstance(tree, int):
        return bytes([tree]) * original_length

    node = tree

    for byte in data[4:]:
        for bit_position in range(7, -1, -1):
            bit = (byte >> bit_position) & 1
            node = node[bit]

            if isinstance(node, int):
                result.append(node)

                if len(result) == original_length:
                    return bytes(result)

                node = tree

    raise ValueError("Compressed data ended prematurely")


def process_file(mode, input_file, output_file, tree_file):
    tree = load_tree(tree_file)

    input_path = Path(input_file)
    output_path = Path(output_file)

    data = input_path.read_bytes()

    if mode == "encode":
        codes = generate_codes(tree)
        result = encode(data, codes)

    elif mode == "decode":
        result = decode(data, tree)

    else:
        raise ValueError("Invalid mode")

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path.write_bytes(result)

    print(f"Mode: {mode}")
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Input size: {len(data):,} bytes")
    print(f"Output size: {len(result):,} bytes")

    if mode == "encode" and len(data):
        reduction = 100 * (1 - len(result) / len(data))
        print(f"Reduction: {reduction:.2f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Encode or decode using an existing Huffman tree"
    )

    parser.add_argument(
        "mode",
        choices=["encode", "decode"],
        help="Encode or decode a file"
    )

    parser.add_argument(
        "input",
        help="Input filename"
    )

    parser.add_argument(
        "output",
        help="Output filename"
    )

    parser.add_argument(
        "-t", "--tree",
        default="huffman-tree.json",
        help="Path to Huffman tree JSON"
    )

    args = parser.parse_args()

    process_file(
        args.mode,
        args.input,
        args.output,
        args.tree
    )

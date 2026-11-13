
import argparse
import json
from pathlib import Path


def load_tree(tree_file):
    """Load a shared Huffman tree from JSON."""
    with open(tree_file, "r", encoding="utf-8") as f:
        return json.load(f)


def is_leaf(node):
    return isinstance(node, (int, str))


def symbol_bytes(symbol):
    """Convert a tree symbol to its original bytes."""
    if isinstance(symbol, int):
        if not 0 <= symbol <= 255:
            raise ValueError(f"Invalid byte symbol: {symbol}")
        return bytes([symbol])

    if isinstance(symbol, str):
        if not symbol:
            raise ValueError("Empty token in Huffman tree")
        return symbol.encode("utf-8")

    raise ValueError(f"Invalid Huffman symbol: {symbol!r}")


def generate_codes(tree, prefix="", codes=None):
    """Generate Huffman codes for byte and string symbols."""
    if codes is None:
        codes = {}

    if is_leaf(tree):
        symbol = symbol_bytes(tree)

        if symbol in codes:
            raise ValueError(f"Duplicate Huffman symbol: {symbol!r}")

        codes[symbol] = prefix or "0"
        return codes

    if not isinstance(tree, list) or len(tree) != 2:
        raise ValueError("Invalid Huffman tree")

    generate_codes(tree[0], prefix + "0", codes)
    generate_codes(tree[1], prefix + "1", codes)

    return codes


def build_token_lookup(codes):
    """Index multi-byte tokens by their first byte."""
    lookup = {}

    for token in codes:
        if len(token) > 1:
            lookup.setdefault(token[0], []).append(token)

    # Longest matching tokens are checked first.
    for tokens in lookup.values():
        tokens.sort(key=lambda token: (-len(token), token))

    return lookup


def tokenize(data, codes):
    """Yield the longest available token at each position."""
    lookup = build_token_lookup(codes)
    position = 0

    while position < len(data):
        match = None

        for token in lookup.get(data[position], ()):
            if data.startswith(token, position):
                match = token
                break

        if match is None:
            match = data[position:position + 1]

        if match not in codes:
            raise ValueError(
                f"Byte {data[position]} is missing from the Huffman tree"
            )

        yield match
        position += len(match)


def encode(data, codes):
    """Compress bytes using byte or token Huffman coding."""
    if len(data) >= 2**32:
        raise ValueError("File exceeds 4 GB limit")

    result = bytearray()
    current_byte = 0
    bit_count = 0

    for token in tokenize(data, codes):
        for bit in codes[token]:
            current_byte = (current_byte << 1) | (bit == "1")
            bit_count += 1

            if bit_count == 8:
                result.append(current_byte)
                current_byte = 0
                bit_count = 0

    # Pad the final byte with zeros.
    if bit_count:
        current_byte <<= 8 - bit_count
        result.append(current_byte)

    # Preserve the original 4-byte length header.
    return len(data).to_bytes(4, "big") + result


def decode(data, tree):
    """Decompress byte or token Huffman data."""
    if len(data) < 4:
        raise ValueError("Invalid compressed file")

    original_length = int.from_bytes(data[:4], "big")

    if original_length == 0:
        return b""

    result = bytearray()

    # Handle a tree containing only one symbol.
    if is_leaf(tree):
        token = symbol_bytes(tree)

        if original_length % len(token) != 0:
            raise ValueError("Invalid decoded length")

        return token * (original_length // len(token))

    node = tree

    for byte in data[4:]:
        for bit_position in range(7, -1, -1):
            bit = (byte >> bit_position) & 1
            node = node[bit]

            if is_leaf(node):
                token = symbol_bytes(node)

                if len(result) + len(token) > original_length:
                    raise ValueError("Decoded data exceeds original length")

                result.extend(token)

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


import argparse
from pathlib import Path

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*+-"
BASE = len(ALPHABET)


def encode_base39(data):
    """Convert binary data into a Base-39 string."""
    if not data:
        return ""

    # Convert bytes to one large integer
    number = int.from_bytes(data, byteorder="big")

    # Preserve leading zero bytes
    leading_zeros = len(data) - len(data.lstrip(b"\x00"))

    if number == 0:
        return "0" * len(data)

    digits = []

    while number > 0:
        number, remainder = divmod(number, BASE)
        digits.append(ALPHABET[remainder])

    return "0" * leading_zeros + "".join(reversed(digits))


def decode_base39(encoded):
    """Convert a Base-39 string back into binary data."""
    if not encoded:
        return b""

    number = 0

    for char in encoded:
        if char not in ALPHABET:
            raise ValueError(f"Invalid Base-39 character: {char}")

        number = number * BASE + ALPHABET.index(char)

    leading_zeros = len(encoded) - len(encoded.lstrip("0"))

    if number == 0:
        return b"\x00" * len(encoded)

    byte_length = (number.bit_length() + 7) // 8

    return (
        b"\x00" * leading_zeros
        + number.to_bytes(byte_length, byteorder="big")
    )


def encode_file(filename):
    """Read a Huffman file and return its Base-39 encoding."""
    data = Path(filename).read_bytes()
    return encode_base39(data)


def main():
    parser = argparse.ArgumentParser(
        description="Convert Huffman binary data to Base-39"
    )

    parser.add_argument(
        "input",
        help="Input .huff file"
    )

    parser.add_argument(
        "-o", "--output",
        help="Optional output text file"
    )

    args = parser.parse_args()

    encoded = encode_file(args.input)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(encoded, encoding="ascii")
        print(f"Saved Base-39 data to: {output_path}")
    else:
        print(encoded)


if __name__ == "__main__":
    main()

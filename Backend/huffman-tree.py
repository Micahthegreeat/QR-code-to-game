
import argparse
import heapq
import json
from collections import Counter
from pathlib import Path


class Node:
    def __init__(self, frequency, symbol=None, left=None, right=None):
        self.frequency = frequency
        self.symbol = symbol
        self.left = left
        self.right = right


def build_huffman_tree(frequencies):
    heap = []
    counter = 0

    for symbol, frequency in sorted(frequencies.items()):
        heapq.heappush(
            heap,
            (frequency, counter, Node(frequency, symbol))
        )
        counter += 1

    while len(heap) > 1:
        freq1, _, left = heapq.heappop(heap)
        freq2, _, right = heapq.heappop(heap)

        parent = Node(
            freq1 + freq2,
            left=left,
            right=right
        )

        heapq.heappush(
            heap,
            (parent.frequency, counter, parent)
        )
        counter += 1

    return heap[0][2]


def tree_to_json(node):
    # Leaf nodes are byte values (0-255)
    if node.symbol is not None:
        return node.symbol

    # Internal nodes are [left, right]
    return [
        tree_to_json(node.left),
        tree_to_json(node.right)
    ]


def generate_tree(input_folder, output_file):
    input_folder = Path(input_folder)

    if not input_folder.is_dir():
        raise ValueError("Input folder does not exist")

    files = sorted(
        path for path in input_folder.rglob("*")
        if path.is_file()
    )

    if not files:
        raise ValueError("No files found in folder")

    # Include all 256 byte values for future compatibility
    frequencies = Counter({
        byte: 1 for byte in range(256)
    })

    total_bytes = 0

    print("Analyzing files...")

    for path in files:
        data = path.read_bytes()

        frequencies.update(data)
        total_bytes += len(data)

        print(f"  {path}: {len(data):,} bytes")

    # Build optimal shared Huffman tree
    tree = build_huffman_tree(frequencies)

    # Convert to compact JSON
    tree_json = tree_to_json(tree)

    output_path = Path(output_file)
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path.write_text(
        json.dumps(tree_json, separators=(",", ":")),
        encoding="utf-8"
    )

    print("\nHUFFMAN TREE GENERATED")
    print("-" * 40)
    print(f"Files analyzed: {len(files)}")
    print(f"Total input: {total_bytes:,} bytes")
    print(f"Unique symbols: 256")
    print(f"Tree size: {output_path.stat().st_size:,} bytes")
    print(f"Saved to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate a shared Huffman tree from a folder"
    )

    parser.add_argument(
        "input",
        help="Folder containing files to analyze"
    )

    parser.add_argument(
        "-o", "--output",
        default="huffman-tree.json",
        help="Output JSON filename"
    )

    args = parser.parse_args()

    generate_tree(args.input, args.output)
# python huffman-tree.py html-games-condensed -o json/huffman-tree.json
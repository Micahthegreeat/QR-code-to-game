import argparse
import heapq
import json
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Node:
    def __init__(self, freq, symbol=None, left=None, right=None):
        self.freq, self.symbol, self.left, self.right = freq, symbol, left, right

def build_tree(freq):
    heap = [(f, i, Node(f, s)) for i, (s, f) in enumerate(sorted(freq.items(), key=lambda x: (isinstance(x[0], str), x[0])))]
    heapq.heapify(heap)
    serial = len(heap)
    while len(heap) > 1:
        a, _, left = heapq.heappop(heap)
        b, _, right = heapq.heappop(heap)
        heapq.heappush(heap, (a+b, serial, Node(a+b, left=left, right=right)))
        serial += 1
    return heap[0][2]

def tree_json(node):
    if node.symbol is not None:
        return node.symbol
    return [tree_json(node.left), tree_json(node.right)]

def lengths(node, depth=0, result=None):
    if result is None:
        result = {}
    if node.symbol is not None:
        result[node.symbol] = max(depth, 1)
    else:
        lengths(node.left, depth+1, result)
        lengths(node.right, depth+1, result)
    return result

def tokenize(data, trie):
    i = 0
    while i < len(data):
        node, j, match = trie, i, None
        while j < len(data) and data[j] in node:
            node = node[data[j]]
            j += 1
            if None in node:
                match = node[None]
        if match is None:
            yield data[i]
            i += 1
        else:
            yield match.decode('latin1')
            i += len(match)

def make_trie(tokens):
    root = {}
    for token in tokens:
        node = root
        for byte in token:
            node = node.setdefault(byte, {})
        node[None] = token
    return root

def discover(files, min_length, max_length, min_count, max_tokens):
    # Count overlapping byte n-grams; score by approximate bytes saved.
    counts = Counter()
    for data in files:
        for n in range(min_length, max_length+1):
            counts.update(data[i:i+n] for i in range(len(data)-n+1))
    ranked = [(count*(len(token)-1), token) for token, count in counts.items()
              if count >= min_count]
    ranked.sort(key=lambda x: (-x[0], -len(x[1]), x[1]))
    return [token for _, token in ranked[:max_tokens]]

def estimate(files, tree, trie=None):
    sizes = []
    codes = lengths(tree)
    for data in files:
        symbols = tokenize(data, trie) if trie is not None else data
        bits = sum(codes[s] for s in symbols)
        sizes.append(4 + (bits+7)//8)
    return sizes

def main():
    parser = argparse.ArgumentParser(description='Compare byte and token Huffman trees')
    parser.add_argument('input', help='Folder of HTML files')
    parser.add_argument('-o', '--output', default='trees/0.json')
    parser.add_argument('--baseline', default='trees/baseline.json')
    parser.add_argument('--min-length', type=int, default=3)
    parser.add_argument('--max-length', type=int, default=16)
    parser.add_argument('--min-count', type=int, default=4)
    parser.add_argument('--max-tokens', type=int, default=128)
    args = parser.parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        input_path = BASE_DIR / input_path

    paths = sorted(p for p in input_path.rglob('*') if p.is_file())
    if not paths:
        parser.error('No input files found')
    files = [p.read_bytes() for p in paths]
    base_freq = Counter({i: 1 for i in range(256)})
    for data in files:
        base_freq.update(data)
    base_tree = build_tree(base_freq)
    candidates = discover(files, args.min_length, args.max_length,
                          args.min_count, args.max_tokens)
    # Greedy longest match, with only tokens that actually appear in tokenization.
    trie = make_trie(candidates)
    token_freq = Counter({i: 1 for i in range(256)})
    for data in files:
        token_freq.update(tokenize(data, trie))
    # Remove unused string tokens to avoid bloating the tree.
    active = [s.encode('latin1') for s in token_freq if isinstance(s, str)]
    trie = make_trie(active)
    token_tree = build_tree(token_freq)
    for filename, tree in [(args.baseline, base_tree), (args.output, token_tree)]:
        path = Path(filename)

        if not path.is_absolute():
            path = BASE_DIR / path

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(tree_json(tree), separators=(",", ":")),
            encoding="utf-8"
        )
    old = estimate(files, base_tree)
    new = estimate(files, token_tree, trie)
    print(f'Files: {len(files)} | Tokens: {len(active)}')
    print(f'{"File":28} {"Input":>8} {"Bytes":>8} {"Tokens":>8} {"Saved":>8}')
    for path, data, a, b in zip(paths, files, old, new):
        print(f'{path.name[:28]:28} {len(data):8,} {a:8,} {b:8,} {a-b:+8,}')
    a, b = sum(old), sum(new)
    print(f'{"TOTAL":28} {sum(map(len, files)):8,} {a:8,} {b:8,} {a-b:+8,} ({(a-b)/a*100:+.2f}%)')
    old_tree_size = (BASE_DIR / args.baseline).stat().st_size
    new_tree_size = (BASE_DIR / args.output).stat().st_size
    print(f'Tree JSON sizes: {old_tree_size:,} vs {new_tree_size:,} bytes')
    print(f'Including one copy of shared tree: {a+old_tree_size:,} vs {b+new_tree_size:,} bytes')
    print('Note: estimated .huff bytes; actual QR Base39 length depends on binary values.')
    print('Token tree uses latin1 strings for raw byte sequences; update encoder and browser decoder.')

if __name__ == '__main__':
    main()

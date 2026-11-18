#!/usr/bin/env python3
"""Analyze a JS-like QR game language by directory and filename suffix.

Usage:
  python analyze_qg.py ./html-games --suffix .qg .txt --out ./analysis
  python analyze_qg.py ./games --suffix .qg --group-depth 1
"""
import argparse
import collections
import csv
import json
import re
from pathlib import Path

TOKEN = re.compile(r'''(?P<space>\s+)|(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)|(?P<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?P<number>(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?))|(?P<identifier>[A-Za-z_$][\w$]*)|(?P<operator>===|!==|>>>|\*\*=|>>=|<<=|\?\?|\?\.|=>|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|/=|%=|\*\*|<<|>>|[+*/%<>=!&|^~?:-])|(?P<punct>[{}()\[\],;.])|(?P<other>.)''')
SPRITE = re.compile(r'\bsprite\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{([\s\S]*?)\}', re.M)
PALETTE = re.compile(r'\bpalette\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]\s*;', re.M)
KEYWORDS = {'let','const','var','fn','function','if','else','for','while','do','return','break','continue','sprite','palette','true','false','null'}
UNARY_CONTEXT = {'=', '(', '[', '{', ',', ':', '?', 'return', '=>', '+', '-', '*', '/', '%', '<', '>', '<=', '>=', '==', '===', '!=', '!==', '&&', '||', '!', ';'}

def strip_special(source, result):
    def sprite_match(m):
        rows = re.findall(r'(?m)^\s*([0-4]+)\s*$', m.group(3))
        result['features']['sprite_declaration'] += 1
        result['sprite_pixels'].update(''.join(rows))
        result['features']['sprite_rows'] += len(rows)
        result['features']['sprite_total_pixels'] += sum(map(len, rows))
        result['features']['sprite_width_mismatch'] += int(bool(rows and len(set(map(len, rows))) > 1))
        return ' ' * len(m.group())
    source = SPRITE.sub(sprite_match, source)
    def palette_match(m):
        result['features']['palette_declaration'] += 1
        result['features']['palette_colors'] += len(re.findall(r'#[0-9a-fA-F]{3,8}\b', m.group(2)))
        return ' ' * len(m.group())
    return PALETTE.sub(palette_match, source)

def analyze(source):
    result = {k: collections.Counter() for k in ('instructions','operators','numbers','identifiers','sprite_pixels','features','calls')}
    source = strip_special(source, result)
    tokens = [(m.lastgroup, m.group()) for m in TOKEN.finditer(source) if m.lastgroup not in ('space','comment')]
    prev = None
    for i, (kind, val) in enumerate(tokens):
        nxt = tokens[i+1][1] if i+1 < len(tokens) else None
        if kind == 'identifier':
            if val in KEYWORDS:
                result['instructions'][val] += 1
            elif nxt == '(':
                result['instructions'][val] += 1
                result['calls'][val] += 1
            else:
                result['identifiers'][val] += 1
        elif kind == 'number':
            result['numbers'][val] += 1
        elif kind == 'operator':
            op = val
            if val in ('-', '+') and (prev is None or prev in UNARY_CONTEXT):
                if nxt is not None and i+1 < len(tokens) and tokens[i+1][0] == 'number':
                    op = 'unary' + val
                else:
                    op = 'unary' + val
            result['operators'][op] += 1
        if kind == 'identifier' and val in ('true','false','null'):
            result['features']['literal_'+val] += 1
        if kind == 'punct' and val == '[':
            result['features']['array_brackets'] += 1
        if kind == 'punct' and val == '.':
            result['features']['property_access'] += 1
        prev = val
    result['features']['tokens'] += len(tokens)
    return result

def aggregate(items):
    out = {k: collections.Counter() for k in ('instructions','operators','numbers','identifiers','sprite_pixels','features','calls')}
    for item in items:
        for k in out:
            out[k].update(item[k])
    return out

def write_csv(path, rows, columns):
    with path.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(rows)

def main():
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument('root', type=Path, help='Root folder containing game files')
    p.add_argument('--suffix', nargs='+', default=['.qg'],
                   help='File extensions, e.g. .qg .txt .js, or * for all')
    p.add_argument('--out', type=Path, default=Path('qg-analysis'))
    p.add_argument('--group-depth', type=int, default=1)
    p.add_argument('--encoding', default='utf-8')

    args = p.parse_args()
    root = args.root.resolve()

    if not root.is_dir():
        p.error(f'Not a directory: {root}')

    suffixes = {
        s.lower() if s.startswith('.') else '.' + s.lower()
        for s in args.suffix if s != '*'
    }

    files = sorted(
        f for f in root.rglob('*')
        if f.is_file()
        and ('*' in args.suffix or f.suffix.lower() in suffixes)
        and args.out.resolve() not in f.resolve().parents
    )

    print(f"Searching: {root}")
    print(f"Found {len(files)} matching files")

    if not files:
        print("No matching files found. Try --suffix '*'")
        return

    per_file = []
    groups = collections.defaultdict(list)

    for file in files:
        try:
            source = file.read_text(encoding=args.encoding)
            result = analyze(source)
        except (OSError, UnicodeError) as e:
            print(f"Skipping {file}: {e}")
            continue

        relative = file.relative_to(root)
        parts = relative.parts[:-1]

        if args.group_depth == 0:
            group = "ALL"
        else:
            group = "/".join(parts[:args.group_depth]) or "ROOT"

        groups[group].append(result)
        per_file.append((str(relative), group, result))

        print(f"Analyzed: {relative}")

    if not per_file:
        print("No files could be analyzed.")
        return

    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=True)

    total = aggregate([r for _, _, r in per_file])
    group_results = {
        name: aggregate(results)
        for name, results in groups.items()
    }

    categories = [
        'instructions',
        'operators',
        'numbers',
        'identifiers',
        'sprite_pixels',
        'features',
        'calls'
    ]

    # Print overall results
    print("\n" + "=" * 60)
    print("OVERALL ANALYSIS")
    print("=" * 60)

    for category in categories:
        print(f"\n{category.upper()}")
        print("-" * 40)

        for name, count in total[category].most_common(30):
            print(f"{name:<25} {count:>8}")

    # Print per-folder results
    for group, result in sorted(group_results.items()):
        print("\n" + "=" * 60)
        print(f"FOLDER: {group}")
        print("=" * 60)

        for category in ('instructions', 'operators'):
            print(f"\n{category.upper()}")

            for name, count in result[category].most_common(20):
                print(f"{name:<25} {count:>8}")

    # Export frequency CSV
    frequency_rows = []

    for group, result in [('ALL', total), *sorted(group_results.items())]:
        for category in categories:
            for name, count in result[category].most_common():
                frequency_rows.append({
                    'folder': group,
                    'category': category,
                    'name': name,
                    'count': count
                })

    write_csv(
        output / 'frequencies.csv',
        frequency_rows,
        ['folder', 'category', 'name', 'count']
    )

    # Export per-file CSV
    file_rows = []

    for filename, group, result in per_file:
        for category in categories:
            for name, count in result[category].items():
                file_rows.append({
                    'file': filename,
                    'folder': group,
                    'category': category,
                    'name': name,
                    'count': count
                })

    write_csv(
        output / 'per_file.csv',
        file_rows,
        ['file', 'folder', 'category', 'name', 'count']
    )

    # Export JSON
    report = {
        'root': str(root),
        'files_analyzed': len(per_file),
        'total': {
            category: dict(total[category])
            for category in categories
        },
        'folders': {
            group: {
                category: dict(result[category])
                for category in categories
            }
            for group, result in group_results.items()
        },
        'files': {
            filename: {
                'folder': group,
                **{
                    category: dict(result[category])
                    for category in categories
                }
            }
            for filename, group, result in per_file
        }
    }

    with (output / 'report.json').open('w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 60)
    print("ANALYSIS COMPLETE")
    print("=" * 60)
    print(f"Files analyzed: {len(per_file)}")
    print(f"Folders analyzed: {len(groups)}")
    print(f"Results saved to: {output}")
    print("  frequencies.csv")
    print("  per_file.csv")
    print("  report.json")


if __name__ == "__main__":
    main()
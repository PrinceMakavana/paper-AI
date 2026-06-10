#!/usr/bin/env python3
"""Fix JSON escape errors in 2150704-0-page_index.json"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "2150704-0-page_index.json"

with open(path) as f:
    content = f.read()

# Fix 1: invalid \X and \] in Java code example
content = content.replace("String\\X\\]", "String\\\\X\\\\]")

# Fix 2: invalid \™ in "Java™" examples
content = content.replace('\\"Java\\™\\"', '\\"Java™\\"')

# Fix 3: invalid \⊗
content = content.replace("'\\⊗'", "'⊗'")

# Fix 4: escape sequences table (continued) — replace broken rows with valid JSON escapes
def json_encode_fragment(s: str) -> str:
    """Encode text for embedding inside a JSON string value (no surrounding quotes)."""
    return json.dumps(s, ensure_ascii=False)[1:-1]


marker = "Escape Sequences for Special Characters (continued)"
idx = content.find(marker)
if idx != -1:
    start = content.find("|  ", idx)
    end = content.find("\\n\\nTo fully understand the char type", start)
    if start != -1 and end != -1:
        fixed_rows = (
            "|  \\\" | Double quote | \\\"  |\n"
            "|  \\' | Single quote | \\'  |\n"
            "|  \\\\ | Backslash | \\  |"
        )
        fixed_table = json_encode_fragment(fixed_rows)
        content = content[:start] + fixed_table + content[end:]

try:
    json.loads(content)
except json.JSONDecodeError as e:
    print(f"Still invalid at pos {e.pos}: {e.msg}")
    print(repr(content[max(0, e.pos - 80) : e.pos + 80]))
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print(f"Fixed {path} — JSON validates successfully")

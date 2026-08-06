from pathlib import Path

p = Path(__file__).resolve().parents[2] / "frontend" / ".env.local"
text = p.read_text(encoding="utf-8") if p.exists() else ""
lines: list[str] = []
seen: set[str] = set()
for line in text.splitlines():
    if line.startswith("NEXT_PUBLIC_USE_MOCK_API="):
        lines.append("NEXT_PUBLIC_USE_MOCK_API=false")
        seen.add("USE_MOCK")
    elif line.startswith("NEXT_PUBLIC_API_URL="):
        lines.append("NEXT_PUBLIC_API_URL=http://localhost:8000")
        seen.add("API_URL")
    elif line.startswith("NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID="):
        lines.append(line)
        seen.add("ORG")
    else:
        lines.append(line)

if "USE_MOCK" not in seen:
    lines.append("NEXT_PUBLIC_USE_MOCK_API=false")
if "API_URL" not in seen:
    lines.append("NEXT_PUBLIC_API_URL=http://localhost:8000")
if "ORG" not in seen:
    lines.append("NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=org_demo_001")

p.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
print("updated", p)
for line in lines:
    if line.startswith("NEXT_PUBLIC_"):
        print(line)

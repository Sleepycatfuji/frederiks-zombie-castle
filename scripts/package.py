"""Build a portable source ZIP without hosted identity, credentials, or nested ZIPs."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / "dist" / "zombie-castle-defense.zip"
include = [root / p for p in ("dist", "tests", "scripts", ".github", "README.md", "MIGRATION.md", "LICENSE", "package.json", ".gitignore")]
files = []
for item in include:
    files.extend(item.rglob("*") if item.is_dir() else [item])
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        if file.is_file() and file != target and "__pycache__" not in file.parts:
            archive.write(file, Path("zombie-castle-defense") / file.relative_to(root))
print(f"Created {target.name}: {target.stat().st_size:,} bytes")

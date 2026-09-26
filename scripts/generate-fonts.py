"""Optional font rebuild: python -m pip install 'fonttools[woff]==4.64.0'."""
from pathlib import Path
from fontTools.ttLib import TTFont

font_dir = Path(__file__).resolve().parents[1] / "public" / "fonts"
for source in sorted([*font_dir.glob("*.ttf"), *font_dir.glob("*.otf")]):
    with TTFont(source) as font:
        font.flavor = "woff2"
        font.save(source.with_suffix(".woff2"))
    print(f"{source.name}: {source.stat().st_size} → {source.with_suffix('.woff2').stat().st_size} bytes")

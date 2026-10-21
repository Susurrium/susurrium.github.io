"""Optional font rebuild: python -m pip install 'fonttools[woff]==4.64.0'."""
from pathlib import Path
from fontTools.ttLib import TTFont

font_dir = Path(__file__).resolve().parents[1] / "public" / "fonts"
output_dir = Path(__file__).resolve().parents[1] / "src" / "assets" / "fonts"
output_dir.mkdir(parents=True, exist_ok=True)
for source in sorted([*font_dir.glob("*.ttf"), *font_dir.glob("*.otf")]):
    with TTFont(source, recalcTimestamp=False) as font:
        font.flavor = "woff2"
        output = output_dir / source.with_suffix(".woff2").name
        font.save(output)
    print(f"{source.name}: {source.stat().st_size} → {output.stat().st_size} bytes")

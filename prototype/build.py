#!/usr/bin/env python3
"""PARKLY build: inline src/core.css, src/data.js, src/engine.js into the mobile and desktop
pages and write single self-contained files to out/.

Include markers (exact text, placed inside <style>/<script> tags):
  <!--#include core.css-->   <!--#include data.js-->   <!--#include engine.js-->
Missing pages or include sources are skipped with a warning, so the build never crashes.
Usage: python3 build.py            (builds both)
       python3 build.py smoke      (also builds out/_smoke.html from src/_smoke.html)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "out"
VERSION = "v1.0"
PAGES = {
    "mobile.html": f"PARKLY_Mobile_{VERSION}.html",
    "desktop.html": f"PARKLY_Desktop_{VERSION}.html",
}
INCLUDE = re.compile(r"<!--#include\s+([\w.\-]+)\s*-->")


def inline(text: str, page: str) -> str:
    def repl(m: re.Match) -> str:
        name = m.group(1)
        path = SRC / name
        if not path.exists():
            print(f"  ! {page}: include {name} not found, left empty")
            return f"/* {name} missing at build time */"
        body = path.read_text(encoding="utf-8")
        # a literal </script> inside JS would end the tag early
        if name.endswith(".js"):
            body = body.replace("</script", "<\\/script")
        return body

    return INCLUDE.sub(repl, text)


def build(src_name: str, out_name: str) -> None:
    src = SRC / src_name
    if not src.exists():
        print(f"  - skip {src_name} (not written yet)")
        return
    html = inline(src.read_text(encoding="utf-8"), src_name)
    OUT.mkdir(exist_ok=True)
    dest = OUT / out_name
    dest.write_text(html, encoding="utf-8")
    print(f"  + {dest.relative_to(ROOT)}  ({len(html.encode('utf-8')) / 1024:.0f} KB)")


def main() -> None:
    print("PARKLY build")
    for s, o in PAGES.items():
        build(s, o)
    if "smoke" in sys.argv[1:]:
        build("_smoke.html", "_smoke.html")


if __name__ == "__main__":
    main()

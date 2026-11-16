#!/usr/bin/env python3
"""Build one thin SCORM 1.2 launcher zip per lab in labs/catalog.json.

Usage:  python3 tools/build_launchers.py            (writes to scorm/dist/)
Upload each zip to Canvas once. Lab fixes published to the site reach
every course without re-uploading, because the zip only points at the site.
"""
import json, pathlib, zipfile
from xml.sax.saxutils import escape

root = pathlib.Path(__file__).resolve().parent.parent
cat = json.loads((root / "labs" / "catalog.json").read_text(encoding="utf-8"))
src = root / "scorm" / "launcher"
out = root / "scorm" / "dist"
out.mkdir(parents=True, exist_ok=True)

for lab in cat["labs"]:
    title = "Lab: " + lab["title"]
    def fill(text, xml):
        t = escape(title) if xml else title.replace("&", "&amp;").replace("<", "&lt;")
        return text.replace("__TITLE__", t).replace("__SITE__", cat["site"]).replace("__LAB__", lab["id"])
    path = out / f"launcher-{lab['id']}.zip"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("imsmanifest.xml", fill((src / "imsmanifest.xml").read_text(encoding="utf-8"), True))
        z.writestr("index.html", fill((src / "index.html").read_text(encoding="utf-8"), False))
    print("built", path.relative_to(root))

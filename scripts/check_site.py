#!/usr/bin/env python3
"""Lightweight, dependency-free sanity check for the showcase.

Checks the data snapshot schema, the static HTML (ids, anchors, local assets,
image alts), and the presence of the files the page needs. Run it locally or
from CI before committing.
"""

from __future__ import annotations

import json
import os
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_FILES = ["index.html", "404.html"]
REQUIRED_FILES = [
    "index.html", "style.css", "app.js", "content.js", "data.json",
    "404.html", "robots.txt", ".nojekyll", "assets/preview.jpg",
    "site.webmanifest", "assets/icon-192.png", "assets/icon-512.png",
    "assets/apple-touch-icon.png", "assets/fonts/inter-subset.woff2",
    "assets/fonts/mochiy-subset.woff2", "assets/fonts/noto-display.woff2",
    "scripts/fetch_bgm.py",
]
DATA_COLLECTION_KEYS = {
    "subject_id", "subject_type", "type", "rate", "ep_status", "updated_at", "subject",
}
DATA_SUBJECT_KEYS = {"id", "name", "name_cn", "date", "score", "rank", "images"}
VALID_TYPES = {1, 2, 3, 4, 6}
VALID_STATUS = {1, 2, 3, 4, 5}

errors: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


class Doc(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.anchors: list[str] = []
        self.local_refs: list[str] = []
        self.images_without_alt: int = 0
        self.lang = ""
        self.has_viewport = False
        self.sections: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "meta" and a.get("name") == "viewport":
            self.has_viewport = True
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "section" and a.get("id"):
            self.sections.add(a["id"])
        if tag == "img" and "alt" not in a:
            self.images_without_alt += 1
        if tag == "a" and "href" in a:
            self.anchors.append(a["href"])
            self._record_ref(a["href"])
        if tag in ("link", "script") and ("href" in a or "src" in a):
            self._record_ref(a.get("href") or a.get("src"))

    def _record_ref(self, ref: str) -> None:
        if not ref:
            return
        if ref.startswith(("#", "http://", "https://", "data:", "mailto:", "tel:", "//")):
            return
        self.local_refs.append(ref.split("?")[0].split("#")[0])


def check_files() -> None:
    for name in REQUIRED_FILES:
        if not os.path.isfile(os.path.join(ROOT, name)):
            fail(f"missing required file: {name}")


def check_manifest() -> None:
    path = os.path.join(ROOT, "site.webmanifest")
    with open(path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    if not manifest.get("name") or not manifest.get("short_name"):
        fail("site.webmanifest: name/short_name missing")
    if manifest.get("start_url") != "./":
        fail("site.webmanifest: start_url should be ./")
    icons = manifest.get("icons") or []
    if not icons:
        fail("site.webmanifest: no icons")
    for icon in icons:
        src = icon.get("src", "")
        if not src or not os.path.isfile(os.path.join(ROOT, src)):
            fail(f"site.webmanifest: icon missing: {src}")
        if "sizes" not in icon or "type" not in icon:
            fail(f"site.webmanifest: icon metadata incomplete: {src}")


def check_html(name: str) -> Doc:
    path = os.path.join(ROOT, name)
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    doc = Doc()
    doc.feed(source)
    doc.close()

    if not doc.lang:
        fail(f"{name}: <html> has no lang")
    if not doc.has_viewport:
        fail(f"{name}: missing viewport meta")
    if doc.images_without_alt:
        fail(f"{name}: {doc.images_without_alt} <img> without alt")

    seen = set()
    for value in doc.ids:
        if value in seen:
            fail(f"{name}: duplicate id #{value}")
        seen.add(value)

    for ref in doc.local_refs:
        if ref and not os.path.isfile(os.path.join(ROOT, ref)):
            fail(f"{name}: local asset not found: {ref}")

    for href in doc.anchors:
        if href.startswith("#") and href != "#":
            target = href[1:]
            if target and target not in seen:
                fail(f"{name}: anchor target not found: {href}")
    return doc


def check_data() -> dict:
    path = os.path.join(ROOT, "data.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

    meta = data.get("meta") or {}
    profile = data.get("profile") or {}
    collections = data.get("collections") or []
    characters = data.get("characters") or {}
    featured = data.get("featured") or {}

    if not profile.get("username"):
        fail("data.profile.username is missing")
    if not profile.get("nickname"):
        fail("data.profile.nickname is missing")
    if meta.get("count") != len(collections):
        fail(f"data.meta.count ({meta.get('count')}) != collections ({len(collections)})")
    if len(collections) < 100:
        fail("data.collections is unexpectedly small")
    if len(characters) < 1:
        fail("data.characters is empty")
    if not featured.get("id"):
        fail("data.featured.id is missing")

    seen = set()
    for i, c in enumerate(collections):
        missing = DATA_COLLECTION_KEYS - set(c)
        if missing:
            fail(f"collection[{i}] missing keys: {sorted(missing)}")
            continue
        sid = c.get("subject_id")
        if sid in seen:
            fail(f"duplicate subject_id: {sid}")
        seen.add(sid)
        if c.get("subject_type") not in VALID_TYPES:
            fail(f"collection {sid}: invalid subject_type {c.get('subject_type')}")
        if c.get("type") not in VALID_STATUS:
            fail(f"collection {sid}: invalid status {c.get('type')}")
        if not isinstance(c.get("rate"), int) or not 0 <= c["rate"] <= 10:
            fail(f"collection {sid}: invalid rate {c.get('rate')}")
        s = c.get("subject") or {}
        missing = DATA_SUBJECT_KEYS - set(s)
        if missing:
            fail(f"collection {sid} subject missing keys: {sorted(missing)}")
        if not s.get("name"):
            fail(f"collection {sid} subject has no name")

    size_kb = os.path.getsize(path) / 1024
    notes.append(f"data: {len(collections)} collections, {len(characters)} characters, {size_kb:.0f} KiB")
    return data


def main() -> int:
    check_files()
    check_manifest()
    index = check_html("index.html")
    check_html("404.html")
    data = check_data()

    menu_targets = [
        a[1:] for a in index.anchors
        if a.startswith("#") and len(a) > 1 and a[1:] in index.sections
    ]
    if not menu_targets:
        fail("index.html: no in-page section anchors found")
    if "top" not in index.sections:
        fail("index.html: missing #top section")

    print("KOKO / ACGN Archive — site check")
    for note in notes:
        print("  ·", note)
    if errors:
        print("\nFAILED:")
        for error in errors:
            print("  ✗", error)
        return 1
    print("  ✓ HTML ids, anchors, local assets, image alts and data schema look good")
    print(f"  ✓ {len(menu_targets)} in-page section targets")
    return 0


if __name__ == "__main__":
    sys.exit(main())

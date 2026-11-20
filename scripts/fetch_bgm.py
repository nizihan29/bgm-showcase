#!/usr/bin/env python3
"""Snapshot public Bangumi data for the showcase.

Usage:
    python3 scripts/fetch_bgm.py

Writes data.json next to index.html. No token is required: only public
collections are read. Character ids live in CHARACTER_IDS below.

The API is rate limited; the script sleeps between requests and retries
429/5xx responses with exponential backoff.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

USERNAME = os.environ.get("BGM_USERNAME", "m1n")
API = "https://api.bgm.tv/v0"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.json")
UA = "bgm-showcase/2.0 (personal ACGN archive; contact: bgm.tv/user/m1n)"

SUBJECT_TYPES = [2, 1, 4, 3, 6]  # anime, book, game, music, real
CHARACTER_IDS = [3575, 24760, 19041, 14823, 53770]
FEATURED_SUBJECT = 554779  # 生徒会にも穴はある！


def get(path: str, tries: int = 6):
    url = API + path
    delay = 1.0
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=40) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504):
                raise
            print(f"  ! HTTP {exc.code} on {path}; retry in {delay:.0f}s", file=sys.stderr)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"  ! {exc} on {path}; retry in {delay:.0f}s", file=sys.stderr)
        time.sleep(delay)
        delay = min(delay * 2, 30)
    raise RuntimeError("giving up on " + path)


def slim_subject(s: dict) -> dict:
    images = s.get("images") or {}
    return {
        "id": s.get("id"),
        "name": s.get("name"),
        "name_cn": s.get("name_cn") or "",
        "date": s.get("date") or "",
        "score": s.get("score") or 0,
        "rank": s.get("rank") or 0,
        "eps": s.get("eps") or 0,
        "volumes": s.get("volumes") or 0,
        "platform": s.get("platform") or "",
        "collection_total": s.get("collection_total") or 0,
        "images": {
            "common": images.get("common") or images.get("medium") or "",
            "small": images.get("small") or images.get("grid") or "",
            "large": images.get("large") or "",
        },
        "tags": [t.get("name") for t in (s.get("tags") or [])[:14] if t.get("name")],
    }


def slim_collection(c: dict) -> dict:
    return {
        "subject_id": c.get("subject_id"),
        "subject_type": c.get("subject_type"),
        "type": c.get("type"),
        "rate": c.get("rate") or 0,
        "ep_status": c.get("ep_status") or 0,
        "vol_status": c.get("vol_status") or 0,
        "comment": (c.get("comment") or "").strip(),
        "tags": [t for t in (c.get("tags") or []) if isinstance(t, str)],
        "updated_at": c.get("updated_at") or "",
        "subject": slim_subject(c.get("subject") or {}),
    }


def fetch_type(subject_type: int) -> list:
    out = []
    offset = 0
    while True:
        path = f"/users/{USERNAME}/collections?subject_type={subject_type}&limit=100&offset={offset}"
        d = get(path)
        rows = d.get("data") or []
        out.extend(slim_collection(r) for r in rows)
        total = d.get("total") or len(out)
        print(f"  type {subject_type}: {len(out)}/{total}")
        if len(rows) < 100 or len(out) >= total:
            break
        offset += 100
        time.sleep(0.35)
    return out


def main() -> None:
    print("profile…")
    user = get(f"/users/{USERNAME}")
    time.sleep(0.35)

    collections = []
    for st in SUBJECT_TYPES:
        print(f"collections type {st}…")
        collections.extend(fetch_type(st))
        time.sleep(0.35)

    print("characters…")
    characters = {}
    for cid in CHARACTER_IDS:
        try:
            characters[str(cid)] = get(f"/characters/{cid}")
        except Exception as exc:  # a missing character must not break the build
            print(f"  ! character {cid}: {exc}", file=sys.stderr)
        time.sleep(0.35)

    print("featured subject…")
    featured = None
    try:
        featured = get(f"/subjects/{FEATURED_SUBJECT}")
    except Exception as exc:
        print(f"  ! featured: {exc}", file=sys.stderr)

    payload = {
        "meta": {
            "source": "Bangumi (bgm.tv) public API v0",
            "username": USERNAME,
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(collections),
        },
        "profile": {
            "id": user.get("id"),
            "username": user.get("username"),
            "nickname": user.get("nickname"),
            "sign": user.get("sign") or "",
            "avatar": (user.get("avatar") or {}).get("large") or "",
            "url": user.get("url") or f"https://bgm.tv/user/{USERNAME}",
        },
        "characters": characters,
        "featured": {
            "id": FEATURED_SUBJECT,
            "subject": slim_subject(featured or {}),
            "summary": (featured or {}).get("summary") or "",
        },
        "collections": collections,
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(f"wrote {OUT} — {len(collections)} collections, {size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()

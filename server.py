#!/usr/bin/env python3
"""Beads UI: one server for every beads project under the root dirs.

A project is any <root>/<name>/ with .beads/metadata.json. Git worktrees are
skipped because they share the main checkout's database.

Usage: python3 server.py [--host 0.0.0.0] [--port 8765] [--root DIR ...]
"""
import argparse
import http.server
import json
import pathlib
import subprocess
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
STATIC = {"/": "index.html", "/index.html": "index.html", "/graph.js": "graph.js"}
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8"}


def find_projects(roots):
    found = {}
    for root in roots:
        for meta in sorted(pathlib.Path(root).expanduser().glob("*/.beads/metadata.json")):
            d = meta.parent.parent
            if not (d / ".git").is_file():
                found.setdefault(d.name, d)
    return found


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        projects = find_projects(self.server.roots)
        if url.path == "/api/projects":
            return self.reply(200, json.dumps(sorted(projects)).encode(), "application/json")
        if url.path == "/api/beads":
            name = urllib.parse.parse_qs(url.query).get("p", [""])[0]
            if name not in projects:
                return self.reply(404, f"unknown project: {name}".encode(), "text/plain")
            try:
                r = subprocess.run(
                    ["bd", "list", "--all", "--limit", "0", "--json"],
                    cwd=projects[name], capture_output=True, timeout=30,
                )
            except (OSError, subprocess.TimeoutExpired) as e:
                return self.reply(502, str(e).encode(), "text/plain")
            if r.returncode:
                return self.reply(502, r.stderr or b"bd failed", "text/plain")
            return self.reply(200, r.stdout, "application/json")
        name = STATIC.get(url.path)
        if not name:
            return self.reply(404, b"not found", "text/plain")
        f = HERE / name
        self.reply(200, f.read_bytes(), TYPES[f.suffix])

    def reply(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1", help="0.0.0.0 to serve the whole LAN")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--root", action="append", help="dir whose subdirs are projects (default: ~/projects, ~/dev)")
    args = ap.parse_args()
    srv = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    srv.roots = args.root or ["~/projects", "~/dev"]
    print(f"beads UI: http://{args.host}:{args.port}  roots: {srv.roots}  projects: {sorted(find_projects(srv.roots))}")
    srv.serve_forever()

"""Ad-hoc end-to-end check for the QR code endpoints against a running API."""

import os
import sys

import httpx

BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8021")
AUTH = {"Authorization": "Bearer dev:user_clerk_super_demo"}


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=30.0, follow_redirects=False) as client:
        me = client.get("/api/v1/me/bootstrap", headers=AUTH)
        print("bootstrap:", me.status_code)
        if me.status_code != 200:
            print(me.text[:400])
            return 1

        menus = client.get("/api/v1/menus", headers=AUTH).json()
        menu_id = menus[0]["id"] if menus else None
        print("menus:", len(menus), "using", menu_id)

        created = client.post(
            "/api/v1/qr-codes",
            headers=AUTH,
            json={
                "name": "Smoke test — ordering",
                "destinationType": "ordering",
                "targetUrl": "order.example.com/smoke",
                "moduleShape": "rounded",
                "eyeShape": "circle",
                "eyeColor": "#c4a574",
                "errorCorrection": "Q",
                "caption": "ORDER ONLINE",
            },
        )
        print("create:", created.status_code)
        if created.status_code != 201:
            print(created.text[:600])
            return 1
        qr = created.json()
        code = qr["shortCode"]
        print("  shortCode:", code)
        print("  encodes:  ", qr["encodedValue"])

        preview = client.post(
            "/api/v1/qr-codes/preview",
            headers=AUTH,
            json={"destinationType": "url", "targetUrl": "https://example.com"},
        )
        print("preview:", preview.status_code, len(preview.json()["svg"]), "bytes svg")

        svg = client.get(f"/api/v1/public/qr/{code}/render.svg")
        png = client.get(f"/api/v1/public/qr/{code}/render.png?size=256")
        print("render svg:", svg.status_code, svg.headers.get("content-type"), len(svg.content))
        print("render png:", png.status_code, png.headers.get("content-type"), len(png.content))
        assert png.content[:8] == b"\x89PNG\r\n\x1a\n"

        follow = client.get(f"/q/{code}")
        print("redirect:", follow.status_code, "->", follow.headers.get("location"))

        after = client.get(f"/api/v1/qr-codes/{qr['id']}", headers=AUTH).json()
        print("scanCount after redirect:", after["scanCount"])

        if menu_id:
            menu_qr = client.post(
                "/api/v1/qr-codes",
                headers=AUTH,
                json={
                    "name": "Smoke test — menu",
                    "destinationType": "menu",
                    "menuId": menu_id,
                    "caption": "SCAN FOR MENU",
                },
            )
            print("create menu qr:", menu_qr.status_code)
            mcode = menu_qr.json()["shortCode"]
            resolved = client.get(f"/api/v1/public/qr/{mcode}")
            body = resolved.json()
            print(
                "resolve menu:",
                resolved.status_code,
                body["menu"]["name"] if body.get("menu") else None,
                len(body["menu"]["items"]) if body.get("menu") else 0,
                "items",
            )
            saved = client.post(
                f"/api/v1/qr-codes/{menu_qr.json()['id']}/save-to-media", headers=AUTH
            )
            print("save-to-media:", saved.status_code, saved.json().get("name"))
            client.delete(f"/api/v1/qr-codes/{menu_qr.json()['id']}", headers=AUTH)

        bad = client.post(
            "/api/v1/qr-codes",
            headers=AUTH,
            json={"name": "no url", "destinationType": "ordering"},
        )
        print("validation (missing url):", bad.status_code, bad.json().get("detail"))

        unsafe = client.post(
            "/api/v1/qr-codes",
            headers=AUTH,
            json={
                "name": "unsafe",
                "destinationType": "url",
                "targetUrl": "javascript:alert(1)",
            },
        )
        print("validation (unsafe scheme):", unsafe.status_code)

        viewer = client.post(
            "/api/v1/qr-codes",
            headers={"Authorization": "Bearer dev:user_clerk_viewer_demo"},
            json={
                "name": "viewer attempt",
                "destinationType": "url",
                "targetUrl": "https://example.com",
            },
        )
        print("viewer create (expect 403):", viewer.status_code)

        listed = client.get("/api/v1/qr-codes", headers=AUTH).json()
        print("list total:", listed["total"])

        gone = client.delete(f"/api/v1/qr-codes/{qr['id']}", headers=AUTH)
        print("delete:", gone.status_code)
    return 0


if __name__ == "__main__":
    sys.exit(main())

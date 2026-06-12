"""
Browser visual audit — API for auth, Playwright for screenshots.
"""
import os
import time
import json
import httpx
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8001/api/v1"
SCREENSHOT_DIR = "/tmp/cc-screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

EMAIL = f"visual_{int(time.time())}@cuchd.in"
PASSWORD = "VisualTest123!"
NAME = "Visual Auditor"


def main():
    print("=" * 60)
    print("  BROWSER VISUAL AUDIT")
    print("=" * 60)

    client = httpx.Client(timeout=60)

    # ── 1. Register ───────────────────────────────────────────────────
    print(f"\n[1] Registering {EMAIL}...")
    r = client.post(f"{API_URL}/auth/register", json={
        "email": EMAIL, "password": PASSWORD, "display_name": NAME,
    })
    reg = r.json()
    otp = reg.get("dev_otp")
    print(f"  OTP: {otp}")
    if not otp:
        print(f"  FATAL: {json.dumps(reg)[:200]}")
        return

    # ── 2. Verify ─────────────────────────────────────────────────────
    print(f"[2] Verifying OTP {otp}...")
    r = client.post(f"{API_URL}/auth/verify-otp", json={
        "email": EMAIL, "code": otp,
    })
    auth = r.json()
    token = auth.get("access_token")
    refresh = auth.get("refresh_token")
    user = auth.get("user", {})
    print(f"  user={user.get('email')} role={user.get('role')} verified={user.get('is_verified')}")
    if not token:
        print(f"  FATAL: {json.dumps(auth)[:200]}")
        return

    # ── 3. Launch Playwright ──────────────────────────────────────────
    print(f"\n[3] Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        # Inject tokens
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_timeout(500)
        page.evaluate(f"""() => {{
            localStorage.setItem('cc_access_token', '{token}');
            localStorage.setItem('cc_refresh_token', '{refresh}');
        }}""")
        print(f"  Token injected")

        # ── 4. Screenshot all pages ───────────────────────────────────
        print(f"\n[4] Navigating pages...")
        PAGES = [
            ("/",                      "01-home",           "Home Feed"),
            ("/clubs",                 "02-clubs",          "Clubs"),
            ("/events",                "03-events",         "Events"),
            ("/marketplace",           "04-marketplace",    "Marketplace"),
            ("/academics",             "05-academics",      "Academics"),
            ("/messages",              "06-messages",       "Messages"),
            ("/notifications",         "07-notifications",  "Notifications"),
            ("/saved",                 "08-saved",          "Saved Posts"),
            ("/admin",                 "09-admin",          "Admin"),
            ("/profile/setup",         "10-profile-setup",  "Profile Setup"),
        ]

        results = []
        for path, fname, label in PAGES:
            page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/{fname}.png", full_page=True)

            url = page.url
            redirected = "/login" in url
            has_layout = bool(page.query_selector('[class*="layout"], [class*="sidebar"], [class*="rail"]'))
            btns = len(page.query_selector_all("button"))
            links = len(page.query_selector_all("a"))

            results.append({
                "label": label, "path": path, "url": url,
                "redirected": redirected, "layout": has_layout,
                "buttons": btns, "links": links,
            })
            tag = "REDIRECT" if redirected else ("LAYOUT" if has_layout else "NO-LAYOUT")
            print(f"  {label:22s} {path:25s} -> {url:45s} [{tag}]")

        # ── 5. Dark mode ──────────────────────────────────────────────
        print(f"\n[5] Dark mode test...")
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.evaluate(f"""() => {{
            localStorage.setItem('cc_access_token', '{token}');
            localStorage.setItem('cc_refresh_token', '{refresh}');
        }}""")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)

        theme_before = page.evaluate("document.documentElement.getAttribute('data-theme')") or "none"
        print(f"  Before: {theme_before}")

        for btn in page.query_selector_all("button"):
            aria = (btn.get_attribute("aria-label") or "").lower()
            html = btn.inner_html().lower()
            if any(k in aria or k in html for k in ["theme", "dark", "moon", "sun"]):
                btn.click()
                page.wait_for_timeout(1000)
                theme_after = page.evaluate("document.documentElement.getAttribute('data-theme')") or "none"
                print(f"  After:  {theme_after}")
                page.screenshot(path=f"{SCREENSHOT_DIR}/11-dark-mode.png")
                break
        else:
            print("  Toggle not found")

        # ── 6. Mobile ─────────────────────────────────────────────────
        print(f"\n[6] Mobile viewport...")
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.evaluate(f"""() => {{
            localStorage.setItem('cc_access_token', '{token}');
            localStorage.setItem('cc_refresh_token', '{refresh}');
        }}""")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/12-mobile-home.png")

        for mp in [("/clubs", "13-mobile-clubs"), ("/events", "14-mobile-events"), ("/messages", "15-mobile-messages")]:
            page.goto(f"{BASE_URL}{mp[0]}", wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/{mp[1]}.png")

        # ── 7. Console ────────────────────────────────────────────────
        print(f"\n[7] Console errors: {len(errors)}")
        for e in errors[:5]:
            print(f"  {e[:120]}")

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────
    ok = [r for r in results if not r["redirected"]]
    redir = [r for r in results if r["redirected"]]
    print(f"\n{'=' * 60}")
    print(f"  Pages loaded: {len(ok)}  |  Redirected: {len(redir)}")
    for r in results:
        icon = "✗" if r["redirected"] else "✓"
        print(f"  {icon} {r['label']:22s} {r['path']:25s}")
    print(f"  Screenshots: {SCREENSHOT_DIR}/")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()

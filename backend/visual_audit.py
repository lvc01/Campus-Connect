"""
Browser visual audit — navigates all pages, takes screenshots, checks for issues.
"""
import os
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8001"
SCREENSHOT_DIR = "/tmp/cc-screenshots"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

PAGES = [
    ("/", "home"),
    ("/login", "login"),
    ("/register", "register"),
    ("/forgot-password", "forgot-password"),
    ("/clubs", "clubs"),
    ("/events", "events"),
    ("/marketplace", "marketplace"),
    ("/academics", "academics"),
    ("/messages", "messages"),
    ("/notifications", "notifications"),
    ("/saved", "saved"),
    ("/admin", "admin"),
]

def audit_page(page, path, name):
    """Navigate to a page, screenshot it, and check for issues."""
    issues = []
    url = f"{BASE_URL}{path}"
    
    try:
        resp = page.goto(url, wait_until="networkidle", timeout=15000)
        status = resp.status if resp else "no response"
    except Exception as e:
        issues.append(f"Navigation error: {e}")
        status = "error"
    
    # Wait for content to render
    page.wait_for_timeout(1500)
    
    # Screenshot
    screenshot_path = f"{SCREENSHOT_DIR}/{name}.png"
    page.screenshot(path=screenshot_path, full_page=True)
    
    # Check for console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    
    # Check page has visible content
    body_text = page.inner_text("body")
    if len(body_text.strip()) < 10:
        issues.append("Page appears empty or has very little content")
    
    # Check for broken images
    images = page.query_selector_all("img")
    for img in images:
        src = img.get_attribute("src") or ""
        natural_width = img.evaluate("el => el.naturalWidth")
        if natural_width == 0 and src and not src.startswith("data:"):
            issues.append(f"Broken image: {src[:80]}")
    
    # Check for layout issues (horizontal scroll)
    scroll_width = page.evaluate("document.documentElement.scrollWidth")
    client_width = page.evaluate("document.documentElement.clientWidth")
    if scroll_width > client_width + 10:
        issues.append(f"Horizontal overflow detected: scrollWidth={scroll_width} > clientWidth={client_width}")
    
    # Check for visible text contrast (basic check)
    # Check theme attribute
    theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    
    # Check for interactive elements
    buttons = page.query_selector_all("button")
    links = page.query_selector_all("a")
    inputs = page.query_selector_all("input")
    
    # Check for loading spinners that never resolve
    spinners = page.query_selector_all("[class*='animate-spin'], [class*='loading'], [class*='spinner']")
    
    return {
        "path": path,
        "name": name,
        "status": status,
        "theme": theme,
        "buttons": len(buttons),
        "links": len(links),
        "inputs": len(inputs),
        "images": len(images),
        "spinners": len(spinners),
        "body_length": len(body_text.strip()),
        "issues": issues,
        "screenshot": screenshot_path,
    }


def audit_login_flow(page):
    """Test the login page form interactions."""
    results = []
    
    page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    
    # Check form elements exist
    email_input = page.query_selector('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    password_input = page.query_selector('input[type="password"], input[name="password"]')
    submit_btn = page.query_selector('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
    
    results.append({"check": "Email input exists", "pass": email_input is not None})
    results.append({"check": "Password input exists", "pass": password_input is not None})
    results.append({"check": "Submit button exists", "pass": submit_btn is not None})
    
    # Check for register link
    register_link = page.query_selector('a[href*="register"]')
    results.append({"check": "Register link exists", "pass": register_link is not None})
    
    # Check for forgot password link
    forgot_link = page.query_selector('a[href*="forgot"]')
    results.append({"check": "Forgot password link exists", "pass": forgot_link is not None})
    
    # Screenshot the login page
    page.screenshot(path=f"{SCREENSHOT_DIR}/login-form.png")
    
    return results


def audit_register_flow(page):
    """Test the register page form."""
    results = []
    
    page.goto(f"{BASE_URL}/register", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    
    # Check form elements
    name_input = page.query_selector('input[placeholder*="name" i], input[name*="name" i]')
    email_input = page.query_selector('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    password_input = page.query_selector('input[type="password"], input[name="password"]')
    submit_btn = page.query_selector('button[type="submit"], button:has-text("Register"), button:has-text("Sign up")')
    
    results.append({"check": "Name input exists", "pass": name_input is not None})
    results.append({"check": "Email input exists", "pass": email_input is not None})
    results.append({"check": "Password input exists", "pass": password_input is not None})
    results.append({"check": "Submit button exists", "pass": submit_btn is not None})
    
    page.screenshot(path=f"{SCREENSHOT_DIR}/register-form.png")
    
    return results


def audit_theme_toggle(page):
    """Test dark/light theme toggle."""
    results = []
    
    page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    
    # Get initial theme
    initial_theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    results.append({"check": "Initial theme set", "pass": initial_theme is not None, "value": initial_theme})
    
    # Find and click theme toggle
    theme_btn = page.query_selector('button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]')
    if theme_btn:
        theme_btn.click()
        page.wait_for_timeout(500)
        new_theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
        results.append({"check": "Theme toggles on click", "pass": new_theme != initial_theme, "value": new_theme})
        page.screenshot(path=f"{SCREENSHOT_DIR}/theme-toggled.png")
    else:
        results.append({"check": "Theme toggle button found", "pass": False})
    
    return results


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        
        # Collect console errors
        all_console_errors = []
        page.on("console", lambda msg: all_console_errors.append(msg.text) if msg.type == "error" else None)
        
        print("=" * 60)
        print("  CAMPUS CONNECT — BROWSER VISUAL AUDIT")
        print("=" * 60)
        
        # 1. Page audits
        print("\n--- Page Audits ---")
        page_results = []
        for path, name in PAGES:
            result = audit_page(page, path, name)
            page_results.append(result)
            status_icon = "OK" if not result["issues"] else "!!"
            print(f"  [{status_icon}] {path:25s} status={result['status']}  theme={result['theme']}  "
                  f"btns={result['buttons']}  links={result['links']}  imgs={result['images']}  "
                  f"body={result['body_length']}px")
            for issue in result["issues"]:
                print(f"       ISSUE: {issue}")
        
        # 2. Login form audit
        print("\n--- Login Form Audit ---")
        login_results = audit_login_flow(page)
        for r in login_results:
            icon = "PASS" if r["pass"] else "FAIL"
            print(f"  [{icon}] {r['check']}")
        
        # 3. Register form audit
        print("\n--- Register Form Audit ---")
        register_results = audit_register_flow(page)
        for r in register_results:
            icon = "PASS" if r["pass"] else "FAIL"
            print(f"  [{icon}] {r['check']}")
        
        # 4. Theme toggle audit
        print("\n--- Theme Toggle Audit ---")
        theme_results = audit_theme_toggle(page)
        for r in theme_results:
            icon = "PASS" if r["pass"] else "FAIL"
            val = r.get("value", "")
            print(f"  [{icon}] {r['check']}  {val}")
        
        # 5. Console errors
        print("\n--- Console Errors ---")
        if all_console_errors:
            for err in all_console_errors[:10]:
                print(f"  ERROR: {err[:120]}")
        else:
            print("  No console errors detected")
        
        # 6. Summary
        total_issues = sum(len(r["issues"]) for r in page_results)
        failed_checks = sum(1 for r in login_results + register_results + theme_results if not r["pass"])
        
        print("\n" + "=" * 60)
        print(f"  SUMMARY")
        print(f"  Pages audited:     {len(PAGES)}")
        print(f"  Total issues:      {total_issues}")
        print(f"  Failed checks:     {failed_checks}")
        print(f"  Console errors:    {len(all_console_errors)}")
        print(f"  Screenshots saved: {SCREENSHOT_DIR}/")
        print("=" * 60)
        
        browser.close()
        
        return {
            "pages": page_results,
            "login": login_results,
            "register": register_results,
            "theme": theme_results,
            "console_errors": all_console_errors,
            "total_issues": total_issues,
            "failed_checks": failed_checks,
        }


if __name__ == "__main__":
    main()

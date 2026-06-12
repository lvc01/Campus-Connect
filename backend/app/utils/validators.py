"""
Validation helpers used across the application.

Kept separate from Pydantic field validators so they can be reused
in service-layer logic without importing schema classes.
"""

import re


def validate_email_domain(email: str, allowed_domains: list[str]) -> bool:
    """
    Check whether the email's domain is in the allowed list.

    Args:
        email: Full email address (e.g. ``student@cuchd.in``).
        allowed_domains: Lowercase domain strings (e.g. ``["cuchd.in"]``).

    Returns:
        ``True`` if the domain matches; ``False`` otherwise.
    """
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in allowed_domains


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Check password complexity requirements.

    Requirements:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit

    Returns:
        A tuple of ``(is_valid, message)`` where ``message`` describes
        the first failed requirement, or ``"Password is strong."`` on success.
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    return True, "Password is strong."

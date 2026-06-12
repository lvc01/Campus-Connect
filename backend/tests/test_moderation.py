"""
Tests for the moderation API — report creation, listing, and status updates.
"""

import pytest
from httpx import AsyncClient


class TestCreateReport:
    @pytest.mark.asyncio
    async def test_report_post_success(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Any authenticated user can report a post via the generic /reports endpoint."""
        # Create a post first
        post_resp = await client.post(
            "/api/v1/posts",
            json={"content": "Reportable post", "visibility": "public"},
            headers=auth_headers,
        )
        assert post_resp.status_code == 201
        post_id = post_resp.json()["id"]

        resp = await client.post(
            "/api/v1/reports",
            json={
                "target_type": "post",
                "target_id": post_id,
                "category": "spam",
                "description": "This post is spam.",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["message"] == "Report submitted."

    @pytest.mark.asyncio
    async def test_report_invalid_target(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Reporting a non-existent target should still create the report (no FK constraint enforced here)."""
        resp = await client.post(
            "/api/v1/reports",
            json={
                "target_type": "post",
                "target_id": "00000000-0000-0000-0000-000000000000",
                "category": "harassment",
            },
            headers=auth_headers,
        )
        # Reports are polymorphic — no FK validation on target_id
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_report_all_target_types(self, client: AsyncClient, auth_headers: dict[str, str]):
        """All target types should be accepted by the generic endpoint."""
        target_types = ["post", "comment", "user", "listing", "club", "message"]
        for ttype in target_types:
            resp = await client.post(
                "/api/v1/reports",
                json={
                    "target_type": ttype,
                    "target_id": "00000000-0000-0000-0000-000000000000",
                    "category": "spam",
                },
                headers=auth_headers,
            )
            assert resp.status_code == 201, f"Failed for target_type={ttype}"


class TestModerationEndpoints:
    @pytest.mark.asyncio
    async def test_list_reports_requires_moderator(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /moderation/reports should be forbidden for non-moderators."""
        resp = await client.get("/api/v1/moderation/reports", headers=auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_moderator_can_list_reports(self, client: AsyncClient, db_session):
        """A moderator should be able to list reports."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            mod = User(
                id=__import__("uuid").uuid4(), email="mod@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.moderator,
                is_verified=True, is_active=True,
            )
            session.add(mod)
            await session.flush()
            session.add(Profile(user_id=mod.id, display_name="Moderator"))
            await session.commit()

        mod_token = create_access_token(data={"sub": str(mod.id)})
        mod_headers = {"Authorization": f"Bearer {mod_token}"}

        resp = await client.get("/api/v1/moderation/reports", headers=mod_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_reports_with_filters(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """GET /moderation/reports should support status/target_type/category filters."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            mod = User(
                id=__import__("uuid").uuid4(), email="mod2@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.moderator,
                is_verified=True, is_active=True,
            )
            session.add(mod)
            await session.flush()
            session.add(Profile(user_id=mod.id, display_name="Mod 2"))
            await session.commit()

        mod_token = create_access_token(data={"sub": str(mod.id)})
        mod_headers = {"Authorization": f"Bearer {mod_token}"}

        # Create a report first
        await client.post(
            "/api/v1/reports",
            json={
                "target_type": "post",
                "target_id": "00000000-0000-0000-0000-000000000000",
                "category": "spam",
            },
            headers=auth_headers,
        )

        # Filter by status
        resp = await client.get(
            "/api/v1/moderation/reports?status=pending", headers=mod_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] > 0

    @pytest.mark.asyncio
    async def test_moderator_can_resolve_report(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """A moderator should be able to resolve a report."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            mod = User(
                id=__import__("uuid").uuid4(), email="mod3@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.moderator,
                is_verified=True, is_active=True,
            )
            session.add(mod)
            await session.flush()
            session.add(Profile(user_id=mod.id, display_name="Mod 3"))
            await session.commit()

        mod_token = create_access_token(data={"sub": str(mod.id)})
        mod_headers = {"Authorization": f"Bearer {mod_token}"}

        # Create a report
        report_resp = await client.post(
            "/api/v1/reports",
            json={
                "target_type": "post",
                "target_id": "00000000-0000-0000-0000-000000000000",
                "category": "inappropriate",
            },
            headers=auth_headers,
        )
        assert report_resp.status_code == 201

        # Get the report via moderator endpoint
        list_resp = await client.get(
            "/api/v1/moderation/reports?status=pending", headers=mod_headers,
        )
        assert list_resp.status_code == 200
        reports = list_resp.json()["items"]
        if len(reports) > 0:
            report_id = reports[0]["id"]

            resolve_resp = await client.patch(
                f"/api/v1/moderation/reports/{report_id}",
                json={"status": "resolved", "resolution_note": "Content removed."},
                headers=mod_headers,
            )
            assert resolve_resp.status_code == 200
            assert resolve_resp.json()["status"] == "resolved"

    @pytest.mark.asyncio
    async def test_get_report_detail(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """GET /moderation/reports/{id} should return report details."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            mod = User(
                id=__import__("uuid").uuid4(), email="mod4@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.moderator,
                is_verified=True, is_active=True,
            )
            session.add(mod)
            await session.flush()
            session.add(Profile(user_id=mod.id, display_name="Mod 4"))
            await session.commit()

        mod_token = create_access_token(data={"sub": str(mod.id)})
        mod_headers = {"Authorization": f"Bearer {mod_token}"}

        report_resp = await client.post(
            "/api/v1/reports",
            json={
                "target_type": "user",
                "target_id": "00000000-0000-0000-0000-000000000000",
                "category": "harassment",
                "description": "This user is harassing me.",
            },
            headers=auth_headers,
        )
        assert report_resp.status_code == 201

        list_resp = await client.get(
            "/api/v1/moderation/reports", headers=mod_headers,
        )
        reports = list_resp.json()["items"]
        if len(reports) > 0:
            report_id = reports[0]["id"]
            detail_resp = await client.get(
                f"/api/v1/moderation/reports/{report_id}", headers=mod_headers,
            )
            assert detail_resp.status_code == 200
            data = detail_resp.json()
            assert data["id"] == report_id
            assert data["category"] == "harassment"
            assert data["reporter"] is not None


class TestModerationStats:
    @pytest.mark.asyncio
    async def test_stats_requires_moderator(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /moderation/stats should be forbidden for non-moderators."""
        resp = await client.get("/api/v1/moderation/stats", headers=auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_moderator_can_view_stats(self, client: AsyncClient, db_session):
        """A moderator should be able to view platform moderation stats."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            mod = User(
                id=__import__("uuid").uuid4(), email="mod5@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.moderator,
                is_verified=True, is_active=True,
            )
            session.add(mod)
            await session.flush()
            session.add(Profile(user_id=mod.id, display_name="Mod 5"))
            await session.commit()

        mod_token = create_access_token(data={"sub": str(mod.id)})
        mod_headers = {"Authorization": f"Bearer {mod_token}"}

        resp = await client.get("/api/v1/moderation/stats", headers=mod_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_reports" in data
        assert "pending" in data
        assert "resolved" in data
        assert "dismissed" in data
        assert "by_category" in data
        assert "by_target_type" in data

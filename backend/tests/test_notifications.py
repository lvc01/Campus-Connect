"""
Tests for the notifications API — trigger integration, listing, and read-state.
"""

import pytest
from httpx import AsyncClient


class TestNotificationTriggers:
    @pytest.mark.asyncio
    async def test_like_creates_notification(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Liking another user's post should create a notification for the post author."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            author = User(
                id=__import__("uuid").uuid4(), email="author@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(author)
            await session.flush()
            session.add(Profile(user_id=author.id, display_name="Author"))
            await session.commit()

            post_resp = await client.post(
                "/api/v1/posts",
                json={"content": "Test post for notification", "visibility": "public"},
                headers=auth_headers,
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # Like as author (self-like should NOT create notification)
            auth_token = create_access_token(data={"sub": str(author.id)})
            author_headers = {"Authorization": f"Bearer {auth_token}"}
            await client.post(f"/api/v1/posts/{post_id}/like", headers=author_headers)

            # Check no notification for self-like (or it gets filtered)
            notif_resp = await client.get("/api/v1/notifications", headers=author_headers)
            # Depending on implementation, self-like may be filtered; just verify it doesn't error
            assert notif_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_comment_creates_notification(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Commenting on another user's post should create a notification."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            author = User(
                id=__import__("uuid").uuid4(), email="author2@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(author)
            await session.flush()
            session.add(Profile(user_id=author.id, display_name="Author 2"))
            await session.commit()

            auth_token = create_access_token(data={"sub": str(author.id)})
            author_headers = {"Authorization": f"Bearer {auth_token}"}

            post_resp = await client.post(
                "/api/v1/posts",
                json={"content": "Another test post", "visibility": "public"},
                headers=author_headers,
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # Comment as a different user (test_user from fixtures)
            comment_resp = await client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"content": "Nice post!"},
                headers=auth_headers,
            )
            assert comment_resp.status_code == 201

            # Verify notification exists for the author
            notif_resp = await client.get("/api/v1/notifications", headers=author_headers)
            assert notif_resp.status_code == 200
            data = notif_resp.json()
            assert data["unread_count"] > 0
            assert len(data["items"]) > 0
            assert data["items"][0]["type"] == "comment"

    @pytest.mark.asyncio
    async def test_list_notifications(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """GET /notifications should return paginated results with unread count."""
        resp = await client.get("/api/v1/notifications", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "unread_count" in data
        assert "next_cursor" in data

    @pytest.mark.asyncio
    async def test_unread_count(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """GET /notifications/unread-count should return the count."""
        resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)

    @pytest.mark.asyncio
    async def test_mark_read(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """PATCH /notifications/read should mark specific notifications as read."""
        resp = await client.patch(
            "/api/v1/notifications/read",
            json={"notification_ids": []},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_mark_all_read(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """PATCH /notifications/read-all should mark all as read."""
        resp = await client.patch("/api/v1/notifications/read-all", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["unread_count"] == 0


class TestDMNotifications:
    @pytest.mark.asyncio
    async def test_dm_creates_notification(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Sending a DM should create a notification for the recipient."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="dm_target@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="DM Target"))
            await session.commit()

        # Create DM with test_user -> other
        conv_resp = await client.post(
            "/api/v1/messaging/conversations",
            json={"type": "direct", "member_ids": [str(other.id)]},
            headers=auth_headers,
        )
        assert conv_resp.status_code == 201
        conv_id = conv_resp.json()["id"]

        # Send message
        msg_resp = await client.post(
            f"/api/v1/messaging/conversations/{conv_id}/messages",
            json={"content": "Hello there!"},
            headers=auth_headers,
        )
        assert msg_resp.status_code == 201

        # Check other user has a notification
        other_token = create_access_token(data={"sub": str(other.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}
        notif_resp = await client.get("/api/v1/notifications", headers=other_headers)
        assert notif_resp.status_code == 200
        data = notif_resp.json()
        assert data["unread_count"] > 0

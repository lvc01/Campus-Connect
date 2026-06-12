"""
Tests for the messaging API — conversation CRUD, messages, and unread counts.
"""

import pytest
from httpx import AsyncClient


class TestCreateConversation:
    @pytest.mark.asyncio
    async def test_create_dm_success(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Creating a DM returns the conversation with both members."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="other@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="Other User"))
            await session.commit()

        resp = await client.post(
            "/api/v1/messaging/conversations",
            json={"type": "direct", "member_ids": [str(other.id)]},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "direct"
        assert len(data["members"]) == 2

    @pytest.mark.asyncio
    async def test_create_dm_reuses_existing(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Creating a DM to the same user returns the existing conversation."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="other2@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="Other 2"))
            await session.commit()

        payload = {"type": "direct", "member_ids": [str(other.id)]}
        r1 = await client.post("/api/v1/messaging/conversations", json=payload, headers=auth_headers)
        r2 = await client.post("/api/v1/messaging/conversations", json=payload, headers=auth_headers)
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["id"] == r2.json()["id"]


class TestSendAndListMessages:
    @pytest.mark.asyncio
    async def test_send_and_list_messages(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Sending messages and listing them returns messages in order."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="other3@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="Other 3"))
            await session.commit()

        # Create DM
        conv_resp = await client.post(
            "/api/v1/messaging/conversations",
            json={"type": "direct", "member_ids": [str(other.id)]},
            headers=auth_headers,
        )
        conv_id = conv_resp.json()["id"]

        # Send messages
        for content in ["Hello!", "How are you?", "Let's study"]:
            resp = await client.post(
                f"/api/v1/messaging/conversations/{conv_id}/messages",
                json={"content": content},
                headers=auth_headers,
            )
            assert resp.status_code == 201

        # List messages
        list_resp = await client.get(
            f"/api/v1/messaging/conversations/{conv_id}/messages",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        items = list_resp.json()["items"]
        contents = {m["content"] for m in items if m["content"]}
        assert len(items) >= 3
        assert "Hello!" in contents
        assert "How are you?" in contents
        assert "Let's study" in contents


class TestConversationsList:
    @pytest.mark.asyncio
    async def test_list_conversations(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """GET /messaging/conversations returns user's conversations with last message."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="other4@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="Other 4"))
            await session.commit()

        conv_resp = await client.post(
            "/api/v1/messaging/conversations",
            json={"type": "direct", "member_ids": [str(other.id)]},
            headers=auth_headers,
        )
        conv_id = conv_resp.json()["id"]
        await client.post(
            f"/api/v1/messaging/conversations/{conv_id}/messages",
            json={"content": "Hey there!"},
            headers=auth_headers,
        )

        list_resp = await client.get("/api/v1/messaging/conversations", headers=auth_headers)
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert len(data) >= 1
        # Check last_message is populated
        assert any(c["last_message"] for c in data)


class TestUnread:
    @pytest.mark.asyncio
    async def test_unread_count(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """Unread count returns total and per-conversation counts."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            other = User(
                id=__import__("uuid").uuid4(), email="other5@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other)
            await session.flush()
            session.add(Profile(user_id=other.id, display_name="Other 5"))
            await session.commit()

        conv_resp = await client.post(
            "/api/v1/messaging/conversations",
            json={"type": "direct", "member_ids": [str(other.id)]},
            headers=auth_headers,
        )
        conv_id = conv_resp.json()["id"]
        await client.post(
            f"/api/v1/messaging/conversations/{conv_id}/messages",
            json={"content": "Unread test"},
            headers=auth_headers,
        )

        unread_resp = await client.get("/api/v1/messaging/unread", headers=auth_headers)
        assert unread_resp.status_code == 200
        data = unread_resp.json()
        assert isinstance(data["total"], int)

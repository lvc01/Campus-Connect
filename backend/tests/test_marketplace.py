"""
Tests for the marketplace API — CRUD, ratings, and saves.
"""

import pytest
from httpx import AsyncClient


class TestCreateListing:
    @pytest.mark.asyncio
    async def test_create_listing_success(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Creating a valid listing returns 201 with listing data."""
        payload = {
            "title": "Calculus Textbook",
            "description": "Like new, 5th edition",
            "price": 25.00,
            "category": "textbook",
            "condition": "like_new",
            "image_urls": ["https://example.com/book.jpg"],
        }
        resp = await client.post("/api/v1/marketplace/listings", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Calculus Textbook"
        assert data["price"] == 25.0
        assert data["category"] == "textbook"
        assert data["condition"] == "like_new"
        assert data["status"] == "active"
        assert len(data["images"]) == 1

    @pytest.mark.asyncio
    async def test_create_listing_missing_title(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Listing with empty title returns 422."""
        payload = {"title": "", "price": 10, "category": "other"}
        resp = await client.post("/api/v1/marketplace/listings", json=payload, headers=auth_headers)
        assert resp.status_code == 422


class TestListListings:
    @pytest.mark.asyncio
    async def test_list_active_listings(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /marketplace/listings returns active listings."""
        payload1 = {"title": "First Listing", "price": 10, "category": "other"}
        payload2 = {"title": "Second Listing", "price": 20, "category": "electronics"}
        await client.post("/api/v1/marketplace/listings", json=payload1, headers=auth_headers)
        await client.post("/api/v1/marketplace/listings", json=payload2, headers=auth_headers)

        resp = await client.get("/api/v1/marketplace/listings", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        titles = {d["title"] for d in data}
        assert len(data) == 2
        assert "First Listing" in titles
        assert "Second Listing" in titles

    @pytest.mark.asyncio
    async def test_filter_by_category(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Filtering by category returns only matching listings."""
        await client.post("/api/v1/marketplace/listings", json={"title": "Book", "price": 5, "category": "textbook"}, headers=auth_headers)
        await client.post("/api/v1/marketplace/listings", json={"title": "Laptop", "price": 500, "category": "electronics"}, headers=auth_headers)

        resp = await client.get("/api/v1/marketplace/listings?category=textbook", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "textbook"

    @pytest.mark.asyncio
    async def test_search_listings(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Searching by keyword returns matching listings."""
        await client.post("/api/v1/marketplace/listings", json={"title": "Calculus Book", "price": 15, "category": "textbook"}, headers=auth_headers)
        await client.post("/api/v1/marketplace/listings", json={"title": "Python Guide", "price": 20, "category": "textbook"}, headers=auth_headers)

        resp = await client.get("/api/v1/marketplace/listings?search=calculus", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert "Calculus" in data[0]["title"]


class TestGetListing:
    @pytest.mark.asyncio
    async def test_get_single_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /marketplace/listings/{id} returns listing with seller info."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Test Item", "price": 99, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/marketplace/listings/{listing_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Test Item"
        assert data["seller"]["email"] == "testuser@cuchd.in"

    @pytest.mark.asyncio
    async def test_get_nonexistent_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Getting a non-existent listing returns 404."""
        resp = await client.get("/api/v1/marketplace/listings/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert resp.status_code == 404


class TestUpdateListing:
    @pytest.mark.asyncio
    async def test_update_own_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Updating your own listing returns updated data."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Old Title", "price": 10, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        resp = await client.patch(f"/api/v1/marketplace/listings/{listing_id}", json={"title": "New Title", "price": 25}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"
        assert resp.json()["price"] == 25.0

    @pytest.mark.asyncio
    async def test_update_others_listing_forbidden(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Updating another user's listing returns 403."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Original", "price": 10, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        # Create a second user
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal
        async with TestSessionLocal() as session:
            other_user = User(
                id=__import__("uuid").uuid4(), email="other@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other_user)
            await session.flush()
            session.add(Profile(user_id=other_user.id, display_name="Other User"))
            await session.commit()
        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        resp = await client.patch(f"/api/v1/marketplace/listings/{listing_id}", json={"title": "Hacked"}, headers=other_headers)
        assert resp.status_code == 403


class TestDeleteListing:
    @pytest.mark.asyncio
    async def test_delete_own_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Deleting your own listing returns 200 and hides it from listings."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Delete Me", "price": 5, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/marketplace/listings/{listing_id}", headers=auth_headers)
        assert resp.status_code == 200

        get_resp = await client.get(f"/api/v1/marketplace/listings/{listing_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_others_listing_forbidden(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Deleting another user's listing returns 403."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Not Yours", "price": 5, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal
        async with TestSessionLocal() as session:
            other_user = User(
                id=__import__("uuid").uuid4(), email="other2@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(other_user)
            await session.flush()
            session.add(Profile(user_id=other_user.id, display_name="Other2"))
            await session.commit()
        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        resp = await client.delete(f"/api/v1/marketplace/listings/{listing_id}", headers=other_headers)
        assert resp.status_code == 403


class TestListingSaves:
    @pytest.mark.asyncio
    async def test_save_and_unsave_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Saving and unsaving a listing works and is_saved is reflected."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Save Test", "price": 10, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        save_resp = await client.post(f"/api/v1/marketplace/listings/{listing_id}/save", headers=auth_headers)
        assert save_resp.status_code == 200
        assert save_resp.json()["message"] == "Listing saved."

        get_resp = await client.get(f"/api/v1/marketplace/listings/{listing_id}", headers=auth_headers)
        assert get_resp.json()["is_saved"] is True

        unsave_resp = await client.delete(f"/api/v1/marketplace/listings/{listing_id}/save", headers=auth_headers)
        assert unsave_resp.status_code == 200
        assert unsave_resp.json()["message"] == "Listing unsaved."

        get_resp2 = await client.get(f"/api/v1/marketplace/listings/{listing_id}", headers=auth_headers)
        assert get_resp2.json()["is_saved"] is False

    @pytest.mark.asyncio
    async def test_saved_only_filter(self, client: AsyncClient, auth_headers: dict[str, str]):
        """?saved_only=true returns only saved listings."""
        r1 = await client.post("/api/v1/marketplace/listings", json={"title": "Save Me", "price": 10, "category": "other"}, headers=auth_headers)
        r2 = await client.post("/api/v1/marketplace/listings", json={"title": "Skip Me", "price": 20, "category": "other"}, headers=auth_headers)
        await client.post(f"/api/v1/marketplace/listings/{r1.json()['id']}/save", headers=auth_headers)

        resp = await client.get("/api/v1/marketplace/listings?saved_only=true", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "Save Me"


class TestSellerRatings:
    @pytest.mark.asyncio
    async def test_create_and_get_ratings(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Creating a rating and fetching seller ratings works."""
        from app.core.security import create_access_token, hash_password
        from app.models.user import Profile, User, UserRole
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            seller = User(
                id=__import__("uuid").uuid4(), email="seller@cuchd.in",
                hashed_password=hash_password("Pass123"), role=UserRole.student,
                is_verified=True, is_active=True,
            )
            session.add(seller)
            await session.flush()
            session.add(Profile(user_id=seller.id, display_name="Seller"))
            await session.commit()

        seller_token = create_access_token(data={"sub": str(seller.id)})
        seller_headers = {"Authorization": f"Bearer {seller_token}"}

        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Rating Test", "price": 10, "category": "other"}, headers=seller_headers)
        listing_id = create_resp.json()["id"]

        rating_resp = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/ratings",
            json={"rating": 5, "review": "Great seller!"},
            headers=auth_headers,
        )
        assert rating_resp.status_code == 201
        assert rating_resp.json()["rating"] == 5

        # Get seller ratings
        ratings_resp = await client.get(f"/api/v1/marketplace/sellers/{seller.id}/ratings", headers=auth_headers)
        assert ratings_resp.status_code == 200
        data = ratings_resp.json()
        assert data["total_ratings"] == 1
        assert data["avg_rating"] == 5.0
        assert len(data["ratings"]) == 1

    @pytest.mark.asyncio
    async def test_cannot_rate_own_listing(self, client: AsyncClient, auth_headers: dict[str, str]):
        """Rating your own listing returns 400."""
        create_resp = await client.post("/api/v1/marketplace/listings", json={"title": "Self Rate", "price": 10, "category": "other"}, headers=auth_headers)
        listing_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/marketplace/listings/{listing_id}/ratings",
            json={"rating": 3},
            headers=auth_headers,
        )
        assert resp.status_code == 400

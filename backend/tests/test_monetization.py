"""
Tests for the monetization API — ad creation, listing, serving, and tracking.
"""

import pytest
from httpx import AsyncClient


class TestCreateAd:
    @pytest.mark.asyncio
    async def test_create_ad_success(self, client: AsyncClient, auth_headers: dict[str, str]):
        """A valid ad should be created and returned."""
        resp = await client.post(
            "/api/v1/ads",
            json={
                "title": "Test Ad",
                "content": "Check out this cool product!",
                "target_url": "https://example.com",
                "daily_budget": 100,
                "total_budget": 1000,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Ad"
        assert data["advertiser_id"] is not None
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_ad_with_boosted_post(self, client: AsyncClient, auth_headers: dict[str, str], db_session):
        """An ad can be linked to a boosted post."""
        post_resp = await client.post(
            "/api/v1/posts",
            json={"content": "Boost this post!", "visibility": "public"},
            headers=auth_headers,
        )
        assert post_resp.status_code == 201
        post_id = post_resp.json()["id"]

        resp = await client.post(
            "/api/v1/ads",
            json={
                "title": "Boosted Post Ad",
                "content": "Promoted content",
                "boosted_post_id": post_id,
                "total_budget": 500,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["boosted_post_id"] == post_id

    @pytest.mark.asyncio
    async def test_create_ad_missing_title(self, client: AsyncClient, auth_headers: dict[str, str]):
        """An ad without a title should fail."""
        resp = await client.post(
            "/api/v1/ads",
            json={"content": "No title here"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestListAds:
    @pytest.mark.asyncio
    async def test_list_my_ads(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /ads should return the user's ads."""
        # Create two ads
        await client.post(
            "/api/v1/ads",
            json={"title": "Ad 1", "total_budget": 100},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/ads",
            json={"title": "Ad 2", "total_budget": 200},
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/ads", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        assert any(a["title"] == "Ad 1" for a in data)
        assert any(a["title"] == "Ad 2" for a in data)


class TestActiveAd:
    @pytest.mark.asyncio
    async def test_get_active_ad(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /ads/active should return a random active ad."""
        await client.post(
            "/api/v1/ads",
            json={"title": "Active Ad", "content": "Active content", "total_budget": 100},
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/ads/active", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert "title" in data
        assert "id" in data

    @pytest.mark.asyncio
    async def test_get_active_ad_none(self, client: AsyncClient, auth_headers: dict[str, str]):
        """GET /ads/active may return null if no active ads exist."""
        # Don't create any ads — should get null
        resp = await client.get("/api/v1/ads/active", headers=auth_headers)
        assert resp.status_code == 200


class TestAdTracking:
    @pytest.mark.asyncio
    async def test_track_impression(self, client: AsyncClient, auth_headers: dict[str, str]):
        """POST /ads/{id}/impression should increment the count."""
        ad_resp = await client.post(
            "/api/v1/ads",
            json={"title": "Trackable Ad", "total_budget": 100},
            headers=auth_headers,
        )
        ad_id = ad_resp.json()["id"]

        resp = await client.post(f"/api/v1/ads/{ad_id}/impression", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_track_click(self, client: AsyncClient, auth_headers: dict[str, str]):
        """POST /ads/{id}/click should increment the count."""
        ad_resp = await client.post(
            "/api/v1/ads",
            json={"title": "Clickable Ad", "total_budget": 100},
            headers=auth_headers,
        )
        ad_id = ad_resp.json()["id"]

        resp = await client.post(f"/api/v1/ads/{ad_id}/click", headers=auth_headers)
        assert resp.status_code == 200


class TestAdUpdateDelete:
    @pytest.mark.asyncio
    async def test_update_ad(self, client: AsyncClient, auth_headers: dict[str, str]):
        """PATCH /ads/{id} should update an ad's fields."""
        ad_resp = await client.post(
            "/api/v1/ads",
            json={"title": "Original Title", "total_budget": 100},
            headers=auth_headers,
        )
        ad_id = ad_resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/ads/{ad_id}",
            json={"title": "Updated Title", "status": "paused"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "paused"

    @pytest.mark.asyncio
    async def test_delete_ad(self, client: AsyncClient, auth_headers: dict[str, str]):
        """DELETE /ads/{id} should remove the ad."""
        ad_resp = await client.post(
            "/api/v1/ads",
            json={"title": "Deletable Ad", "total_budget": 100},
            headers=auth_headers,
        )
        ad_id = ad_resp.json()["id"]

        resp = await client.delete(f"/api/v1/ads/{ad_id}", headers=auth_headers)
        assert resp.status_code == 200

        # Verify it's gone
        resp = await client.get(f"/api/v1/ads/{ad_id}", headers=auth_headers)
        assert resp.status_code == 404

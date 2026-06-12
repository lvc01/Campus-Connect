import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.post import Comment, Like, Post, PostVisibility, Save
from app.models.user import Profile, User, UserRole


# ── Utility User Creator ──────────────────────────────────────────────

async def create_custom_student(
    email: str,
    faculty: str,
    db_session: AsyncSession,
) -> tuple[User, dict[str, str]]:
  """Helper to create a verified student in a specific faculty with auth headers."""
  user = User(
      id=uuid.uuid4(),
      email=email,
      hashed_password=hash_password("Pass123!"),
      role=UserRole.student,
      is_verified=True,
      is_active=True,
  )
  db_session.add(user)
  await db_session.flush()

  profile = Profile(
      user_id=user.id,
      display_name=email.split("@")[0].capitalize(),
      faculty=faculty,
      year_of_study=1,
  )
  db_session.add(profile)
  await db_session.commit()

  token = create_access_token(data={"sub": str(user.id)})
  headers = {"Authorization": f"Bearer {token}"}
  return user, headers


# ── Feed & Post Tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_post_success(client: AsyncClient, auth_headers: dict):
  """Creating a valid post should parse hashtags and return 201."""
  response = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={
          "content": "Excited for the upcoming exams! #varsitylife #exams",
          "visibility": "public",
      },
  )
  assert response.status_code == 201
  data = response.json()
  assert data["content"] == "Excited for the upcoming exams! #varsitylife #exams"
  assert data["post_type"] == "text"
  assert "varsitylife" in data["tags"]
  assert "exams" in data["tags"]
  assert data["like_count"] == 0
  assert data["comment_count"] == 0


@pytest.mark.asyncio
async def test_create_post_with_media(client: AsyncClient, auth_headers: dict):
  """Creating a post with media urls should associate PostMedia records."""
  response = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={
          "content": "Check out my study notes!",
          "media_urls": ["https://r2.campusconnect.co.za/notes.pdf"],
      },
  )
  assert response.status_code == 201
  data = response.json()
  assert len(data["media"]) == 1
  assert data["media"][0]["url"] == "https://r2.campusconnect.co.za/notes.pdf"
  assert data["media"][0]["media_type"] == "document"


@pytest.mark.asyncio
async def test_get_feed_faculty_isolation(
    client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """A Commerce student should not see a Science-only post in their feed."""
  # 1. Create a Commerce student
  commerce_user, commerce_headers = await create_custom_student(
      "commerce@cuchd.in", "Commerce", db_session
  )

  # 2. Science student (test_user) creates a faculty_only post
  science_post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={
          "content": "Special Science lab announcement! #scienceonly",
          "visibility": "faculty_only",
      },
  )
  assert science_post_res.status_code == 201
  science_post_id = science_post_res.json()["id"]

  # 3. Science student (test_user) creates a public post
  public_post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={
          "content": "Public varsity life update. #allwelcome",
          "visibility": "public",
      },
  )
  assert public_post_res.status_code == 201

  # 4. Check Science student's feed (should see BOTH posts)
  science_feed = await client.get("/api/v1/posts", headers=auth_headers)
  assert science_feed.status_code == 200
  science_items = science_feed.json()["items"]
  assert len(science_items) == 2

  # 5. Check Commerce student's feed (should ONLY see the public post)
  commerce_feed = await client.get("/api/v1/posts", headers=commerce_headers)
  assert commerce_feed.status_code == 200
  commerce_items = commerce_feed.json()["items"]
  assert len(commerce_items) == 1
  assert commerce_items[0]["id"] != science_post_id
  assert "allwelcome" in commerce_items[0]["tags"]


# ── Liking & Bookmarking Tests ────────────────────────────────────────

@pytest.mark.asyncio
async def test_like_unlike_post(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Liking should increment counters, unliking should decrement them."""
  # 1. Create post
  post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={"content": "Liking this post!"},
  )
  post_id = post_res.json()["id"]

  # 2. Like post
  like_res = await client.post(
      f"/api/v1/posts/{post_id}/like",
      headers=auth_headers,
  )
  assert like_res.status_code == 200

  # Check DB post counter incremented
  post_check = await db_session.execute(
      select(Post).where(Post.id == uuid.UUID(post_id))
  )
  post = post_check.scalar_one()
  assert post.like_count == 1

  # Check feed indicates is_liked = True
  feed_res = await client.get("/api/v1/posts", headers=auth_headers)
  assert feed_res.json()["items"][0]["is_liked"] is True

  # 3. Unlike post
  unlike_res = await client.delete(
      f"/api/v1/posts/{post_id}/like",
      headers=auth_headers,
  )
  assert unlike_res.status_code == 200

  # Check DB post counter decremented
  db_session.expire_all()
  post_check = await db_session.execute(
      select(Post).where(Post.id == uuid.UUID(post_id))
  )
  post = post_check.scalar_one()
  assert post.like_count == 0


@pytest.mark.asyncio
async def test_save_unsave_post(client: AsyncClient, auth_headers: dict):
  """Bookmarking a post should set is_saved=True, and unsaving should revert it."""
  post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={"content": "Saved for later reading."},
  )
  post_id = post_res.json()["id"]

  # Bookmark
  save_res = await client.post(
      f"/api/v1/posts/{post_id}/save",
      headers=auth_headers,
  )
  assert save_res.status_code == 200

  # Verify in feed
  feed_res = await client.get("/api/v1/posts", headers=auth_headers)
  assert feed_res.json()["items"][0]["is_saved"] is True

  # Unbookmark
  unsave_res = await client.delete(
      f"/api/v1/posts/{post_id}/save",
      headers=auth_headers,
  )
  assert unsave_res.status_code == 200

  # Verify in feed
  feed_res2 = await client.get("/api/v1/posts", headers=auth_headers)
  assert feed_res2.json()["items"][0]["is_saved"] is False


# ── Threaded Comments Tests ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_comment_and_replies(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Comments can be threaded with nested replies in hierarchical tree orders."""
  # 1. Create post
  post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={"content": "Post with comments discussion."},
  )
  post_id = post_res.json()["id"]

  # 2. Add top-level comment
  c1_res = await client.post(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
      json={"content": "This is a top-level comment."},
  )
  assert c1_res.status_code == 201
  c1_id = c1_res.json()["id"]

  # 3. Add nested reply to top-level comment
  c2_res = await client.post(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
      json={
          "content": "This is a reply to the first comment.",
          "parent_id": c1_id,
      },
  )
  assert c2_res.status_code == 201
  c2_id = c2_res.json()["id"]

  # 4. Verify post comment counter atomically updated to 2
  post_check = await db_session.execute(
      select(Post).where(Post.id == uuid.UUID(post_id))
  )
  post = post_check.scalar_one()
  assert post.comment_count == 2

  # 5. Fetch threaded comments and verify tree hierarchy
  comments_list_res = await client.get(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
  )
  assert comments_list_res.status_code == 200
  comments = comments_list_res.json()
  
  # Should only have 1 top-level comment (c1)
  assert len(comments) == 1
  assert comments[0]["id"] == c1_id
  assert comments[0]["content"] == "This is a top-level comment."
  
  # Inside c1 replies, there should be exactly 1 reply (c2)
  assert len(comments[0]["replies"]) == 1
  assert comments[0]["replies"][0]["id"] == c2_id
  assert comments[0]["replies"][0]["content"] == "This is a reply to the first comment."
  assert comments[0]["replies"][0]["parent_id"] == c1_id


# ── Comment Deletion Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_comment_success(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Author can delete their own comment; comment_count decrements correctly."""
  # 1. Create post
  post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={"content": "Testing comment deletion."},
  )
  post_id = post_res.json()["id"]

  # 2. Add a comment
  comment_res = await client.post(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
      json={"content": "I will delete this soon."},
  )
  comment_id = comment_res.json()["id"]

  # 3. Verify comment_count is 1
  post_check = await db_session.execute(select(Post).where(Post.id == uuid.UUID(post_id)))
  assert post_check.scalar_one().comment_count == 1

  # 4. Delete the comment
  del_res = await client.delete(
      f"/api/v1/posts/{post_id}/comments/{comment_id}",
      headers=auth_headers,
  )
  assert del_res.status_code == 200
  assert del_res.json()["message"] == "Comment deleted."

  # 5. Verify comment_count is back to 0
  db_session.expire_all()
  post_check2 = await db_session.execute(select(Post).where(Post.id == uuid.UUID(post_id)))
  assert post_check2.scalar_one().comment_count == 0

  # 6. Verify comment is soft-deleted (not returned in comment list)
  comments_res = await client.get(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
  )
  assert comments_res.status_code == 200
  assert len(comments_res.json()) == 0


@pytest.mark.asyncio
async def test_delete_comment_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Non-author cannot delete another user's comment."""
  # 1. Create post
  post_res = await client.post(
      "/api/v1/posts",
      headers=auth_headers,
      json={"content": "Forbidden deletion test."},
  )
  post_id = post_res.json()["id"]

  # 2. Add a comment as original author
  comment_res = await client.post(
      f"/api/v1/posts/{post_id}/comments",
      headers=auth_headers,
      json={"content": "Owner's comment."},
  )
  comment_id = comment_res.json()["id"]

  # 3. Create another user
  _, other_headers = await create_custom_student(
      "intruder@cuchd.in", "Science", db_session
  )

  # 4. Attempt to delete someone else's comment — expect 403
  del_res = await client.delete(
      f"/api/v1/posts/{post_id}/comments/{comment_id}",
      headers=other_headers,
  )
  assert del_res.status_code == 403


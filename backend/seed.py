"""
Seed script — populates the database with demo data for development.

Usage:
    python seed.py

Requires a running database at the DATABASE_URL configured in app/config.py.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from random import choice, randint, sample

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, Base, async_engine
from app.core.security import hash_password
from app.models.academic import Course, CourseMember, CourseMemberRole
from app.models.club import Club, ClubCategory, ClubMember, ClubMemberRole
from app.models.event import Event, EventStatus
from app.models.marketplace import (
    ListingCategory,
    ListingCondition,
    MarketplaceListing,
)
from app.models.messaging import Conversation, ConversationMember, ConversationType, Message, MessageType
from app.models.post import Comment, Like, Post, PostMedia, MediaType, PostType, PostVisibility
from app.models.user import Profile, User, UserRole
from app.models.notification import Notification as NotifModel, NotificationType
from app.models.monetization import Ad, AdStatus


FACULTIES = [
    "Engineering",
    "Science",
    "Commerce",
    "Arts",
    "Law",
    "Management",
    "Pharmacy",
    "Computer Applications",
]

STUDENTS = [
    ("rohan.sharma@cuchd.in", "Rohan Sharma", "Engineering", 3),
    ("priya.singh@cuchd.in", "Priya Singh", "Computer Applications", 2),
    ("arjun.patel@cuchd.in", "Arjun Patel", "Management", 4),
    ("neha.gupta@cuchd.in", "Neha Gupta", "Science", 1),
    ("vikram.verma@cuchd.in", "Vikram Verma", "Engineering", 4),
    ("ananya.reddy@cuchd.in", "Ananya Reddy", "Commerce", 2),
    ("karan.joshi@cuchd.in", "Karan Joshi", "Arts", 3),
    ("isha.kapoor@cuchd.in", "Isha Kapoor", "Pharmacy", 1),
    ("akash.nair@cuchd.in", "Akash Nair", "Law", 2),
    ("sneha.das@cuchd.in", "Sneha Das", "Engineering", 3),
    ("admin@cuchd.in", "Campus Admin", "Computer Applications", 4),
]

CLUBS = [
    ("Tech Titans", "tech", "For students passionate about coding, hackathons, and tech innovation.", True, True),
    ("Dramatics Club", "cultural", "Theatre, drama, and stage performance enthusiasts.", True, False),
    ("Sports United", "sports", "Promoting sports and fitness across campus.", True, False),
    ("Photography Guild", "cultural", "Capture campus life through the lens.", True, False),
    ("Eco Warriors", "social", "Sustainability and environmental awareness club.", True, True),
]

POST_CONTENTS = [
    "Just finished my final year project presentation! Feeling amazing! 🎉",
    "Anyone else struggling with the DBMS assignment? Let's form a study group.",
    "Big thanks to the coding club for organizing yesterday's hackathon!",
    "Lost my water bottle in the library — has anyone seen it?",
    "The campus canteen has a new south Indian menu and it's incredible!",
    "Looking for a roommate for next semester. DM me if interested!",
    "Photography walk this Saturday at 7am. Meet near the admin block!",
    "Does anyone have past year papers for Engineering Mathematics?",
    "Throwback to the freshers' party! What an amazing night!",
    "Anyone interested in forming a cricket team for the inter-department tournament?",
    "The Wi-Fi in Block C is down again. Anyone else facing issues?",
    "Selling my used textbooks — practically new condition! Check marketplace.",
    "Just joined the university's music society. First practice was awesome!",
    "Pro tip: The silent zone on the 3rd floor of the library is perfect for studying.",
    "Volunteers needed for the upcoming blood donation camp! Sign up below!",
]

EVENT_TITLES = [
    ("Annual Tech Fest 2026", "Engineering", "Auditorium"),
    ("Cultural Night", "Arts", "Open Air Theatre"),
    ("Sports Meet Finals", "Sports", "University Ground"),
    ("Photography Exhibition", "Arts", "Art Gallery"),
    ("Hackathon: Code for Cause", "Engineering", "Computer Lab Block B"),
]

MARKETPLACE_ITEMS = [
    ("Engineering Mathematics Textbook", "textbook", "Excellent condition. Covers all units of CSE 3rd sem.", 450.00, "like_new"),
    ("Scientific Calculator fx-991ES", "electronics", "Used for 1 semester. Working perfectly.", 800.00, "good"),
    ("Room for Rent Near Campus", "accommodation", "Single room with attached bathroom. Walking distance.", 5000.00, "good"),
    ("Python Programming Tutoring", "tutoring", "I can help with Python basics to advanced. 1st year students welcome.", 300.00, "like_new"),
    ("Hostel Bed + Mattress", "other", "Moving out of hostel. Bed and mattress for sale.", 2000.00, "good"),
]


async def seed():
    print("Dropping existing tables...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("Creating database tables...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Users ──────────────────────────────────────────────────────
        print("Creating users...")
        users = []
        for i, (email, name, faculty, year) in enumerate(STUDENTS):
            if i == 0:
                role = UserRole.moderator
            elif i == 1:
                role = UserRole.university_staff
            elif i == len(STUDENTS) - 1:
                role = UserRole.admin
            else:
                role = UserRole.student

            user = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=hash_password("password123"),
                role=role,
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            profile = Profile(
                user_id=user.id,
                display_name=name,
                faculty=faculty,
                year_of_study=year,
                bio=f"Student at Chandigarh University. {faculty} department.",
            )
            db.add(profile)
            users.append(user)

        await db.commit()
        print(f"  Created {len(users)} users (1 moderator, 1 staff, 8 students)")

        # ── Clubs ──────────────────────────────────────────────────────
        print("Creating clubs...")
        clubs = []
        for name, category, description, approved, premium in CLUBS:
            creator = choice(users)
            club = Club(
                id=uuid.uuid4(),
                name=name,
                slug=name.lower().replace(" ", "-"),
                description=description,
                category=ClubCategory(category),
                is_verified=True,
                is_approved=approved,
                is_premium=premium,
                member_count=randint(15, 60),
                created_by=creator.id,
            )
            db.add(club)
            await db.flush()

            owner = ClubMember(
                club_id=club.id,
                user_id=creator.id,
                role=ClubMemberRole.owner,
            )
            db.add(owner)

            for _ in range(randint(2, 5)):
                member = choice([u for u in users if u.id != creator.id])
                existing = await db.execute(
                    select(ClubMember).where(
                        ClubMember.club_id == club.id,
                        ClubMember.user_id == member.id,
                    )
                )
                if not existing.scalar_one_or_none():
                    db.add(ClubMember(
                        club_id=club.id,
                        user_id=member.id,
                        role=ClubMemberRole.member,
                    ))

            clubs.append(club)

        await db.commit()
        print(f"  Created {len(clubs)} clubs (2 premium)")

        # ── Events ─────────────────────────────────────────────────────
        print("Creating events...")
        events = []
        now = datetime.now(timezone.utc)
        for i, (title, faculty, location) in enumerate(EVENT_TITLES):
            club = clubs[i % len(clubs)]
            event = Event(
                id=uuid.uuid4(),
                title=title,
                description=f"Join us for an exciting {title.lower()} event! Open to all students.",
                start_time=now + timedelta(days=randint(1, 30)),
                end_time=now + timedelta(days=randint(1, 30), hours=3),
                location=location,
                rsvp_limit=randint(50, 200),
                rsvp_count=randint(10, 100),
                status=EventStatus.upcoming,
                organizer_id=choice(users).id,
                club_id=club.id,
            )
            db.add(event)
            events.append(event)

        await db.commit()
        print(f"  Created {len(events)} events")

        # ── Posts ──────────────────────────────────────────────────────
        print("Creating posts...")
        posts = []

        # Text posts
        for i, content in enumerate(POST_CONTENTS):
            author = users[i % len(users)]
            post = Post(
                id=uuid.uuid4(),
                author_id=author.id,
                content=content,
                post_type=PostType.text,
                visibility=PostVisibility.public,
                like_count=randint(0, 50),
                comment_count=randint(0, 15),
                share_count=randint(0, 10),
                tags=sample(["campus", "study", "events", "clubs", "fun"], randint(1, 3)),
            )
            db.add(post)
            posts.append(post)

        # Image posts with sample images
        IMAGE_CONTENTS = [
            ("Sunset view from the campus rooftop tonight! 🌅", "https://picsum.photos/seed/campus1/800/600"),
            ("New library expansion is looking amazing!", "https://picsum.photos/seed/campus2/800/600"),
            ("Freshers' party 2026 — what a turnout! 🎉", "https://picsum.photos/seed/party/800/600"),
            ("Lab session today. Building something cool! 🔧", "https://picsum.photos/seed/lab/800/600"),
        ]
        for i, (content, img_url) in enumerate(IMAGE_CONTENTS):
            author = users[(i + 3) % len(users)]
            post = Post(
                id=uuid.uuid4(),
                author_id=author.id,
                content=content,
                post_type=PostType.image,
                visibility=PostVisibility.public,
                like_count=randint(10, 80),
                comment_count=randint(0, 20),
                share_count=randint(0, 15),
                tags=sample(["campus", "photography", "events", "labs"], randint(1, 3)),
            )
            db.add(post)
            await db.flush()
            db.add(PostMedia(
                post_id=post.id,
                media_type=MediaType.image,
                url=img_url,
                order=0,
            ))
            posts.append(post)

        # Video posts with sample videos
        VIDEO_CONTENTS = [
            ("Highlights from the inter-department cricket match! 🏏", "https://www.w3schools.com/html/mov_bbb.mp4"),
            ("Dance performance at Cultural Night — absolutely killed it! 🔥", "https://www.w3schools.com/html/mov_bbb.mp4"),
        ]
        for i, (content, vid_url) in enumerate(VIDEO_CONTENTS):
            author = users[(i + 7) % len(users)]
            post = Post(
                id=uuid.uuid4(),
                author_id=author.id,
                content=content,
                post_type=PostType.video,
                visibility=PostVisibility.public,
                like_count=randint(15, 100),
                comment_count=randint(0, 25),
                share_count=randint(0, 20),
                tags=sample(["sports", "cultural", "campus"], randint(1, 3)),
            )
            db.add(post)
            await db.flush()
            db.add(PostMedia(
                post_id=post.id,
                media_type=MediaType.video,
                url=vid_url,
                order=0,
            ))
            posts.append(post)

        await db.commit()
        print(f"  Created {len(posts)} posts (text, image, and video) with likes, comments, and shares")

        # ── Marketplace Listings ──────────────────────────────────────
        print("Creating marketplace listings...")
        listings = []
        for title, category, desc, price, condition in MARKETPLACE_ITEMS:
            listing = MarketplaceListing(
                id=uuid.uuid4(),
                seller_id=choice(users).id,
                title=title,
                description=desc,
                price=price,
                category=ListingCategory(category),
                condition=ListingCondition(condition),
                view_count=randint(10, 200),
            )
            db.add(listing)
            listings.append(listing)

        await db.commit()
        print(f"  Created {len(listings)} marketplace listings")

        # ── Courses ────────────────────────────────────────────────────
        print("Creating courses...")
        course_data = [
            ("CSE301", "Database Management Systems", "Engineering", 3),
            ("CSE401", "Artificial Intelligence", "Engineering", 4),
            ("MTH201", "Engineering Mathematics III", "Science", 2),
            ("CCA201", "Computer Networks", "Computer Applications", 2),
            ("BBA301", "Marketing Management", "Management", 3),
        ]
        courses = []
        for code, name, faculty, year in course_data:
            course = Course(
                id=uuid.uuid4(),
                code=code,
                name=name,
                faculty=faculty,
                description=f"{name} — {faculty} department, Year {year}.",
                year=year,
                semester=randint(1, 2),
            )
            db.add(course)
            await db.flush()

            for u in sample(users, randint(3, 6)):
                db.add(CourseMember(
                    course_id=course.id,
                    user_id=u.id,
                    role=CourseMemberRole.student,
                ))

            courses.append(course)

        await db.commit()
        print(f"  Created {len(courses)} courses with enrolled students")

        # ── Conversations & Messages ─────────────────────────────────
        print("Creating conversations and messages...")
        conversations = []
        for i in range(5):
            member1 = users[i % len(users)]
            member2 = users[(i + 1) % len(users)]
            conv = Conversation(id=uuid.uuid4(), type=ConversationType.direct, created_by=member1.id)
            db.add(conv)
            await db.flush()
            db.add(ConversationMember(conversation_id=conv.id, user_id=member1.id))
            db.add(ConversationMember(conversation_id=conv.id, user_id=member2.id))
            conversations.append(conv)

            # Add messages to each conversation
            msg_contents = [
                "Hey! How are you doing?",
                "Good thanks! Did you finish the assignment?",
                "Not yet, working on it tonight.",
                "Let me know if you need help!",
                "Thanks, will do!",
            ]
            for j, content in enumerate(msg_contents[:randint(2, 5)]):
                sender = member1 if j % 2 == 0 else member2
                msg = Message(
                    id=uuid.uuid4(),
                    conversation_id=conv.id,
                    sender_id=sender.id,
                    content=content,
                    message_type=MessageType.text,
                )
                db.add(msg)

        await db.commit()
        print(f"  Created {len(conversations)} conversations with messages")

        # ── Comments ─────────────────────────────────────────────────
        print("Creating comments...")
        comment_contents = [
            "Great post! Love this!",
            "Congrats! Well deserved!",
            "I was there, it was amazing!",
            "Can you share more details?",
            "Count me in!",
            "This is so helpful, thanks!",
            "Haha, totally agree!",
            "Nice one!",
            "Wow, looks awesome!",
            "Good luck with everything!",
        ]
        for post in posts[:15]:
            for _ in range(randint(1, 3)):
                comment = Comment(
                    id=uuid.uuid4(),
                    post_id=post.id,
                    author_id=choice(users).id,
                    content=choice(comment_contents),
                )
                db.add(comment)

        await db.commit()
        print("  Created comments on posts")

        # ── Likes ────────────────────────────────────────────────────
        print("Creating likes...")
        for post in posts:
            likers = sample(users, randint(2, 8))
            for u in likers:
                existing = await db.execute(
                    select(Like).where(Like.post_id == post.id, Like.user_id == u.id)
                )
                if not existing.scalar_one_or_none():
                    db.add(Like(post_id=post.id, user_id=u.id))

        await db.commit()
        print("  Created likes on posts")

        # ── Notifications ────────────────────────────────────────────
        print("Creating notifications...")
        notif_types = [NotificationType.like, NotificationType.comment, NotificationType.follow, NotificationType.mention, NotificationType.event_reminder]
        for user in users[:5]:
            for _ in range(randint(2, 5)):
                notif = NotifModel(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    type=choice(notif_types),
                    title=choice([
                        "New like on your post",
                        "New comment on your post",
                        "Someone followed you",
                        "You were mentioned in a post",
                        "Upcoming event reminder",
                    ]),
                    actor_id=choice([u for u in users if u.id != user.id]).id,
                    is_read=choice([True, False]),
                )
                db.add(notif)

        await db.commit()
        print("  Created notifications")

        # ── Ads ──────────────────────────────────────────────────────
        print("Creating ads...")
        now = datetime.now(timezone.utc)
        ads_data = [
            {
                "title": "Campus Bookstore — 20% Off Textbooks",
                "content": "Use code SAVE20 at checkout. All new and used textbooks included.",
                "target_url": "https://campusbookstore.example.com",
            },
            {
                "title": "Student Housing — Apply Now",
                "content": "Affordable on-campus accommodation. Limited spots for next semester.",
                "target_url": "https://housing.example.com",
            },
            {
                "title": "Free Coding Workshop",
                "content": "Join our weekend Python workshop. All skill levels welcome.",
                "target_url": "https://workshop.example.com",
            },
        ]
        for ad_data in ads_data:
            ad = Ad(
                id=uuid.uuid4(),
                advertiser_id=choice(users).id,
                title=ad_data["title"],
                content=ad_data["content"],
                target_url=ad_data["target_url"],
                status=AdStatus.active,
                start_date=now - timedelta(days=7),
                end_date=now + timedelta(days=30),
                impression_count=randint(100, 5000),
                click_count=randint(10, 500),
            )
            db.add(ad)
        await db.commit()
        print(f"  Created {len(ads_data)} ads")

    print("\n✅ Seeding complete!")
    print("\nDemo login credentials:")
    print("  Email: rohan.sharma@cuchd.in (Moderator)")
    print("  Email: priya.singh@cuchd.in (Staff)")
    print("  Any:  <name>.<surname>@cuchd.in")
    print("  Password: password123 (all users)")
    print("  OTP: Use any 6 digits (OTP delivery is console-only)")


if __name__ == "__main__":
    asyncio.run(seed())

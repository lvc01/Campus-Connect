"""
SQLAlchemy ORM models — Course, CourseMember, Resource, StudyGroup, StudyGroupMember.

The academic layer auto-generates course groups per faculty/module,
lets students share study resources, and form study groups with
integrated group chat.
"""

import enum
import uuid

from sqlalchemy import (
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class ResourceType(str, enum.Enum):
    """Category of uploaded academic resource."""

    notes = "notes"
    past_paper = "past_paper"
    study_guide = "study_guide"
    other = "other"


class CourseMemberRole(str, enum.Enum):
    """Role a user holds within a course group."""

    student = "student"
    tutor = "tutor"
    lecturer = "lecturer"


# ── Course ────────────────────────────────────────────────────────────

class Course(Base, TimestampMixin):
    """
    An academic course / module offered by the university.

    Courses are auto-generated per faculty and serve as containers
    for resources, Q&A threads, and study groups.
    """

    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    faculty: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    members: Mapped[list["CourseMember"]] = relationship(
        back_populates="course", lazy="noload", cascade="all, delete-orphan",
    )
    resources: Mapped[list["Resource"]] = relationship(
        back_populates="course", lazy="noload", cascade="all, delete-orphan",
    )
    study_groups: Mapped[list["StudyGroup"]] = relationship(
        back_populates="course", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Course code={self.code} name={self.name!r}>"


# ── Course Member ─────────────────────────────────────────────────────

class CourseMember(Base, TimestampMixin):
    """Junction table linking users to courses with their role."""

    __tablename__ = "course_members"
    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_course_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    role: Mapped[CourseMemberRole] = mapped_column(
        SAEnum(CourseMemberRole, name="course_member_role", create_constraint=True),
        default=CourseMemberRole.student,
    )

    # ── Relationships ─────────────────────────────────────────────────
    course: Mapped["Course"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<CourseMember course={self.course_id} user={self.user_id}>"


# ── Resource ──────────────────────────────────────────────────────────

class Resource(Base, TimestampMixin, SoftDeleteMixin):
    """
    An academic resource (notes, past paper, study guide) uploaded to a course.

    Download counts are tracked for popularity metrics.
    """

    __tablename__ = "resources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_type: Mapped[ResourceType] = mapped_column(
        SAEnum(ResourceType, name="resource_type", create_constraint=True),
        nullable=False,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    course: Mapped["Course"] = relationship(back_populates="resources")
    uploader: Mapped["User"] = relationship(back_populates="uploaded_resources")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Resource id={self.id} title={self.title!r}>"


# ── Study Group ───────────────────────────────────────────────────────

class StudyGroup(Base, TimestampMixin):
    """
    A student-created study group linked to a course.

    Each study group has an associated conversation for group chat.
    """

    __tablename__ = "study_groups"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_members: Mapped[int] = mapped_column(Integer, default=10)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    course: Mapped["Course"] = relationship(back_populates="study_groups")
    members: Mapped[list["StudyGroupMember"]] = relationship(
        back_populates="study_group", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<StudyGroup id={self.id} name={self.name!r}>"


# ── Study Group Member ────────────────────────────────────────────────

class StudyGroupMember(Base, TimestampMixin):
    """Junction table linking users to study groups."""

    __tablename__ = "study_group_members"
    __table_args__ = (
        UniqueConstraint("study_group_id", "user_id", name="uq_study_group_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    study_group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    study_group: Mapped["StudyGroup"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<StudyGroupMember group={self.study_group_id} user={self.user_id}>"

import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException, NotFoundException, BadRequestException
from app.models.club import Club
from app.models.marketplace import MarketplaceListing, ListingStatus
from app.models.moderation import Report, ReportCategory, ReportPriority, ReportStatus, ReportTargetType, AppealStatus
from app.models.notification import NotificationType
from app.models.post import Comment, Post
from app.models.messaging import Message
from app.models.user import User, UserRole
from app.schemas.moderation import ReportCreate, ReportUpdate, ContentPreview, AppealUpdate
from app.services.notification_service import get_notification_service


class ModerationService:
    async def create_report(
        self,
        reporter_id: uuid.UUID,
        data: ReportCreate,
        db: AsyncSession,
    ) -> Report:
        # Prevent duplicate reports from same user on same target
        existing = await db.execute(
            select(Report).where(
                Report.reporter_id == reporter_id,
                Report.target_type == data.target_type,
                Report.target_id == data.target_id,
                Report.status.in_([ReportStatus.pending, ReportStatus.reviewing]),
            )
        )
        if existing.scalar_one_or_none():
            raise BadRequestException(detail="You have already reported this item.")

        report = Report(
            reporter_id=reporter_id,
            target_type=data.target_type,
            target_id=data.target_id,
            category=data.category,
            description=data.description,
        )
        db.add(report)
        await db.flush()
        result = await db.execute(
            select(Report)
            .options(
                selectinload(Report.reporter).selectinload(User.profile),
            )
            .where(Report.id == report.id)
        )
        created_report = result.scalar_one()

        # Notify all moderators about the new report
        notif_service = get_notification_service()
        moderators = await db.execute(
            select(User.id).where(
                User.role.in_([UserRole.moderator, UserRole.university_staff]),
                User.is_active == True,
                User.id != reporter_id,
            )
        )
        moderator_ids = [row[0] for row in moderators.all()]
        target_label = data.target_type.value if data.target_type else "unknown"
        for mod_id in moderator_ids:
            await notif_service.create_notification(
                user_id=mod_id,
                type=NotificationType.report_new,
                title="New report filed",
                body=f"A {target_label} has been reported for {data.category.value}.",
                data={"report_id": str(created_report.id), "target_type": target_label},
                actor_id=reporter_id,
                db=db,
            )

        return created_report

    async def list_reports(
        self,
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 20,
        status: ReportStatus | None = None,
        target_type: ReportTargetType | None = None,
        category: ReportCategory | None = None,
    ) -> tuple[list[Report], str | None, bool, int]:
        query = (
            select(Report)
            .options(
                selectinload(Report.reporter).selectinload(User.profile),
                selectinload(Report.reviewer).selectinload(User.profile),
            )
            .order_by(Report.created_at.desc())
        )

        if status:
            query = query.where(Report.status == status)
        if target_type:
            query = query.where(Report.target_type == target_type)
        if category:
            query = query.where(Report.category == category)

        total_result = await db.execute(
            select(func.count(Report.id)).select_from(Report)
        )
        total_count = total_result.scalar() or 0

        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Report.created_at < cursor_dt)

        query = query.limit(limit + 1)
        result = await db.execute(query)
        reports = result.scalars().unique().all()

        has_more = False
        next_cursor = None
        if len(reports) > limit:
            has_more = True
            reports = reports[:limit]
            next_cursor = reports[-1].created_at.isoformat()

        return list(reports), next_cursor, has_more, total_count

    async def get_report(
        self,
        report_id: uuid.UUID,
        db: AsyncSession,
    ) -> Report:
        result = await db.execute(
            select(Report)
            .options(
                selectinload(Report.reporter).selectinload(User.profile),
                selectinload(Report.reviewer).selectinload(User.profile),
            )
            .where(Report.id == report_id)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        return report

    async def update_report_status(
        self,
        report_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        data: ReportUpdate,
        db: AsyncSession,
    ) -> Report:
        result = await db.execute(
            select(Report).where(Report.id == report_id)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")

        report.status = data.status
        report.reviewed_by = reviewer_id
        report.resolution_note = data.resolution_note
        if data.priority is not None:
            report.priority = data.priority
        if data.assigned_to is not None:
            report.assigned_to = data.assigned_to
        if data.internal_notes is not None:
            report.internal_notes = data.internal_notes
        if data.status in (ReportStatus.resolved, ReportStatus.dismissed):
            report.resolved_at = datetime.now(timezone.utc)

        await db.flush()

        # ── Auto-remediation on resolution ────────────────────────────
        if data.status == ReportStatus.resolved:
            await self._apply_remediation(report, db)

        if data.status in (ReportStatus.resolved, ReportStatus.dismissed):
            notif_service = get_notification_service()
            await notif_service.create_notification(
                user_id=report.reporter_id,
                type=NotificationType.report_resolved,
                title=f"Your report has been {data.status.value}",
                body=data.resolution_note or f"A moderator reviewed your report and marked it as {data.status.value}.",
                data={"report_id": str(report_id)},
                actor_id=reviewer_id,
                db=db,
            )

        result = await db.execute(
            select(Report)
            .options(
                selectinload(Report.reporter).selectinload(User.profile),
                selectinload(Report.reviewer).selectinload(User.profile),
            )
            .where(Report.id == report_id)
        )
        return result.scalar_one()

    async def _apply_remediation(
        self,
        report: Report,
        db: AsyncSession,
    ) -> None:
        """
        Automatically act on the reported content when a report is resolved.

        Actions taken per target type:
        - post       → soft-delete the post
        - comment    → soft-delete the comment; decrement parent post comment_count
        - event      → soft-delete the event
        - listing    → soft-delete the listing and mark it expired
        - club       → soft-delete the club and revoke approval
        - user       → deactivate the user account (is_active = False)
        """
        now = datetime.now(timezone.utc)
        target_id = report.target_id

        if report.target_type == ReportTargetType.post:
            await db.execute(
                update(Post)
                .where(Post.id == target_id, Post.deleted_at.is_(None))
                .values(deleted_at=now)
            )

        elif report.target_type == ReportTargetType.comment:
            comment_result = await db.execute(
                select(Comment).where(Comment.id == target_id, Comment.deleted_at.is_(None))
            )
            comment = comment_result.scalar_one_or_none()
            if comment:
                comment.deleted_at = now
                # Decrement parent post comment count
                await db.execute(
                    update(Post)
                    .where(Post.id == comment.post_id, Post.comment_count > 0)
                    .values(comment_count=Post.comment_count - 1)
                )

        elif report.target_type == ReportTargetType.listing:
            await db.execute(
                update(MarketplaceListing)
                .where(MarketplaceListing.id == target_id, MarketplaceListing.deleted_at.is_(None))
                .values(deleted_at=now, status=ListingStatus.expired)
            )

        elif report.target_type == ReportTargetType.club:
            await db.execute(
                update(Club)
                .where(Club.id == target_id, Club.deleted_at.is_(None))
                .values(deleted_at=now, is_approved=False)
            )

        elif report.target_type == ReportTargetType.user:
            await db.execute(
                update(User)
                .where(User.id == target_id)
                .values(is_active=False)
            )
            await self.check_gradual_escalation(target_id, db)

        elif report.target_type == ReportTargetType.message:
            await db.execute(
                update(Message)
                .where(Message.id == target_id, Message.deleted_at.is_(None))
                .values(deleted_at=now)
            )

        await db.flush()

    async def get_pending_count(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.pending)
        )
        return result.scalar() or 0

    async def get_platform_stats(
        self,
        db: AsyncSession,
    ) -> dict:
        counts = await db.execute(
            select(Report.status, func.count(Report.id)).group_by(Report.status)
        )
        status_counts = {row[0].value: row[1] for row in counts.all()}

        cat_counts = await db.execute(
            select(Report.category, func.count(Report.id)).group_by(Report.category)
        )
        category_counts = {row[0].value: row[1] for row in cat_counts.all()}

        type_counts = await db.execute(
            select(Report.target_type, func.count(Report.id)).group_by(Report.target_type)
        )
        target_counts = {row[0].value: row[1] for row in type_counts.all()}

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        resolved_today = await db.execute(
            select(func.count(Report.id)).where(
                Report.status == ReportStatus.resolved,
                Report.resolved_at >= today_start,
            )
        )

        oldest_pending = await db.execute(
            select(func.min(Report.created_at)).where(Report.status == ReportStatus.pending)
        )

        total = sum(status_counts.values())

        return {
            "total_reports": total,
            "pending": status_counts.get("pending", 0),
            "reviewing": status_counts.get("reviewing", 0),
            "resolved": status_counts.get("resolved", 0),
            "dismissed": status_counts.get("dismissed", 0),
            "by_category": category_counts,
            "by_target_type": target_counts,
            "resolved_today": resolved_today.scalar() or 0,
            "pending_oldest": oldest_pending.scalar(),
        }

    async def get_content_preview(
        self,
        target_type: ReportTargetType,
        target_id: uuid.UUID,
        db: AsyncSession,
    ) -> ContentPreview:
        """Fetch a summary of the reported content for moderator review."""
        from app.models.marketplace import MarketplaceListing, ListingImage

        if target_type == ReportTargetType.post:
            result = await db.execute(
                select(Post)
                .options(
                    selectinload(Post.author).selectinload(User.profile),
                    selectinload(Post.media),
                )
                .where(Post.id == target_id)
            )
            post = result.scalar_one_or_none()
            if not post:
                return ContentPreview(target_type="post", target_id=str(target_id), is_deleted=True)
            first_image = post.media[0].url if post.media else None
            return ContentPreview(
                target_type="post",
                target_id=str(target_id),
                content=post.content,
                author_name=post.author.profile.display_name if post.author and post.author.profile else None,
                author_avatar=post.author.profile.avatar_url if post.author and post.author.profile else None,
                image_url=first_image,
                extra={"post_type": post.post_type.value, "like_count": post.like_count, "comment_count": post.comment_count},
                is_deleted=post.deleted_at is not None,
            )

        elif target_type == ReportTargetType.comment:
            result = await db.execute(
                select(Comment)
                .options(selectinload(Comment.author).selectinload(User.profile))
                .where(Comment.id == target_id)
            )
            comment = result.scalar_one_or_none()
            if not comment:
                return ContentPreview(target_type="comment", target_id=str(target_id), is_deleted=True)
            return ContentPreview(
                target_type="comment",
                target_id=str(target_id),
                content=comment.content,
                author_name=comment.author.profile.display_name if comment.author and comment.author.profile else None,
                author_avatar=comment.author.profile.avatar_url if comment.author and comment.author.profile else None,
                extra={"post_id": str(comment.post_id), "like_count": comment.like_count},
                is_deleted=comment.deleted_at is not None,
            )

        elif target_type == ReportTargetType.user:
            result = await db.execute(
                select(User).options(selectinload(User.profile)).where(User.id == target_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                return ContentPreview(target_type="user", target_id=str(target_id), is_deleted=True)
            return ContentPreview(
                target_type="user",
                target_id=str(target_id),
                title=user.email,
                content=user.profile.bio if user.profile else None,
                author_name=user.profile.display_name if user.profile else None,
                author_avatar=user.profile.avatar_url if user.profile else None,
                extra={"role": user.role.value, "is_active": user.is_active},
            )

        elif target_type == ReportTargetType.listing:
            result = await db.execute(
                select(MarketplaceListing)
                .options(selectinload(MarketplaceListing.images))
                .where(MarketplaceListing.id == target_id)
            )
            listing = result.scalar_one_or_none()
            if not listing:
                return ContentPreview(target_type="listing", target_id=str(target_id), is_deleted=True)
            first_image = listing.images[0].url if listing.images else None
            return ContentPreview(
                target_type="listing",
                target_id=str(target_id),
                title=listing.title,
                content=listing.description,
                image_url=first_image,
                extra={"price": listing.price, "category": listing.category.value, "status": listing.status.value},
                is_deleted=listing.deleted_at is not None,
            )

        elif target_type == ReportTargetType.club:
            result = await db.execute(
                select(Club).where(Club.id == target_id)
            )
            club = result.scalar_one_or_none()
            if not club:
                return ContentPreview(target_type="club", target_id=str(target_id), is_deleted=True)
            return ContentPreview(
                target_type="club",
                target_id=str(target_id),
                title=club.name,
                content=club.description,
                image_url=club.logo_url,
                extra={"member_count": club.member_count, "is_approved": club.is_approved},
                is_deleted=club.deleted_at is not None,
            )

        elif target_type == ReportTargetType.message:
            result = await db.execute(
                select(Message)
                .options(selectinload(Message.sender).selectinload(User.profile))
                .where(Message.id == target_id)
            )
            message = result.scalar_one_or_none()
            if not message:
                return ContentPreview(target_type="message", target_id=str(target_id), is_deleted=True)
            return ContentPreview(
                target_type="message",
                target_id=str(target_id),
                content=message.content,
                author_name=message.sender.profile.display_name if message.sender and message.sender.profile else None,
                author_avatar=message.sender.profile.avatar_url if message.sender and message.sender.profile else None,
                extra={"conversation_id": str(message.conversation_id)},
                is_deleted=message.deleted_at is not None,
            )

        return ContentPreview(target_type=target_type.value, target_id=str(target_id))

    async def get_user_reports(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[Report], str | None, bool, int]:
        """Get all reports where the target is a specific user."""
        query = (
            select(Report)
            .options(
                selectinload(Report.reporter).selectinload(User.profile),
                selectinload(Report.reviewer).selectinload(User.profile),
            )
            .where(Report.target_type == ReportTargetType.user, Report.target_id == user_id)
            .order_by(Report.created_at.desc())
        )

        total_result = await db.execute(
            select(func.count(Report.id)).where(
                Report.target_type == ReportTargetType.user, Report.target_id == user_id,
            )
        )
        total_count = total_result.scalar() or 0

        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Report.created_at < cursor_dt)

        query = query.limit(limit + 1)
        result = await db.execute(query)
        reports = result.scalars().unique().all()

        has_more = False
        next_cursor = None
        if len(reports) > limit:
            has_more = True
            reports = reports[:limit]
            next_cursor = reports[-1].created_at.isoformat()

        return list(reports), next_cursor, has_more, total_count

    async def bulk_update_reports(
        self,
        report_ids: list[uuid.UUID],
        status: ReportStatus,
        reviewer_id: uuid.UUID,
        resolution_note: str | None,
        db: AsyncSession,
    ) -> tuple[int, int]:
        """Bulk update multiple reports. Returns (updated_count, failed_count)."""
        updated = 0
        failed = 0
        for report_id in report_ids:
            try:
                await self.update_report_status(report_id, reviewer_id, ReportUpdate(status=status, resolution_note=resolution_note), db)
                updated += 1
            except Exception:
                failed += 1
        await db.commit()
        return updated, failed

    async def suspend_user(
        self,
        user_id: uuid.UUID,
        duration_hours: int,
        reason: str,
        moderator_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        """Temporarily suspend a user for a given duration."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException(detail="User not found.")
        if user.role in (UserRole.moderator, UserRole.university_staff, UserRole.admin):
            raise BadRequestException(detail="Cannot suspend moderators or admins.")

        user.is_active = False
        user.locked_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        await db.flush()

        # Notify the suspended user
        notif_service = get_notification_service()
        until_str = user.locked_until.strftime("%Y-%m-%d %H:%M UTC")
        await notif_service.create_notification(
            user_id=user_id,
            type=NotificationType.system,
            title="Account suspended",
            body=f"Your account has been suspended until {until_str}. Reason: {reason}",
            data={"reason": reason, "until": until_str},
            actor_id=moderator_id,
            db=db,
        )

    async def reactivate_user(
        self,
        user_id: uuid.UUID,
        moderator_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        """Reactivate a suspended or deactivated user."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException(detail="User not found.")

        user.is_active = True
        user.locked_until = None
        await db.flush()

        # Notify the reactivated user
        notif_service = get_notification_service()
        await notif_service.create_notification(
            user_id=user_id,
            type=NotificationType.system,
            title="Account reactivated",
            body="Your account has been reactivated by a moderator.",
            data={},
            actor_id=moderator_id,
            db=db,
        )

    async def assign_report(self, report_id: uuid.UUID, assignee_id: uuid.UUID, moderator_id: uuid.UUID, db: AsyncSession) -> Report:
        """Assign a report to a specific moderator."""
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        report.assigned_to = assignee_id
        await self._log_action(moderator_id, "assign", "report", str(report_id), {"assigned_to": str(assignee_id)}, db)
        await db.flush()
        return await self.get_report(report_id, db)

    async def update_internal_notes(self, report_id: uuid.UUID, notes: str, moderator_id: uuid.UUID, db: AsyncSession) -> Report:
        """Update internal moderator notes on a report."""
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        report.internal_notes = notes
        await self._log_action(moderator_id, "internal_notes", "report", str(report_id), {}, db)
        await db.flush()
        return await self.get_report(report_id, db)

    async def toggle_content_hidden(self, report_id: uuid.UUID, is_hidden: bool, moderator_id: uuid.UUID, db: AsyncSession) -> Report:
        """Hide or unhide reported content during review."""
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        if report.target_type == ReportTargetType.post:
            await db.execute(update(Post).where(Post.id == report.target_id).values(is_hidden=is_hidden))
        report.is_hidden = is_hidden
        action = "hide_content" if is_hidden else "unhide_content"
        await self._log_action(moderator_id, action, "report", str(report_id), {"is_hidden": is_hidden}, db)
        await db.flush()
        return await self.get_report(report_id, db)

    async def escalate_report(self, report_id: uuid.UUID, priority: ReportPriority, moderator_id: uuid.UUID, db: AsyncSession) -> Report:
        """Escalate a report with a priority level."""
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        report.priority = priority
        sla_hours = {"low": 72, "medium": 48, "high": 24, "urgent": 4}
        report.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours.get(priority.value, 48))
        await self._log_action(moderator_id, "escalate", "report", str(report_id), {"priority": priority.value}, db)
        await db.flush()
        return await self.get_report(report_id, db)

    async def create_appeal(self, report_id: uuid.UUID, user_id: uuid.UUID, reason: str, db: AsyncSession):
        """File an appeal against a moderation action.

        Only the reporter or the reported target may appeal — a random user
        must not be able to file an appeal against someone else's report
        (IDOR). The caller is expected to already be authenticated (this is
        reachable even for deactivated users, since appeals are how a
        suspended user contests their case).
        """
        from app.models.moderation import ReportAppeal
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundException(detail="Report not found.")
        # Ownership: the reporter or the target of the report may appeal.
        is_involved = (
            report.reporter_id == user_id or report.target_id == user_id
        )
        if not is_involved:
            raise ForbiddenException(
                detail="You can only appeal a report you are directly involved in."
            )
        if report.status not in (ReportStatus.resolved, ReportStatus.dismissed):
            raise BadRequestException(detail="Can only appeal resolved or dismissed reports.")
        existing = await db.execute(select(ReportAppeal).where(ReportAppeal.report_id == report_id, ReportAppeal.user_id == user_id, ReportAppeal.status == AppealStatus.pending))
        if existing.scalar_one_or_none():
            raise BadRequestException(detail="You already have a pending appeal for this report.")
        appeal = ReportAppeal(report_id=report_id, user_id=user_id, reason=reason)
        db.add(appeal)
        await db.flush()
        return appeal

    async def review_appeal(self, appeal_id: uuid.UUID, data: AppealUpdate, reviewer_id: uuid.UUID, db: AsyncSession):
        """Approve or deny an appeal."""
        from app.models.moderation import ReportAppeal
        result = await db.execute(select(ReportAppeal).where(ReportAppeal.id == appeal_id))
        appeal = result.scalar_one_or_none()
        if not appeal:
            raise NotFoundException(detail="Appeal not found.")
        appeal.status = data.status
        appeal.reviewed_by = reviewer_id
        appeal.review_note = data.review_note
        appeal.reviewed_at = datetime.now(timezone.utc)
        await db.flush()
        notif_service = get_notification_service()
        await notif_service.create_notification(
            user_id=appeal.user_id,
            type=NotificationType.system,
            title=f"Appeal {data.status.value}",
            body=data.review_note or f"Your appeal has been {data.status.value}.",
            data={"appeal_id": str(appeal_id), "report_id": str(appeal.report_id)},
            actor_id=reviewer_id,
            db=db,
        )
        return appeal

    async def list_appeals(self, db: AsyncSession, status: AppealStatus | None = None, cursor: str | None = None, limit: int = 20):
        """List appeals (moderator only)."""
        from app.models.moderation import ReportAppeal
        query = select(ReportAppeal).options(selectinload(ReportAppeal.user).selectinload(User.profile), selectinload(ReportAppeal.reviewer).selectinload(User.profile)).order_by(ReportAppeal.created_at.desc())
        if status:
            query = query.where(ReportAppeal.status == status)
        total_result = await db.execute(select(func.count(ReportAppeal.id)).select_from(ReportAppeal))
        total_count = total_result.scalar() or 0
        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(ReportAppeal.created_at < cursor_dt)
        query = query.limit(limit + 1)
        result = await db.execute(query)
        appeals = result.scalars().unique().all()
        has_more = len(appeals) > limit
        next_cursor = None
        if has_more:
            appeals = appeals[:limit]
            next_cursor = appeals[-1].created_at.isoformat()
        return list(appeals), next_cursor, has_more, total_count

    async def get_audit_log(self, db: AsyncSession, cursor: str | None = None, limit: int = 50):
        """Get moderation audit log."""
        from app.models.moderation import ModerationAuditLog
        query = select(ModerationAuditLog).options(selectinload(ModerationAuditLog.moderator).selectinload(User.profile)).order_by(ModerationAuditLog.created_at.desc())
        total_result = await db.execute(select(func.count(ModerationAuditLog.id)).select_from(ModerationAuditLog))
        total_count = total_result.scalar() or 0
        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(ModerationAuditLog.created_at < cursor_dt)
        query = query.limit(limit + 1)
        result = await db.execute(query)
        logs = result.scalars().unique().all()
        has_more = len(logs) > limit
        next_cursor = None
        if has_more:
            logs = logs[:limit]
            next_cursor = logs[-1].created_at.isoformat()
        return list(logs), next_cursor, has_more, total_count

    async def _log_action(self, moderator_id: uuid.UUID, action: str, target_type: str, target_id: str, details: dict | None, db: AsyncSession):
        """Write an audit log entry."""
        from app.models.moderation import ModerationAuditLog
        log = ModerationAuditLog(moderator_id=moderator_id, action=action, target_type=target_type, target_id=target_id, details=details)
        db.add(log)

    async def check_auto_flag(self, content: str, author_id: uuid.UUID, target_type: ReportTargetType, target_id: uuid.UUID, db: AsyncSession) -> Report | None:
        """Check content against keyword blocklist and auto-create report if matched."""
        BLOCKED_KEYWORDS = ["spam", "scam", "hack", "phishing", "buy followers", "click here now"]
        content_lower = content.lower()
        for keyword in BLOCKED_KEYWORDS:
            if keyword in content_lower:
                report = Report(reporter_id=author_id, target_type=target_type, target_id=target_id, category=ReportCategory.spam, description=f"Auto-flagged: contains '{keyword}'")
                db.add(report)
                await db.flush()
                return report
        return None

    async def check_gradual_escalation(self, user_id: uuid.UUID, db: AsyncSession):
        """Check if a user should be auto-escalated based on resolved report count."""
        result = await db.execute(select(func.count(Report.id)).where(Report.target_type == ReportTargetType.user, Report.target_id == user_id, Report.status == ReportStatus.resolved))
        resolved_count = result.scalar() or 0
        if resolved_count >= 3:
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if user and user.role not in (UserRole.moderator, UserRole.university_staff, UserRole.admin):
                user.is_active = False
                user.locked_until = datetime.now(timezone.utc) + timedelta(days=30)
                notif_service = get_notification_service()
                await notif_service.create_notification(user_id=user_id, type=NotificationType.system, title="Account auto-suspended", body="Your account has been suspended due to repeated violations.", data={}, actor_id=None, db=db)

    async def auto_close_stale(self, db: AsyncSession):
        """Auto-dismiss reports older than 30 days with no action."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        result = await db.execute(select(Report).where(Report.status == ReportStatus.pending, Report.created_at < cutoff))
        stale = result.scalars().all()
        for report in stale:
            report.status = ReportStatus.dismissed
            report.resolution_note = "Auto-closed: no action within 30 days"
            report.resolved_at = datetime.now(timezone.utc)
        await db.flush()
        return len(stale)

    async def get_enhanced_stats(self, db: AsyncSession) -> dict:
        """Enhanced moderation stats with trends and breakdowns."""
        base_stats = await self.get_platform_stats(db)
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        resolved_week = await db.execute(select(func.count(Report.id)).where(Report.status == ReportStatus.resolved, Report.resolved_at >= week_ago))
        base_stats["resolved_this_week"] = resolved_week.scalar() or 0
        avg_result = await db.execute(select(func.avg(func.extract("epoch", Report.resolved_at - Report.created_at) / 3600)).where(Report.resolved_at.isnot(None)))
        avg_hours = avg_result.scalar()
        base_stats["avg_resolution_hours"] = round(float(avg_hours), 1) if avg_hours else None
        pri_counts = await db.execute(select(Report.priority, func.count(Report.id)).group_by(Report.priority))
        base_stats["by_priority"] = {row[0].value: row[1] for row in pri_counts.all()}
        now = datetime.now(timezone.utc)
        breached = await db.execute(select(func.count(Report.id)).where(Report.sla_deadline.isnot(None), Report.sla_deadline < now, Report.status.in_([ReportStatus.pending, ReportStatus.reviewing])))
        base_stats["sla_breached"] = breached.scalar() or 0
        return base_stats


def get_moderation_service() -> ModerationService:
    return ModerationService()

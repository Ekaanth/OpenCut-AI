"""Social platform upload service.

Provides upload capabilities to Instagram Reels, TikTok, and YouTube Shorts.
Each platform requires its own API credentials and has specific requirements.

This is a framework — actual API integration requires platform-specific
developer accounts and API keys.

Supported platforms:
  - YouTube Shorts (via YouTube Data API v3)
  - TikTok (via TikTok Content Posting API)
  - Instagram Reels (via Instagram Graph API)
"""

import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class UploadResult:
    def __init__(
        self,
        platform: str,
        success: bool,
        post_id: str | None = None,
        post_url: str | None = None,
        error: str | None = None,
    ):
        self.platform = platform
        self.success = success
        self.post_id = post_id
        self.post_url = post_url
        self.error = error

    def to_dict(self) -> dict:
        return {
            "platform": self.platform,
            "success": self.success,
            "post_id": self.post_id,
            "post_url": self.post_url,
            "error": self.error,
        }


class SocialUploadService:
    """Upload generated reels to social platforms."""

    SUPPORTED_PLATFORMS = ["youtube_shorts", "tiktok", "instagram_reels"]

    async def upload(
        self,
        platform: str,
        video_path: str,
        title: str,
        description: str = "",
        access_token: str = "",
        tags: list[str] | None = None,
    ) -> UploadResult:
        """Upload a video to the specified platform."""
        if platform not in self.SUPPORTED_PLATFORMS:
            return UploadResult(platform=platform, success=False, error=f"Unsupported platform: {platform}")

        if not os.path.exists(video_path):
            return UploadResult(platform=platform, success=False, error="Video file not found")

        if not access_token:
            return UploadResult(platform=platform, success=False, error=f"No access token for {platform}. Connect your account first.")

        if platform == "youtube_shorts":
            return await self._upload_youtube_shorts(video_path, title, description, access_token, tags)
        elif platform == "tiktok":
            return await self._upload_tiktok(video_path, title, access_token, tags)
        elif platform == "instagram_reels":
            return await self._upload_instagram_reels(video_path, title, access_token)

        return UploadResult(platform=platform, success=False, error="Not implemented")

    async def upload_batch(
        self,
        platforms: list[str],
        video_path: str,
        title: str,
        description: str = "",
        tokens: dict[str, str] | None = None,
        tags: list[str] | None = None,
    ) -> list[UploadResult]:
        """Upload to multiple platforms simultaneously."""
        tokens = tokens or {}
        tasks = [
            self.upload(
                platform=p,
                video_path=video_path,
                title=title,
                description=description,
                access_token=tokens.get(p, ""),
                tags=tags,
            )
            for p in platforms
        ]
        return await asyncio.gather(*tasks)

    async def _upload_youtube_shorts(
        self, video_path: str, title: str, description: str, access_token: str, tags: list[str] | None,
    ) -> UploadResult:
        """Upload to YouTube Shorts via the YouTube Data API v3 resumable upload."""
        try:
            file_size = os.path.getsize(video_path)

            # Step 1: Initiate resumable upload
            metadata = {
                "snippet": {
                    "title": title[:100],
                    "description": description[:5000],
                    "tags": tags or [],
                    "categoryId": "22",  # People & Blogs
                },
                "status": {
                    "privacyStatus": "private",  # Start as private, user can publish
                    "selfDeclaredMadeForKids": False,
                },
            }

            async with httpx.AsyncClient(timeout=300) as client:
                # Initiate upload
                init_resp = await client.post(
                    "https://www.googleapis.com/upload/youtube/v3/videos",
                    params={"uploadType": "resumable", "part": "snippet,status"},
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Upload-Content-Type": "video/mp4",
                        "X-Upload-Content-Length": str(file_size),
                    },
                    json=metadata,
                )

                if init_resp.status_code != 200:
                    return UploadResult(
                        platform="youtube_shorts", success=False,
                        error=f"YouTube upload init failed: {init_resp.text[:200]}",
                    )

                upload_url = init_resp.headers.get("Location")
                if not upload_url:
                    return UploadResult(
                        platform="youtube_shorts", success=False, error="No upload URL returned",
                    )

                # Step 2: Upload the video
                with open(video_path, "rb") as f:
                    upload_resp = await client.put(
                        upload_url,
                        content=f.read(),
                        headers={"Content-Type": "video/mp4"},
                    )

                if upload_resp.status_code in (200, 201):
                    data = upload_resp.json()
                    video_id = data.get("id", "")
                    return UploadResult(
                        platform="youtube_shorts",
                        success=True,
                        post_id=video_id,
                        post_url=f"https://youtube.com/shorts/{video_id}",
                    )
                else:
                    return UploadResult(
                        platform="youtube_shorts", success=False,
                        error=f"Upload failed: {upload_resp.text[:200]}",
                    )

        except Exception as e:
            return UploadResult(platform="youtube_shorts", success=False, error=str(e)[:300])

    async def _upload_tiktok(
        self, video_path: str, title: str, access_token: str, tags: list[str] | None,
    ) -> UploadResult:
        """Upload to TikTok via the Content Posting API.

        Requires TikTok developer account with Content Posting API access.
        """
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                # Step 1: Initialize upload
                file_size = os.path.getsize(video_path)
                init_resp = await client.post(
                    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "post_info": {
                            "title": title[:150],
                            "privacy_level": "SELF_ONLY",  # User can change after
                            "disable_duet": False,
                            "disable_stitch": False,
                            "disable_comment": False,
                        },
                        "source_info": {
                            "source": "FILE_UPLOAD",
                            "video_size": file_size,
                            "chunk_size": file_size,
                            "total_chunk_count": 1,
                        },
                    },
                )

                if init_resp.status_code != 200:
                    return UploadResult(
                        platform="tiktok", success=False,
                        error=f"TikTok init failed: {init_resp.text[:200]}",
                    )

                data = init_resp.json().get("data", {})
                upload_url = data.get("upload_url", "")
                publish_id = data.get("publish_id", "")

                if not upload_url:
                    return UploadResult(platform="tiktok", success=False, error="No upload URL")

                # Step 2: Upload video
                with open(video_path, "rb") as f:
                    upload_resp = await client.put(
                        upload_url,
                        content=f.read(),
                        headers={
                            "Content-Type": "video/mp4",
                            "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                        },
                    )

                if upload_resp.status_code in (200, 201):
                    return UploadResult(
                        platform="tiktok", success=True, post_id=publish_id,
                    )
                else:
                    return UploadResult(
                        platform="tiktok", success=False,
                        error=f"Upload failed: {upload_resp.text[:200]}",
                    )

        except Exception as e:
            return UploadResult(platform="tiktok", success=False, error=str(e)[:300])

    async def _upload_instagram_reels(
        self, video_path: str, caption: str, access_token: str,
    ) -> UploadResult:
        """Upload to Instagram Reels via the Instagram Graph API.

        Requires a Facebook/Instagram Business account with Graph API access.
        Video must be hosted at a public URL — for local files, upload to a
        temporary hosting service first.
        """
        # Instagram Graph API requires video at a public URL.
        # This implementation provides the framework; actual hosting of the
        # video file to a public URL must be handled by the caller.
        return UploadResult(
            platform="instagram_reels",
            success=False,
            error="Instagram Reels upload requires video at a public URL. Upload your reel file to your hosting first, then use the Instagram Graph API directly.",
        )


# Module-level singleton
social_upload = SocialUploadService()

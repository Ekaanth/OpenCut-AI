"""YouTube OAuth service for channel ownership verification.

Provides a stronger legal safeguard than checkbox confirmation by
verifying the user actually owns the YouTube channel via OAuth 2.0.

Requires a Google Cloud project with the YouTube Data API v3 enabled
and OAuth 2.0 credentials configured.

Environment variables:
  OPENCUTAI_GOOGLE_CLIENT_ID     — OAuth client ID
  OPENCUTAI_GOOGLE_CLIENT_SECRET — OAuth client secret
  OPENCUTAI_GOOGLE_REDIRECT_URI  — Redirect URI after OAuth flow
"""

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
SCOPES = "https://www.googleapis.com/auth/youtube.readonly"


class YouTubeOAuthService:
    """Handles YouTube OAuth flow for channel ownership verification."""

    def __init__(self) -> None:
        self.client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
        self.client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")
        self.redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/youtube/callback")

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_auth_url(self, state: str = "") -> str:
        """Generate the Google OAuth authorization URL."""
        if not self.is_configured:
            raise RuntimeError("YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
        if state:
            params["state"] = state

        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Exchange an authorization code for access + refresh tokens."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
            })
            resp.raise_for_status()
            return resp.json()

    async def get_user_channels(self, access_token: str) -> list[dict]:
        """Fetch the authenticated user's YouTube channels."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                YOUTUBE_CHANNELS_URL,
                params={"part": "snippet,contentDetails,statistics", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()

            channels = []
            for item in data.get("items", []):
                channels.append({
                    "channel_id": item["id"],
                    "title": item["snippet"]["title"],
                    "thumbnail": item["snippet"]["thumbnails"].get("default", {}).get("url", ""),
                    "subscriber_count": item.get("statistics", {}).get("subscriberCount"),
                })
            return channels

    async def verify_channel_ownership(self, access_token: str, video_channel_id: str) -> bool:
        """Verify that the authenticated user owns the channel the video belongs to."""
        try:
            channels = await self.get_user_channels(access_token)
            return any(ch["channel_id"] == video_channel_id for ch in channels)
        except Exception:
            logger.warning("Channel ownership verification failed", exc_info=True)
            return False


# Module-level singleton
youtube_oauth = YouTubeOAuthService()

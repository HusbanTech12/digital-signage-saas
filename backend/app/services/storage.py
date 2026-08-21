"""S3-compatible object storage with local filesystem fallback for development."""

from __future__ import annotations

import logging
import mimetypes
import re
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def sanitize_filename(name: str) -> str:
    base = Path(name).name.strip() or "file"
    cleaned = SAFE_NAME.sub("_", base)
    return cleaned[:180] or "file"


def infer_kind(mime_type: str, explicit: str | None = None) -> str:
    if explicit and explicit in {"image", "video", "audio", "logo", "promo", "other"}:
        return explicit
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    if mime_type.startswith("audio/"):
        return "audio"
    return "other"


def guess_mime(filename: str, fallback: str | None = None) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback or "application/octet-stream"


class MediaStorage:
    """Upload/download/delete bytes. Uses S3 when configured, else local disk."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def uses_s3(self) -> bool:
        return bool(self.settings.s3_bucket and self.settings.s3_access_key_id)

    def _local_root(self) -> Path:
        root = Path(self.settings.media_local_root).resolve()
        root.mkdir(parents=True, exist_ok=True)
        return root

    def _s3_client(self):
        import boto3
        from botocore.client import Config

        kwargs: dict = {
            "service_name": "s3",
            "aws_access_key_id": self.settings.s3_access_key_id,
            "aws_secret_access_key": self.settings.s3_secret_access_key,
            "region_name": self.settings.s3_region or "auto",
            "config": Config(signature_version="s3v4"),
        }
        if self.settings.s3_endpoint_url:
            kwargs["endpoint_url"] = self.settings.s3_endpoint_url
        return boto3.client(**kwargs)

    def public_url_for_key(self, storage_key: str) -> str:
        if self.uses_s3:
            if self.settings.s3_public_base_url:
                return f"{self.settings.s3_public_base_url.rstrip('/')}/{storage_key}"
            if self.settings.s3_endpoint_url:
                return (
                    f"{self.settings.s3_endpoint_url.rstrip('/')}/"
                    f"{self.settings.s3_bucket}/{storage_key}"
                )
            return f"https://{self.settings.s3_bucket}.s3.amazonaws.com/{storage_key}"
        # Served by API content route
        return f"/api/v1/media/content/{storage_key}"

    def put_bytes(
        self,
        *,
        storage_key: str,
        data: bytes,
        content_type: str,
    ) -> str:
        if self.uses_s3:
            client = self._s3_client()
            extra = {"ContentType": content_type}
            if self.settings.s3_acl:
                extra["ACL"] = self.settings.s3_acl
            client.put_object(
                Bucket=self.settings.s3_bucket,
                Key=storage_key,
                Body=data,
                **extra,
            )
            return self.public_url_for_key(storage_key)

        path = self._local_root() / storage_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return self.public_url_for_key(storage_key)

    def delete_key(self, storage_key: str) -> None:
        if self.uses_s3:
            try:
                self._s3_client().delete_object(
                    Bucket=self.settings.s3_bucket, Key=storage_key
                )
            except Exception:  # noqa: BLE001
                logger.exception("Failed to delete S3 object %s", storage_key)
            return
        path = self._local_root() / storage_key
        if path.exists():
            path.unlink()

    def read_bytes(self, storage_key: str) -> bytes | None:
        if self.uses_s3:
            try:
                obj = self._s3_client().get_object(
                    Bucket=self.settings.s3_bucket, Key=storage_key
                )
                return obj["Body"].read()
            except Exception:  # noqa: BLE001
                logger.exception("Failed to read S3 object %s", storage_key)
                return None
        path = self._local_root() / storage_key
        if not path.exists():
            return None
        return path.read_bytes()

    def signed_download_url(self, storage_key: str, expires_in: int = 3600) -> str | None:
        if not self.uses_s3:
            return None
        try:
            return self._s3_client().generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.s3_bucket, "Key": storage_key},
                ExpiresIn=expires_in,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to sign URL for %s", storage_key)
            return None


def get_media_storage() -> MediaStorage:
    return MediaStorage()

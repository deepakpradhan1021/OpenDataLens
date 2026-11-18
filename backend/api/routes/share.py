"""
Secure Sharing Routes for OpenDataLens (Production Hardened)
Enables users to publish read-only analytical dossiers and share them securely
with Argon2id password protection, brute-force rate limits, and header/body credential transport.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header, Response, status

from core.share_store import (
    create_share_link,
    get_shared_report,
    revoke_share_link
)

router = APIRouter(prefix="/share", tags=["Share"])


class CreateShareRequest(BaseModel):
    session_id: str = Field(..., description="Workspace session ID to snapshot")
    title: Optional[str] = Field(None, description="Custom title for the shared report")
    sections: Optional[List[str]] = Field(None, description="Sections to include (summary, quality, cleaning, ml, preview)")
    password: Optional[str] = Field(None, description="Optional password for access protection")
    expires_in_hours: Optional[int] = Field(None, description="Expiration time in hours (e.g. 24, 168)")


class UnlockShareRequest(BaseModel):
    password: str = Field(..., description="Password to unlock protected report")


@router.post("/create")
def generate_share(req: CreateShareRequest):
    """Create a shareable link for the current workspace report."""
    try:
        share_info = create_share_link(
            session_id=req.session_id,
            title=req.title,
            sections=req.sections,
            password=req.password,
            expires_in_hours=req.expires_in_hours
        )
        return {"status": "success", "share": share_info}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate share link: {str(e)}")


@router.get("/{token}")
def view_shared_report(
    token: str,
    x_share_password: Optional[str] = Header(None, alias="X-Share-Password")
):
    """
    Fetch a shared report snapshot. If password-protected, requires
    the X-Share-Password header (passwords are rejected in URL query strings for security).
    """
    result = get_shared_report(token=token, password=x_share_password)
    status_str = result.get("status")

    if status_str == "not_found":
        raise HTTPException(status_code=404, detail="Shared report link not found or revoked.")
    if status_str == "expired":
        raise HTTPException(status_code=410, detail="This shared report link has expired.")
    if status_str == "rate_limited":
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result.get("message", "Rate limit exceeded."),
            headers={"Retry-After": str(result.get("retry_after", 900))}
        )
    if status_str == "password_required":
        return {
            "status": "password_required",
            "title": result.get("title", "Protected Report"),
            "message": result.get("message", "Password required to view this report.")
        }
    if status_str == "invalid_password":
        raise HTTPException(status_code=401, detail="Incorrect password for shared report.")

    return result


@router.post("/{token}/unlock")
def unlock_shared_report(token: str, req: UnlockShareRequest):
    """
    Unlock and view a password-protected shared report using an HTTP POST body
    to ensure credentials are never exposed in URLs or access logs.
    """
    result = get_shared_report(token=token, password=req.password)
    status_str = result.get("status")

    if status_str == "not_found":
        raise HTTPException(status_code=404, detail="Shared report link not found or revoked.")
    if status_str == "expired":
        raise HTTPException(status_code=410, detail="This shared report link has expired.")
    if status_str == "rate_limited":
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result.get("message", "Rate limit exceeded."),
            headers={"Retry-After": str(result.get("retry_after", 900))}
        )
    if status_str == "invalid_password":
        raise HTTPException(status_code=401, detail="Incorrect password for shared report.")

    return result


@router.delete("/{token}")
def delete_shared_report(
    token: str,
    session_id: Optional[str] = None,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Revoke and permanently delete a shared report link after verifying owner."""
    sid = x_session_id or session_id
    success = revoke_share_link(token, session_id=sid)
    if not success:
        raise HTTPException(status_code=404, detail="Shared report not found, already deleted, or access denied.")
    return {"status": "success", "message": "Share link revoked successfully."}

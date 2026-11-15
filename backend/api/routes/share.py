"""
Secure Sharing Routes for OpenDataLens
Enables users to publish read-only analytical dossiers and share them securely
with optional password protection and configurable TTL expiration.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header, Query

from core.share_store import (
    create_share_link,
    get_shared_report,
    revoke_share_link
)

router = APIRouter(prefix="/share", tags=["Share"])


class CreateShareRequest(BaseModel):
    session_id: str = Field("default", description="Workspace session ID to snapshot")
    title: Optional[str] = Field(None, description="Custom title for the shared report")
    sections: Optional[List[str]] = Field(None, description="Sections to include (summary, quality, cleaning, ml, preview)")
    password: Optional[str] = Field(None, description="Optional password for access protection")
    expires_in_hours: Optional[int] = Field(None, description="Expiration time in hours (e.g. 24, 168)")


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
    x_share_password: Optional[str] = Header(None, alias="X-Share-Password"),
    password: Optional[str] = Query(None)
):
    """
    Fetch a shared report snapshot. If password-protected, requires
    either the X-Share-Password header or password query parameter.
    """
    pw = x_share_password or password
    result = get_shared_report(token=token, password=pw)
    status = result.get("status")

    if status == "not_found":
        raise HTTPException(status_code=404, detail="Shared report link not found or revoked.")
    if status == "expired":
        raise HTTPException(status_code=410, detail="This shared report link has expired.")
    if status == "password_required":
        return {
            "status": "password_required",
            "title": result.get("title", "Protected Report"),
            "message": result.get("message", "Password required to view this report.")
        }
    if status == "invalid_password":
        raise HTTPException(status_code=401, detail="Incorrect password for shared report.")

    return result


@router.delete("/{token}")
def delete_shared_report(token: str):
    """Revoke and permanently delete a shared report link."""
    success = revoke_share_link(token)
    if not success:
        raise HTTPException(status_code=404, detail="Shared report not found or already deleted.")
    return {"status": "success", "message": "Share link revoked successfully."}

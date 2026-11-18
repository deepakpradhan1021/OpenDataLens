"""
Guest Session Initialization and Authentication Routes for OpenDataLens.
Issues and validates cryptographically signed session tokens to preserve guest-first
experience while preventing session impersonation and arbitrary client ID forgery.
"""

from typing import Optional
import time
from fastapi import APIRouter, Header, Response, status
from pydantic import BaseModel, Field

from backend.api.security import (
    generate_server_session,
    verify_session_token,
    is_valid_raw_session_id,
    sign_session_id
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class SessionInitResponse(BaseModel):
    status: str = "success"
    session_token: str
    session_id: str
    created_at: float
    expires_in: int = 7200


class ValidateSessionResponse(BaseModel):
    valid: bool
    session_id: Optional[str] = None
    message: str


@router.post("/init", response_model=SessionInitResponse)
@router.get("/init", response_model=SessionInitResponse)
def initialize_guest_session(
    response: Response,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Issue a new cryptographically signed guest session token, or refresh an existing valid one.
    Sets the X-Session-ID response header so clients automatically synchronize their identity.
    """
    # If client provided a valid signed token, re-verify and keep it
    if x_session_id:
        is_valid, raw_id = verify_session_token(x_session_id, strict=True)
        if is_valid and raw_id:
            response.headers["X-Session-ID"] = x_session_id
            response.headers["X-Session-Created"] = "false"
            return SessionInitResponse(
                session_token=x_session_id,
                session_id=raw_id,
                created_at=0.0,
                expires_in=7200
            )
        elif is_valid_raw_session_id(x_session_id):
            # Client provided a valid raw UUID; sign it to preserve session identity
            signed_token = sign_session_id(x_session_id)
            response.headers["X-Session-ID"] = signed_token
            response.headers["X-Session-Created"] = "true"
            return SessionInitResponse(
                session_token=signed_token,
                session_id=x_session_id.strip(),
                created_at=time.time(),
                expires_in=7200
            )

    # Otherwise, mint a fresh server-signed session token
    sess = generate_server_session()
    response.headers["X-Session-ID"] = sess["session_token"]
    response.headers["X-Session-Created"] = "true"
    return SessionInitResponse(**sess)


@router.get("/validate", response_model=ValidateSessionResponse)
def validate_session(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Validate whether a session token is authentic and untampered."""
    if not x_session_id:
        return ValidateSessionResponse(
            valid=False,
            session_id=None,
            message="No X-Session-ID header provided."
        )

    is_valid, raw_id = verify_session_token(x_session_id, strict=True)
    if is_valid and raw_id:
        return ValidateSessionResponse(
            valid=True,
            session_id=raw_id,
            message="Session token is authentic and verified by server signature."
        )

    return ValidateSessionResponse(
        valid=False,
        session_id=None,
        message="Session token is invalid, tampered, or untrusted."
    )

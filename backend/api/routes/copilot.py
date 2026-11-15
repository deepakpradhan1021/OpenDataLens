"""
AI Dataset and Model Copilot / Intelligent Agent Route for OpenDataLens.
Provides conversational intelligence, multi-tier provider fallback,
dataset context integration, and secure action execution.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field

from core.ai_agent import run_agent_query, execute_approved_action
from core.ai_provider import provider_manager

router = APIRouter(prefix="/copilot", tags=["AI Analyst Copilot"])


class MessageItem(BaseModel):
    role: str
    content: str


class ProposedActionModel(BaseModel):
    id: str
    type: str = "cleaning_operation"
    action_type: str
    params: Dict[str, Any]
    description: str
    requires_approval: bool = True
    impact: Optional[str] = None


class CopilotQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1500)
    session_id: str = "default"
    conversation_history: Optional[List[MessageItem]] = None
    share_sample_rows: bool = False
    custom_api_key: Optional[str] = None
    custom_provider: str = "openai"


class CopilotQueryResponse(BaseModel):
    answer: str
    intent: str
    provider_used: str = "local_heuristic"
    model: Optional[str] = None
    suggested_followups: List[str] = []
    proposed_action: Optional[ProposedActionModel] = None
    metadata_snapshot: Optional[Dict[str, Any]] = None
    technical_details: Optional[Dict[str, Any]] = None


class ExecuteActionRequest(BaseModel):
    session_id: str = "default"
    action_type: str
    params: Dict[str, Any]


class ExecuteActionResponse(BaseModel):
    success: bool
    action: str
    rows: int
    cols: int
    can_undo: bool
    message: str


@router.get("/status")
def get_ai_status():
    """Return provider configuration status without leaking actual keys."""
    return provider_manager.get_provider_status()


@router.post("/query", response_model=CopilotQueryResponse)
def query_copilot(
    req: CopilotQueryRequest,
    x_custom_api_key: Optional[str] = Header(None, alias="X-Custom-API-Key")
):
    """
    Process an AI data analyst query with multi-tier fallback (LLM -> Heuristic),
    metadata-first context, and optional action proposal.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Header BYOK key takes precedence over body if provided
    active_byok_key = x_custom_api_key or req.custom_api_key

    # Format history if provided
    history_dicts = None
    if req.conversation_history:
        history_dicts = [{"role": m.role, "content": m.content} for m in req.conversation_history]

    try:
        res = run_agent_query(
            query=req.query,
            session_id=req.session_id,
            conversation_history=history_dicts,
            share_sample_rows=req.share_sample_rows,
            custom_api_key=active_byok_key,
            custom_provider=req.custom_provider
        )

        proposed_obj = None
        if res.get("proposed_action"):
            pa = res["proposed_action"]
            proposed_obj = ProposedActionModel(
                id=pa.get("id", "act_default"),
                type=pa.get("type", "cleaning_operation"),
                action_type=pa.get("action_type", ""),
                params=pa.get("params", {}),
                description=pa.get("description", ""),
                requires_approval=pa.get("requires_approval", True),
                impact=pa.get("impact")
            )

        return CopilotQueryResponse(
            answer=res["answer"],
            intent=res.get("intent", "ai_analyst"),
            provider_used=res.get("provider_used", "local_heuristic"),
            model=res.get("model"),
            suggested_followups=res.get("suggested_followups", []),
            proposed_action=proposed_obj,
            metadata_snapshot=res.get("metadata_snapshot"),
            technical_details=res.get("technical_details")
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI Analyst engine error: {str(exc)}")


@router.post("/execute-action", response_model=ExecuteActionResponse)
def execute_action(req: ExecuteActionRequest):
    """
    Execute a user-approved data cleaning operation via validated application functions.
    Never executes arbitrary code or shell commands.
    """
    try:
        res = execute_approved_action(
            session_id=req.session_id,
            action_type=req.action_type,
            params=req.params
        )
        return ExecuteActionResponse(
            success=res["success"],
            action=res["action"],
            rows=res["rows"],
            cols=res["cols"],
            can_undo=res["can_undo"],
            message=res["message"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Action execution failed: {str(exc)}")

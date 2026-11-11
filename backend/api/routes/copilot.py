"""
AI Dataset and Model Copilot Route for OpenDataLens.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.api.session_store import store
from core.copilot import answer_with_heuristics

router = APIRouter(prefix="/copilot", tags=["Copilot"])


class CopilotQueryRequest(BaseModel):
    query: str
    session_id: str = "default"


class CopilotQueryResponse(BaseModel):
    answer: str
    intent: str
    suggested_followups: List[str] = []


@router.post("/query", response_model=CopilotQueryResponse)
def query_copilot(req: CopilotQueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    session = store.get_or_create_session(req.session_id)
    dataset_meta = session.get("metadata")
    quality_analysis = session.get("quality_analysis")

    # Build ML results summary if available
    comp_df = session.get("comparison_df")
    ml_meta = session.get("ml_meta", {})
    ml_results = None
    if comp_df is not None:
        ml_results = {
            "comparison_table": comp_df.to_dict(orient="records"),
            "ml_meta": ml_meta
        }

    res = answer_with_heuristics(
        query=req.query,
        dataset_meta=dataset_meta,
        quality_analysis=quality_analysis,
        ml_results=ml_results
    )

    return CopilotQueryResponse(
        answer=res["answer"],
        intent=res["intent"],
        suggested_followups=res.get("suggested_followups", [])
    )

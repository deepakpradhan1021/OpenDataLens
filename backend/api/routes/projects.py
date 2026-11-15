"""
Projects Management Routes for OpenDataLens
Enables users to save, list, restore, export, and delete workspace sessions.
"""

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from fastapi.responses import StreamingResponse
import io

from core.project_store import (
    list_projects,
    get_project,
    save_project,
    load_project,
    delete_project,
    export_project_bundle,
    import_project_bundle
)

router = APIRouter(prefix="/projects", tags=["Projects"])


class SaveProjectRequest(BaseModel):
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field("", description="Project description or notes")
    session_id: str = Field("default", description="Active workspace session ID")
    project_id: Optional[str] = Field(None, description="Optional ID to overwrite existing project")


class LoadProjectRequest(BaseModel):
    session_id: str = Field("default", description="Target session ID to restore project into")


@router.get("")
def get_all_projects():
    """List all saved projects."""
    return {"projects": list_projects()}


@router.post("/save")
def save_current_project(req: SaveProjectRequest):
    """Save the active workspace as a project."""
    try:
        project = save_project(
            session_id=req.session_id,
            name=req.name,
            description=req.description or "",
            project_id=req.project_id
        )
        return {"status": "success", "project": project}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save project: {str(e)}")


@router.get("/{project_id}")
def get_project_details(project_id: str):
    """Get project metadata."""
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    return proj


@router.post("/{project_id}/load")
def restore_project(project_id: str, req: LoadProjectRequest):
    """Restore a saved project into the active workspace."""
    try:
        result = load_project(project_id=project_id, session_id=req.session_id)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore project: {str(e)}")


@router.delete("/{project_id}")
def remove_project(project_id: str):
    """Delete a saved project."""
    success = delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or already deleted.")
    return {"status": "success", "message": f"Project '{project_id}' deleted."}


@router.get("/{project_id}/bundle")
def download_bundle(project_id: str):
    """Download project archive (.odl)."""
    try:
        bundle_bytes = export_project_bundle(project_id)
        return StreamingResponse(
            io.BytesIO(bundle_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=project_{project_id[:8]}.odl"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bundle project: {str(e)}")


@router.post("/import")
async def import_bundle(file: UploadFile = File(...)):
    """Import an uploaded .odl bundle."""
    try:
        content = await file.read()
        res = import_project_bundle(content)
        return {"status": "success", "project": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid project bundle: {str(e)}")

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user, require_roles
from app.models.user import User
from app.models.employee import Employee
from app.schemas.hrms import AgentMessageRequest, AgentMessageResponse
from app.agents.orchestrator import RoleAgentOrchestrator
from app.agents.llm_factory import llm_client
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["AI Copilot & Agents"])

class SwitchProviderRequest(BaseModel):
    provider: str  # "gemini" or "ollama"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    ollama_url: Optional[str] = None

class TestConnectionRequest(BaseModel):
    provider: str  # "gemini" or "ollama"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    ollama_url: Optional[str] = None

@router.post("/chat", response_model=AgentMessageResponse)
async def agent_chat(
    data: AgentMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch employee profile if any
    emp_q = select(Employee).where(Employee.user_id == current_user.id)
    emp_res = await db.execute(emp_q)
    employee = emp_res.scalar_one_or_none()
    
    response = await RoleAgentOrchestrator.process_user_turn(
        user=current_user,
        employee=employee,
        message=data.message,
        confirmed_action=data.confirmed_action,
        db=db
    )
    return response

@router.get("/config")
async def get_agent_config(current_user: User = Depends(get_current_user)):
    return {
        "current_provider": llm_client.provider,
        "gemini_configured": bool(llm_client.gemini_key),
        "gemini_model": llm_client.gemini_model,
        "ollama_url": llm_client.ollama_url,
        "ollama_model": llm_client.ollama_model,
        "supported_providers": ["gemini", "ollama"],
        "supported_gemini_models": [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.5-flash",
            "gemini-pro"
        ],
        "common_ollama_models": [
            "llama3.2:1b",
            "qwen2.5:1.5b",
            "llama3.2:3b",
            "phi3:mini",
            "llama3.1:8b",
            "mistral:latest"
        ]
    }

class PullModelRequest(BaseModel):
    model_name: str
    ollama_url: Optional[str] = None

@router.post("/ollama/pull")
async def pull_ollama_model(
    data: PullModelRequest,
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Trigger pull/download of a model in Ollama."""
    url = (data.ollama_url or llm_client.ollama_url).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{url}/api/pull",
                json={"name": data.model_name, "stream": False}
            )
            if resp.status_code == 200:
                llm_client.ollama_model = data.model_name
                return {
                    "success": True,
                    "message": f"Successfully downloaded and registered model '{data.model_name}'!",
                    "model": data.model_name
                }
            return {
                "success": False,
                "error": f"Ollama HTTP {resp.status_code}: {resp.text}"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/config")
async def update_agent_config(
    data: SwitchProviderRequest,
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    if data.provider not in ["gemini", "ollama"]:
        raise HTTPException(status_code=400, detail="Provider must be 'gemini' or 'ollama'")

    llm_client.persist_config(
        provider=data.provider,
        api_key=data.api_key if data.api_key is not None else None,
        gemini_model=data.model_name if data.provider == "gemini" else None,
        ollama_url=data.ollama_url if data.ollama_url else None,
        ollama_model=data.model_name if data.provider == "ollama" else None
    )

    return {
        "message": f"LLM configuration updated and persisted. Active provider: {llm_client.provider}",
        "active_provider": llm_client.provider,
        "gemini_configured": bool(llm_client.gemini_key),
        "gemini_model": llm_client.gemini_model,
        "ollama_url": llm_client.ollama_url,
        "ollama_model": llm_client.ollama_model
    }

@router.post("/test")
async def test_llm_connection(
    data: TestConnectionRequest,
    current_user: User = Depends(require_roles(["admin", "super_admin"]))
):
    """Test connection to Gemini or Ollama without saving settings."""
    result = await llm_client.test_connection(
        provider=data.provider,
        api_key=data.api_key,
        model_name=data.model_name,
        ollama_url=data.ollama_url
    )
    return result

@router.get("/ollama/models")
async def list_ollama_models(
    ollama_url: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Query live Ollama endpoint to discover models already pulled and ready."""
    target_url = (ollama_url or llm_client.ollama_url).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"{target_url}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                return {
                    "available": True,
                    "models": models,
                    "url": target_url
                }
    except Exception as e:
        return {
            "available": False,
            "models": [],
            "error": str(e),
            "url": target_url
        }
    return {
        "available": False,
        "models": [],
        "url": target_url
    }

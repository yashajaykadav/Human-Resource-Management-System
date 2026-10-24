from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.api.deps import get_current_user, require_roles, require_permission
from app.models.user import User
from app.models.policy import PolicyDocument, PolicyChunk
from pydantic import BaseModel

router = APIRouter(prefix="/policies", tags=["Company Policies & RAG"])

class PolicyCreate(BaseModel):
    title: str
    category: str = "General"
    full_text: str

@router.get("")
async def list_policies(db: AsyncSession = Depends(get_db)):
    query = select(PolicyDocument).order_by(PolicyDocument.title)
    result = await db.execute(query)
    policies = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "category": p.category,
            "version": p.version,
            "summary": p.full_text[:200] + "..." if len(p.full_text) > 200 else p.full_text,
            "created_at": p.created_at.isoformat()
        }
        for p in policies
    ]

@router.get("/{id}")
async def get_policy(id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(PolicyDocument).where(PolicyDocument.id == id)
    result = await db.execute(query)
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "version": policy.version,
        "full_text": policy.full_text,
        "created_at": policy.created_at.isoformat()
    }

@router.post("")
async def create_policy(
    data: PolicyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("policies"))
):
    doc = PolicyDocument(
        title=data.title,
        category=data.category,
        full_text=data.full_text
    )
    db.add(doc)
    await db.flush()
    
    # Simple chunking by paragraphs for semantic vector retrieval
    paragraphs = [p.strip() for p in data.full_text.split("\n\n") if len(p.strip()) > 30]
    for idx, p in enumerate(paragraphs):
        chunk = PolicyChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=p
        )
        db.add(chunk)
        
    await db.commit()
    await db.refresh(doc)
    return {"message": "Policy document ingested and indexed", "id": str(doc.id)}


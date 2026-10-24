from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user, require_roles, require_permission
from app.models.user import User
from app.models.recruitment import JobPosting, Candidate, Application, JobStatus, ApplicationStage
from app.schemas.hrms import JobPostingCreate, CandidateCreate, ApplicationUpdateStage

router = APIRouter(prefix="/recruitment", tags=["Recruitment & ATS"])

@router.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    query = select(JobPosting).options(selectinload(JobPosting.department)).order_by(JobPosting.created_at.desc())
    result = await db.execute(query)
    jobs = result.scalars().all()
    
    return [
        {
            "id": str(j.id),
            "title": j.title,
            "department": j.department.name if j.department else "General",
            "location": j.location,
            "job_type": j.job_type,
            "salary_range": j.salary_range,
            "status": j.status.value,
            "min_experience_years": j.min_experience_years,
            "description": j.description,
            "requirements": j.requirements,
            "created_at": j.created_at.isoformat()
        }
        for j in jobs
    ]

@router.post("/jobs")
async def create_job(
    data: JobPostingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("recruitment"))
):
    job = JobPosting(**data.model_dump())
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"message": "Job posting created", "id": str(job.id), "title": job.title}

@router.get("/applications")
async def list_applications(
    job_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("recruitment"))
):
    query = select(Application).options(
        selectinload(Application.candidate),
        selectinload(Application.job_posting)
    ).order_by(Application.created_at.desc())
    
    if job_id:
        query = query.where(Application.job_id == job_id)
        
    result = await db.execute(query)
    apps = result.scalars().all()
    
    return [
        {
            "id": str(a.id),
            "job_id": str(a.job_id),
            "job_title": a.job_posting.title if a.job_posting else "Role",
            "candidate_id": str(a.candidate_id),
            "candidate_name": a.candidate.full_name if a.candidate else "Applicant",
            "candidate_email": a.candidate.email if a.candidate else "",
            "parsed_skills": a.candidate.parsed_skills if a.candidate else "",
            "stage": a.stage.value,
            "ai_match_score": a.ai_match_score,
            "ai_screening_summary": a.ai_screening_summary,
            "created_at": a.created_at.isoformat()
        }
        for a in apps
    ]

@router.patch("/applications/{app_id}/stage")
async def update_application_stage(
    app_id: UUID,
    data: ApplicationUpdateStage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("recruitment"))
):
    query = select(Application).where(Application.id == app_id)
    result = await db.execute(query)
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    app.stage = data.stage
    if data.notes:
        app.notes = data.notes
    await db.commit()
    return {"message": f"Candidate moved to {data.stage.value}", "id": str(app.id)}


import io
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import DbSession
from app.models.analysis import Analysis
from app.services.export_service import ExportService

router = APIRouter()


@router.get("/{analysis_id}/csv")
async def export_csv(analysis_id: uuid.UUID, db: DbSession) -> StreamingResponse:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    export_service = ExportService()
    csv_content = export_service.generate_csv(analysis)

    return StreamingResponse(
        io.BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=analysis_{analysis_id}.csv"},
    )


@router.get("/{analysis_id}/excel")
async def export_excel(analysis_id: uuid.UUID, db: DbSession) -> StreamingResponse:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    export_service = ExportService()
    excel_content = export_service.generate_excel(analysis)

    return StreamingResponse(
        io.BytesIO(excel_content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=analysis_{analysis_id}.xlsx"},
    )


@router.get("/{analysis_id}/pdf-report")
async def export_pdf_report(
    analysis_id: uuid.UUID,
    db: DbSession,
    report_type: str = Query("summary", enum=["summary", "detailed"]),
) -> StreamingResponse:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    export_service = ExportService()
    pdf_content = export_service.generate_pdf_report(analysis, report_type=report_type)

    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=analysis_{analysis_id}_{report_type}.pdf"
        },
    )

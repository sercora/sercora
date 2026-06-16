from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.database.database import SessionLocal
from app.schemas.estimate import EstimateCreate

router = APIRouter()


NAS_ESTIMATE_ROOTS = {
    "in_progress": Path("/NAS/Soumissions en cours"),
    "sent": Path("/NAS/Soumissions envoyées"),
    "rejected": Path("/NAS/@Recycle/Soumissions en cours")
}


ESTIMATE_FOLDER_STATUS_PATTERN = "^(in_progress|sent|rejected)$"


def estimate_root(
    status: str
):

    root = NAS_ESTIMATE_ROOTS.get(status)

    if root is None:
        raise HTTPException(
            status_code=400,
            detail="Unknown estimate folder status"
        )

    if not root.exists():
        raise HTTPException(
            status_code=503,
            detail="NAS estimate folder is not mounted"
        )

    return root


def resolve_estimate_path(
    status: str,
    relative_path: str | None
):

    root = estimate_root(status).resolve()
    clean_path = (relative_path or "").strip("/")

    if Path(clean_path).is_absolute() or ".." in Path(clean_path).parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid NAS path"
        )

    target = (root / clean_path).resolve()

    if root != target and root not in target.parents:
        raise HTTPException(
            status_code=400,
            detail="Invalid NAS path"
        )

    return root, target


def folder_item_payload(
    root: Path,
    entry: Path
):

    stat = entry.stat()

    return {
        "name": entry.name,
        "relative_path": str(entry.relative_to(root)),
        "is_dir": entry.is_dir(),
        "size": stat.st_size,
        "modified_at": stat.st_mtime
    }


@router.get("/estimate-folders")
def get_estimate_folders(
    status: str = Query(..., pattern=ESTIMATE_FOLDER_STATUS_PATTERN),
    path: str = ""
):

    root, target = resolve_estimate_path(
        status,
        path
    )

    if not target.exists() or not target.is_dir():
        raise HTTPException(
            status_code=404,
            detail="NAS folder not found"
        )

    items = []

    for entry in target.iterdir():
        try:
            items.append(
                folder_item_payload(
                    root,
                    entry
                )
            )
        except OSError:
            continue

    items.sort(
        key=lambda item: (
            not item["is_dir"],
            item["name"].lower()
        )
    )

    return {
        "status": status,
        "path": str(target.relative_to(root)) if target != root else "",
        "root_name": root.name,
        "items": items
    }


@router.get("/estimate-files")
def get_estimate_file(
    status: str = Query(..., pattern=ESTIMATE_FOLDER_STATUS_PATTERN),
    path: str = Query(..., min_length=1)
):

    _root, target = resolve_estimate_path(
        status,
        path
    )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail="NAS file not found"
        )

    return FileResponse(
        target,
        filename=target.name
    )


@router.get("/estimates")
def get_estimates():

    db = SessionLocal()

    rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.project_id,
                e.revision_number,
                e.estimate_type,
                e.description,
                p.project_name
            FROM estimate e
            JOIN project p
                ON p.id = e.project_id
            ORDER BY
                p.project_name,
                e.revision_number
            """
        )
    )

    estimates = []

    for row in rows:

        estimates.append(
            {
                "id": row.id,
                "project_id": row.project_id,
                "project_name": row.project_name,
                "revision_number": row.revision_number,
                "estimate_type": row.estimate_type,
                "description": row.description
            }
        )

    db.close()

    return estimates


@router.get("/estimates/{estimate_id}")
def get_estimate(estimate_id: int):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            SELECT
                id,
                project_id,
                revision_number,
                estimate_type,
                description
            FROM estimate
            WHERE id = :id
            """
        ),
        {
            "id": estimate_id
        }
    ).fetchone()

    db.close()

    if row is None:

        raise HTTPException(
            status_code=404,
            detail="Estimate not found"
        )

    return {
        "id": row.id,
        "project_id": row.project_id,
        "revision_number": row.revision_number,
        "estimate_type": row.estimate_type,
        "description": row.description
    }


@router.post("/estimates")
def create_estimate(estimate: EstimateCreate):

    db = SessionLocal()

    row = db.execute(
        text(
            """
            INSERT INTO estimate (
                project_id,
                revision_number,
                estimate_type,
                description
            )
            VALUES (
                :project_id,
                :revision_number,
                :estimate_type,
                :description
            )
            RETURNING id
            """
        ),
        {
            "project_id": estimate.project_id,
            "revision_number": estimate.revision_number,
            "estimate_type": estimate.estimate_type,
            "description": estimate.description
        }
    ).fetchone()

    db.commit()

    db.close()

    return {
        "id": row.id,
        "message": "Estimate created"
    }

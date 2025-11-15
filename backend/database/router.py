"""
Database router - handles all database admin operations
Separated from main router for better organization
"""
from fastapi import APIRouter, Depends, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from database import SessionLocal, MatchSummary, init_db, engine

db_router = APIRouter()


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MatchSummaryCreate(BaseModel):
    match_id: str
    players: List[Dict[str, Any]]
    results: Dict[str, Any]
    match_summary_text: Optional[str] = None
    winner_id: Optional[str] = None
    total_questions: int = 0
    duration_seconds: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    class Config:
        extra = "allow"


# Database initialization
@db_router.post("/admin/db/init")
async def init_database():
    """Initialize database tables"""
    try:
        init_db()
        return {"success": True, "message": "Database tables initialized successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.get("/admin/db/stats")
async def get_database_stats(db: Session = Depends(get_db)):
    """Get database statistics"""
    try:
        total_matches = db.query(MatchSummary).count()
        return {
            "success": True,
            "stats": {
                "total_matches": total_matches
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# Match-specific endpoints (legacy)
@db_router.get("/admin/db/matches")
async def list_all_matches(db: Session = Depends(get_db)):
    """List all match summaries"""
    try:
        matches = db.query(MatchSummary).order_by(MatchSummary.completed_at.desc()).all()
        return {
            "success": True,
            "matches": [match.to_dict() for match in matches]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.post("/admin/db/matches")
async def create_match_summary(match_data: MatchSummaryCreate, db: Session = Depends(get_db)):
    """Create a new match summary"""
    try:
        existing = db.query(MatchSummary).filter(MatchSummary.match_id == match_data.match_id).first()
        if existing:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": f"Match with ID '{match_data.match_id}' already exists"}
            )
        
        started_at = None
        completed_at = None
        try:
            if match_data.started_at:
                started_at = datetime.fromisoformat(match_data.started_at.replace('Z', '+00:00'))
        except:
            pass
        
        try:
            if match_data.completed_at:
                completed_at = datetime.fromisoformat(match_data.completed_at.replace('Z', '+00:00'))
            else:
                completed_at = datetime.utcnow()
        except:
            completed_at = datetime.utcnow()
        
        match_summary = MatchSummary(
            match_id=match_data.match_id,
            players=match_data.players,
            results=match_data.results,
            match_summary_text=match_data.match_summary_text,
            winner_id=match_data.winner_id,
            total_questions=match_data.total_questions,
            duration_seconds=match_data.duration_seconds,
            started_at=started_at,
            completed_at=completed_at
        )
        
        db.add(match_summary)
        db.commit()
        db.refresh(match_summary)
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "match": match_summary.to_dict()}
        )
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@db_router.get("/admin/db/matches/{match_id}")
async def get_match_summary(match_id: str, db: Session = Depends(get_db)):
    """Get a specific match summary"""
    try:
        match = db.query(MatchSummary).filter(MatchSummary.match_id == match_id).first()
        if not match:
            return {"success": False, "error": "Match not found"}
        return {"success": True, "match": match.to_dict()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.put("/admin/db/matches/{match_id}")
async def update_match_summary(match_id: str, match_data: Dict = Body(...), db: Session = Depends(get_db)):
    """Update a match summary"""
    try:
        match = db.query(MatchSummary).filter(MatchSummary.match_id == match_id).first()
        if not match:
            return {"success": False, "error": "Match not found"}
        
        if "players" in match_data:
            match.players = match_data["players"]
        if "results" in match_data:
            match.results = match_data["results"]
        if "match_summary_text" in match_data:
            match.match_summary_text = match_data["match_summary_text"]
        if "winner_id" in match_data:
            match.winner_id = match_data["winner_id"]
        if "total_questions" in match_data:
            match.total_questions = match_data["total_questions"]
        if "duration_seconds" in match_data:
            match.duration_seconds = match_data["duration_seconds"]
        
        db.commit()
        db.refresh(match)
        
        return {"success": True, "match": match.to_dict()}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@db_router.delete("/admin/db/matches/{match_id}")
async def delete_match_summary(match_id: str, db: Session = Depends(get_db)):
    """Delete a match summary"""
    try:
        match = db.query(MatchSummary).filter(MatchSummary.match_id == match_id).first()
        if not match:
            return {"success": False, "error": "Match not found"}
        
        db.delete(match)
        db.commit()
        
        return {"success": True, "message": f"Match '{match_id}' deleted successfully"}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@db_router.delete("/admin/db/matches")
async def delete_all_matches(db: Session = Depends(get_db)):
    """Delete all match summaries"""
    try:
        count = db.query(MatchSummary).count()
        db.query(MatchSummary).delete()
        db.commit()
        return {"success": True, "message": f"Deleted {count} match(es)"}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# Generic table management endpoints (phpMyAdmin-like)
@db_router.get("/admin/db/tables")
async def list_all_tables(db: Session = Depends(get_db)):
    """List all tables in the database"""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {"success": True, "tables": tables}
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.get("/admin/db/tables/{table_name}/structure")
async def get_table_structure(table_name: str, db: Session = Depends(get_db)):
    """Get table structure/columns"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return {"success": False, "error": f"Table '{table_name}' not found"}
        
        columns = inspector.get_columns(table_name)
        pk_constraint = inspector.get_pk_constraint(table_name)
        primary_keys = pk_constraint.get('constrained_columns', [])
        
        structure = []
        for col in columns:
            structure.append({
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col.get("nullable", True),
                "default": str(col.get("default", "")),
                "primary_key": col["name"] in primary_keys
            })
        
        return {"success": True, "structure": structure, "primary_keys": primary_keys}
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.get("/admin/db/tables/{table_name}/rows")
async def list_table_rows(table_name: str, db: Session = Depends(get_db), limit: int = 100, offset: int = 0):
    """List all rows from a table"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return {"success": False, "error": f"Table '{table_name}' not found"}
        
        result = db.execute(text(f"SELECT * FROM {table_name} LIMIT :limit OFFSET :offset"), 
                          {"limit": limit, "offset": offset})
        rows = []
        columns = [col[0] for col in result.cursor.description] if result.cursor.description else []
        
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i]
                if isinstance(value, datetime):
                    row_dict[col] = value.isoformat()
                elif isinstance(value, (dict, list)):
                    row_dict[col] = json.dumps(value) if value else None
                else:
                    row_dict[col] = value
            rows.append(row_dict)
        
        count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        total_count = count_result.scalar()
        
        return {"success": True, "rows": rows, "columns": columns, "total": total_count}
    except Exception as e:
        return {"success": False, "error": str(e)}


@db_router.post("/admin/db/tables/{table_name}/rows")
async def insert_table_row(table_name: str, row_data: Dict = Body(...), db: Session = Depends(get_db)):
    """Insert a new row into a table"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": f"Table '{table_name}' not found"}
            )
        
        columns = list(row_data.keys())
        placeholders = ", ".join([f":{col}" for col in columns])
        column_names = ", ".join(columns)
        
        sql = text(f"INSERT INTO {table_name} ({column_names}) VALUES ({placeholders})")
        db.execute(sql, row_data)
        db.commit()
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Row inserted into '{table_name}'"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@db_router.put("/admin/db/tables/{table_name}/rows")
async def update_table_row(table_name: str, update_data: Dict = Body(...), db: Session = Depends(get_db)):
    """Update a row in a table"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": f"Table '{table_name}' not found"}
            )
        
        pk_constraint = inspector.get_pk_constraint(table_name)
        primary_keys = pk_constraint.get('constrained_columns', [])
        
        if not primary_keys:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Table has no primary key"}
            )
        
        where_clause = " AND ".join([f"{pk} = :{pk}" for pk in primary_keys])
        where_params = {pk: update_data.pop(pk) for pk in primary_keys if pk in update_data}
        
        if not where_params:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Primary key values required for update"}
            )
        
        set_clause = ", ".join([f"{col} = :{col}" for col in update_data.keys()])
        sql = text(f"UPDATE {table_name} SET {set_clause} WHERE {where_clause}")
        
        params = {**update_data, **where_params}
        result = db.execute(sql, params)
        db.commit()
        
        if result.rowcount == 0:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "No rows updated"}
            )
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Row updated in '{table_name}'"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@db_router.delete("/admin/db/tables/{table_name}/rows")
async def delete_table_row(table_name: str, where_data: Dict = Body(...), db: Session = Depends(get_db)):
    """Delete a row from a table"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": f"Table '{table_name}' not found"}
            )
        
        where_clause = " AND ".join([f"{col} = :{col}" for col in where_data.keys()])
        sql = text(f"DELETE FROM {table_name} WHERE {where_clause}")
        
        result = db.execute(sql, where_data)
        db.commit()
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Deleted {result.rowcount} row(s) from '{table_name}'"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@db_router.post("/admin/db/tables")
async def create_table(table_def: Dict = Body(...), db: Session = Depends(get_db)):
    """Create a new table"""
    try:
        table_name = table_def.get("name")
        columns_def = table_def.get("columns", [])
        
        if not table_name:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Table name required"}
            )
        
        inspector = inspect(engine)
        if table_name in inspector.get_table_names():
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": f"Table '{table_name}' already exists"}
            )
        
        column_defs = []
        for col in columns_def:
            col_name = col["name"]
            col_type = col["type"].upper()
            nullable = "" if col.get("nullable", True) else " NOT NULL"
            primary_key = " PRIMARY KEY" if col.get("primary_key", False) else ""
            default = f" DEFAULT {col['default']}" if col.get("default") else ""
            
            column_defs.append(f"{col_name} {col_type}{nullable}{default}{primary_key}")
        
        sql = text(f"CREATE TABLE {table_name} ({', '.join(column_defs)})")
        db.execute(sql)
        db.commit()
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Table '{table_name}' created successfully"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


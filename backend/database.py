"""
Database models for match summaries
Simple SQL storage with match_id as primary key
"""
from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()


class MatchSummary(Base):
    """Stores the final summary/results of a completed match"""
    __tablename__ = "match_summaries"
    
    match_id = Column(String, primary_key=True)  # Primary key: match_id
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Players in the match - stored as JSON array
    players = Column(JSON, nullable=False)
    
    # Final results - stored as JSON
    results = Column(JSON, nullable=False)
    
    # LLM-generated summary
    match_summary_text = Column(Text, nullable=True)
    winner_id = Column(String, nullable=True, index=True)
    
    # Metadata
    total_questions = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=True)
    
    def to_dict(self):
        return {
            "match_id": self.match_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "players": self.players,
            "results": self.results,
            "match_summary_text": self.match_summary_text,
            "winner_id": self.winner_id,
            "total_questions": self.total_questions,
            "duration_seconds": self.duration_seconds
        }


# Database setup
def get_database_url():
    """Get database URL - SQLite for dev, PostgreSQL for production"""
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        # PostgreSQL (Railway provides DATABASE_URL)
        return db_url
    else:
        # SQLite for local development
        return "sqlite:///./game_data.db"


engine = create_engine(get_database_url(), connect_args={"check_same_thread": False} if "sqlite" in get_database_url() else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("Database initialized")


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


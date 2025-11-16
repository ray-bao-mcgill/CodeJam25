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


class OngoingMatch(Base):
    """Stores ongoing and completed matches"""
    __tablename__ = "ongoing_matches"
    
    match_id = Column(String, primary_key=True)  # Primary key: match_id
    lobby_id = Column(String, nullable=False, index=True)  # Reference to lobby
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True, index=True)
    
    # Match Configuration - determines question types
    match_type = Column(String, nullable=False, index=True)  # "job_posting" or "generalized"
    
    # All match configuration stored as JSON for flexibility
    # Contains: job_description, role, level, and any other configuration
    match_config = Column(JSON, nullable=False, default={})  # Full match configuration
    
    # Players in the match - stored as JSON array
    players = Column(JSON, nullable=False)
    
    # Game state - current state of the match (scores, rounds, etc.)
    game_state = Column(JSON, nullable=False, default={})  # Current game state
    
    # LLM-generated summary (only populated when match is completed)
    match_summary_text = Column(Text, nullable=True)
    winner_id = Column(String, nullable=True, index=True)
    
    # Metadata
    total_questions = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=True)
    
    def to_dict(self):
        return {
            "match_id": self.match_id,
            "lobby_id": self.lobby_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "match_type": self.match_type,
            "match_config": self.match_config or {},
            "players": self.players,
            "game_state": self.game_state or {},
            "match_summary_text": self.match_summary_text,
            "winner_id": self.winner_id,
            "total_questions": self.total_questions,
            "duration_seconds": self.duration_seconds
        }


class BehaviouralPool(Base):
    """Stores predefined behavioural interview questions"""
    __tablename__ = "behavioural_pool"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String, nullable=False, index=True)  # e.g., "software engineering", "consulting"
    level = Column(String, nullable=False, index=True)  # e.g., "intern", "junior", "midlevel", "senior", "lead"
    question = Column(Text, nullable=False)
    used_count = Column(Integer, default=0)  # Track how many times this question has been used
    
    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "level": self.level,
            "question": self.question,
            "used_count": self.used_count
        }


class TechnicalTheoryPool(Base):
    """Stores predefined technical theory questions (multiple choice)"""
    __tablename__ = "technical_theory_pool"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String, nullable=False, index=True)  # e.g., "software engineering", "backend"
    level = Column(String, nullable=False, index=True)  # e.g., "intern", "junior", "midlevel", "senior", "lead"
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)  # The correct answer
    incorrect_answers = Column(JSON, nullable=False)  # List of incorrect answer options
    used_count = Column(Integer, default=0)  # Track how many times this question has been used
    
    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "level": self.level,
            "question": self.question,
            "correct_answer": self.correct_answer,
            "incorrect_answers": self.incorrect_answers,
            "used_count": self.used_count
        }


class TechnicalPracticalPool(Base):
    """Stores predefined technical practical questions"""
    __tablename__ = "technical_practical_pool"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String, nullable=False, index=True)  # e.g., "software engineering", "backend"
    level = Column(String, nullable=False, index=True)  # e.g., "intern", "junior", "midlevel", "senior", "lead"
    question = Column(Text, nullable=False)
    used_count = Column(Integer, default=0)  # Track how many times this question has been used
    
    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "level": self.level,
            "question": self.question,
            "used_count": self.used_count
        }


# Database setup
def get_database_url():
    """Get database URL - SQLite for dev, PostgreSQL for production"""
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        # PostgreSQL (Railway provides DATABASE_URL)
        # Railway may provide postgres:// but SQLAlchemy needs postgresql://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        print(f"Using PostgreSQL database: {db_url[:50]}...", flush=True)
        return db_url
    else:
        # SQLite for local development - create in ./database directory
        db_dir = os.path.join(os.path.dirname(__file__), "..", "database")
        db_dir = os.path.abspath(db_dir)
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, "game_data.db")
        print(f"Using SQLite database: {db_path}", flush=True)
        return f"sqlite:///{db_path}"


database_url = get_database_url()
print(f"Database URL configured: {database_url[:50]}...", flush=True)

try:
    engine = create_engine(
        database_url, 
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
        pool_pre_ping=True  # Verify connections before using
    )
    print("Database engine created successfully", flush=True)
except Exception as e:
    print(f"ERROR: Failed to create database engine: {e}", flush=True)
    raise
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables and seed initial data"""
    try:
        print("Initializing database...", flush=True)
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully", flush=True)
    except Exception as e:
        print(f"ERROR: Failed to create database tables: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise
    
    # Seed question pools from predefined data
    from database.question_pools import (
        get_all_behavioural_questions,
        get_all_technical_theory_questions,
        get_all_technical_practical_questions
    )
    
    db = SessionLocal()
    try:
        # Seed behavioural pool
        behavioural_count = db.query(BehaviouralPool).count()
        if behavioural_count == 0:
            behavioural_questions = get_all_behavioural_questions()
            for q_data in behavioural_questions:
                question = BehaviouralPool(**q_data)
                db.add(question)
            db.commit()
            print(f"Seeded {len(behavioural_questions)} behavioural questions", flush=True)
        else:
            print(f"Behavioural pool already has {behavioural_count} questions, skipping seed", flush=True)
        
        # Seed technical theory pool
        theory_count = db.query(TechnicalTheoryPool).count()
        if theory_count == 0:
            theory_questions = get_all_technical_theory_questions()
            for q_data in theory_questions:
                question = TechnicalTheoryPool(**q_data)
                db.add(question)
            db.commit()
            print(f"Seeded {len(theory_questions)} technical theory questions", flush=True)
        else:
            print(f"Technical theory pool already has {theory_count} questions, skipping seed", flush=True)
        
        # Seed technical practical pool
        practical_count = db.query(TechnicalPracticalPool).count()
        if practical_count == 0:
            practical_questions = get_all_technical_practical_questions()
            for q_data in practical_questions:
                question = TechnicalPracticalPool(**q_data)
                db.add(question)
            db.commit()
            print(f"Seeded {len(practical_questions)} technical practical questions", flush=True)
        else:
            print(f"Technical practical pool already has {practical_count} questions, skipping seed", flush=True)
    except Exception as e:
        db.rollback()
        print(f"ERROR: Error seeding question pools: {e}", flush=True)
        import traceback
        traceback.print_exc()
        # Don't raise - seeding is not critical
    finally:
        db.close()
    
    print("Database initialized successfully", flush=True)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


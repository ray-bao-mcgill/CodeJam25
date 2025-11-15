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


class InterviewQuestionCache(Base):
    """Stores LLM-generated interview questions by category"""
    __tablename__ = "interview_q_cache"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False, index=True)  # e.g., "behavioural", "technical_theory", "technical_practical"
    question = Column(Text, nullable=False)
    difficulty = Column(String, nullable=True)  # e.g., "easy", "medium", "hard"
    tags = Column(JSON, nullable=True)  # Optional tags for filtering
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    used_count = Column(Integer, default=0)  # Track how many times this question has been used
    
    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "question": self.question,
            "difficulty": self.difficulty,
            "tags": self.tags,
            "created_at": self.created_at.isoformat() if self.created_at else None,
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
    
    # Seed initial interview questions if table is empty
    db = SessionLocal()
    try:
        existing_count = db.query(InterviewQuestionCache).count()
        print(f"Interview question cache has {existing_count} questions", flush=True)
        if existing_count == 0:
            initial_questions = [
                # Behavioural questions
                {
                    "category": "behavioural",
                    "question": "Tell me about a time when you had to work under pressure to meet a deadline. What was the situation and how did you handle it?",
                    "difficulty": "medium",
                    "tags": ["deadline", "pressure", "time-management"]
                },
                {
                    "category": "behavioural",
                    "question": "Describe a situation where you had to work with a difficult team member. How did you resolve conflicts and ensure the project succeeded?",
                    "difficulty": "medium",
                    "tags": ["teamwork", "conflict-resolution", "communication"]
                },
                {
                    "category": "behavioural",
                    "question": "Give an example of a time when you had to learn a new technology or skill quickly. What was your approach?",
                    "difficulty": "easy",
                    "tags": ["learning", "adaptability", "growth"]
                },
                {
                    "category": "behavioural",
                    "question": "Tell me about a project where you had to take initiative or leadership. What challenges did you face?",
                    "difficulty": "hard",
                    "tags": ["leadership", "initiative", "project-management"]
                },
                {
                    "category": "behavioural",
                    "question": "Describe a time when you made a mistake that impacted your team. How did you handle it and what did you learn?",
                    "difficulty": "medium",
                    "tags": ["mistakes", "accountability", "learning"]
                },
                
                # Technical Theory questions
                {
                    "category": "technical_theory",
                    "question": "Explain the difference between REST and GraphQL APIs. When would you choose one over the other?",
                    "difficulty": "medium",
                    "tags": ["api", "rest", "graphql", "architecture"]
                },
                {
                    "category": "technical_theory",
                    "question": "What is the difference between SQL JOIN types (INNER, LEFT, RIGHT, FULL OUTER)? Provide examples of when to use each.",
                    "difficulty": "medium",
                    "tags": ["sql", "database", "joins"]
                },
                {
                    "category": "technical_theory",
                    "question": "Explain the concept of database normalization. What are the normal forms and why are they important?",
                    "difficulty": "hard",
                    "tags": ["database", "normalization", "design"]
                },
                {
                    "category": "technical_theory",
                    "question": "What is the difference between synchronous and asynchronous programming? Give examples of when each is appropriate.",
                    "difficulty": "medium",
                    "tags": ["programming", "async", "concurrency"]
                },
                {
                    "category": "technical_theory",
                    "question": "Explain the CAP theorem and its implications for distributed systems design.",
                    "difficulty": "hard",
                    "tags": ["distributed-systems", "theory", "architecture"]
                },
                
                # Technical Practical questions
                {
                    "category": "technical_practical",
                    "question": "Write a function that finds the longest common subsequence between two strings. What is the time complexity of your solution?",
                    "difficulty": "hard",
                    "tags": ["algorithms", "dynamic-programming", "strings"]
                },
                {
                    "category": "technical_practical",
                    "question": "Design a database schema for a blog system with users, posts, comments, and tags. Include relationships and indexes.",
                    "difficulty": "medium",
                    "tags": ["database", "schema-design", "relationships"]
                },
                {
                    "category": "technical_practical",
                    "question": "Implement a function to reverse a linked list. Handle edge cases and explain your approach.",
                    "difficulty": "medium",
                    "tags": ["data-structures", "linked-list", "algorithms"]
                },
                {
                    "category": "technical_practical",
                    "question": "Write code to implement a rate limiter that allows 100 requests per minute per user. How would you scale this?",
                    "difficulty": "hard",
                    "tags": ["system-design", "rate-limiting", "scalability"]
                },
                {
                    "category": "technical_practical",
                    "question": "Debug the following code: A function that should return the sum of all even numbers in an array, but it's returning incorrect results. What could be wrong?",
                    "difficulty": "easy",
                    "tags": ["debugging", "arrays", "logic"]
                }
            ]
            
            for q_data in initial_questions:
                question = InterviewQuestionCache(**q_data)
                db.add(question)
            
            db.commit()
            print(f"Seeded {len(initial_questions)} initial interview questions", flush=True)
        else:
            print(f"Interview question cache already has {existing_count} questions, skipping seed", flush=True)
    except Exception as e:
        db.rollback()
        print(f"ERROR: Error seeding interview questions: {e}", flush=True)
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


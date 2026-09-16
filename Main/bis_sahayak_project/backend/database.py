import os
import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

# Load variables from .env into the environment
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not found. Make sure you created a '.env' file "
        "(copy .env.example -> .env) and filled in your Supabase/Postgres URL."
    )

# pool_pre_ping avoids 'connection closed' errors on idle Supabase connections
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ChatAuditLog(Base):
    """Stores every question, answer, citations and user feedback for audit purposes."""

    __tablename__ = "chat_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_query = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    citations = Column(String, nullable=True)  # comma-separated PDF file names
    confidence_score = Column(String, default="High")
    user_feedback = Column(String, nullable=True)  # 'up', 'down', or null
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def init_db():
    """Creates tables in the database if they don't already exist. Safe to call every startup."""
    Base.metadata.create_all(bind=engine)
    print("[database] Tables verified/created successfully.")

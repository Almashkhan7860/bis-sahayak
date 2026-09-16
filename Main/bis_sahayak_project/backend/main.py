from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from rag_engine import BISRAGEngine
from database import init_db, SessionLocal, ChatAuditLog

rag_system = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_system
    init_db()
    print("[main] Initializing RAG engine (this can take a moment)...")
    rag_system = BISRAGEngine()
    yield


app = FastAPI(title="BIS-Sahayak AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Replace "*" with your real Netlify URL once deployed, e.g.:
    # allow_origins=["https://your-site-name.netlify.app"]
    allow_origins=["https://bis-friend.netlify.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class QueryModel(BaseModel):
    query: str
    conversation_id: str | None = None  # frontend sends a per-tab UUID so the bot can remember follow-ups


class FeedbackModel(BaseModel):
    log_id: int
    feedback: str


@app.get("/")
def home():
    return {"status": "BIS-Sahayak API & DB are Ready!"}


@app.post("/api/chat")
def chat(data: QueryModel, db: Session = Depends(get_db)):
    if not data.query or not data.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        result = rag_system.ask(data.query, conversation_id=data.conversation_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG engine error: {e}")

    try:
        db_log = ChatAuditLog(
            user_query=data.query,
            ai_response=result["answer"],
            citations=", ".join(result["citations"]),
            confidence_score=result["confidence"],
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        log_id = db_log.id
    except Exception as e:
        db.rollback()
        log_id = None
        print(f"[main] Warning: failed to write audit log: {e}")

    return {
        "success": True,
        "log_id": log_id,
        "answer": result["answer"],
        "citations": result["citations"],
        "confidence": result["confidence"],
    }


@app.post("/api/feedback")
def save_feedback(data: FeedbackModel, db: Session = Depends(get_db)):
    log = db.query(ChatAuditLog).filter(ChatAuditLog.id == data.log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    log.user_feedback = data.feedback
    db.commit()
    return {"success": True, "message": "Feedback saved!"}
import os
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gemini-3.6-flash")

if not GOOGLE_API_KEY:
    raise RuntimeError(
        "GOOGLE_API_KEY not found. Make sure you created a '.env' file "
        "(copy .env.example -> .env) and filled in your Gemini API key."
    )
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

FAISS_INDEX_PATH = "faiss_index"

# ------------------------------------------------------------------
# Grounding / confidence thresholds (FAISS L2 distance, lower = more
# similar). These are starting points, NOT scientifically calibrated —
# print the raw scores (see _score_bucket) while testing with your own
# BIS PDFs and adjust these two numbers if High/Medium feels wrong.
# ------------------------------------------------------------------
DISTANCE_HIGH_CONFIDENCE = 1.35  # avg distance below this -> "High"
DISTANCE_MEDIUM_CONFIDENCE = 1.85  # below this -> "Medium", above -> not grounded

MAX_HISTORY_TURNS = 3  # how many previous Q&A pairs to remember per conversation


class BISRAGEngine:
    def __init__(self, data_folder: str = None):
        self.data_folder = data_folder or os.getenv("DATA_FOLDER", "./data")
        self.vectorstore = None
        self.qa_chain = None
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
        # conversation_id -> list of {"query": ..., "answer": ...} (most recent last)
        # NOTE: in-memory only — resets on server restart. Fine for a demo;
        # move this to a Supabase table if you need it to persist later.
        self.conversations = {}
        self.response_cache = {}
        self.init_rag()

    def init_rag(self):
        if os.path.isdir(FAISS_INDEX_PATH):
            print("[rag_engine] Found existing FAISS index, loading from disk...")
            self.vectorstore = FAISS.load_local(
                FAISS_INDEX_PATH, self.embeddings, allow_dangerous_deserialization=True,
            )
        else:
            self._build_vectorstore_from_pdfs()

        # ---- Structured, grounded system prompt ----
        system_prompt = (
            "You are BIS-Sahayak, a trusted AI assistant for the Bureau of Indian Standards.\n"
            "Answer the question STRICTLY and ONLY using the Context below. Do not use outside "
            "knowledge, even if you know the answer generally — this context is the verified source "
            "of truth.\n\n"
            "If the Context does not contain enough information to answer, reply EXACTLY: "
            "\"I couldn't verify this from the available BIS documents.\" Do not guess.\n\n"
            "If there is a Conversation History below, use it only to understand what the user's "
            "current question is referring to (e.g. pronouns like 'it', 'this standard'). Still "
            "answer strictly from the Context.\n\n"
            "Format your answer using EXACTLY this structure, with these markdown headers:\n"
            "**Direct Answer:** A single clear sentence answering the question.\n"
            "**Key Points:** 2-4 bullet points with the core facts.\n"
            "**Important Details/Conditions:** Any exceptions, conditions, or caveats (omit this "
            "section entirely if there are none).\n\n"
            "Respond in the same language as the user's current question (Hindi or English). Do "
            "not include a 'Sources' section — that is added separately by the system.\n\n"
            "Conversation History:\n{chat_history}\n\n"
            "Context:\n{context}"
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])

        llm = ChatGoogleGenerativeAI(model=CHAT_MODEL, temperature=0.1)
        self.qa_chain = create_stuff_documents_chain(llm, prompt)
        print("[rag_engine] RAG Engine Ready!")

    def _build_vectorstore_from_pdfs(self):
        if not os.path.isdir(self.data_folder) or not os.listdir(self.data_folder):
            raise RuntimeError(
                f"No PDFs found in '{self.data_folder}'. Create that folder and put at least "
                "one BIS PDF inside it, then restart."
            )

        print(f"[rag_engine] Loading PDFs from '{self.data_folder}'...")
        loader = PyPDFDirectoryLoader(self.data_folder)
        docs = loader.load()
        if not docs:
            raise RuntimeError(f"'{self.data_folder}' exists but no readable PDF pages were found.")

        print(f"[rag_engine] Loaded {len(docs)} pages. Chunking...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        final_documents = text_splitter.split_documents(docs)

        print(f"[rag_engine] Creating vector database from {len(final_documents)} chunks...")
        self.vectorstore = FAISS.from_documents(final_documents, self.embeddings)
        self.vectorstore.save_local(FAISS_INDEX_PATH)
        print(f"[rag_engine] FAISS index saved to '{FAISS_INDEX_PATH}/'.")

    # ---- conversation memory helpers ----
    def _get_history_text(self, conversation_id):
        if not conversation_id or conversation_id not in self.conversations:
            return "(no previous messages)"
        turns = self.conversations[conversation_id]
        if not turns:
            return "(no previous messages)"
        lines = []
        for t in turns:
            lines.append(f"User: {t['query']}")
            lines.append(f"Assistant: {t['answer']}")
        return "\n".join(lines)

    def _save_turn(self, conversation_id, query, answer):
        if not conversation_id:
            return
        self.conversations.setdefault(conversation_id, [])
        self.conversations[conversation_id].append({"query": query, "answer": answer})
        self.conversations[conversation_id] = self.conversations[conversation_id][-MAX_HISTORY_TURNS:]

    def _contextualized_query(self, query, conversation_id):
        """Builds a retrieval query that folds in recent conversation, so a
        follow-up like 'what is the minimum cover?' after 'what is IS 456?'
        still retrieves the right chunks."""
        if not conversation_id or conversation_id not in self.conversations:
            return query
        turns = self.conversations[conversation_id]
        if not turns:
            return query
        recent = turns[-1]
        return f"{recent['query']} {recent['answer'][:200]} {query}"

    def _score_bucket(self, avg_distance):
        print(f"[rag_engine] Retrieval avg L2 distance: {avg_distance:.4f}")  # for calibration
        if avg_distance < DISTANCE_HIGH_CONFIDENCE:
            return "High", True
        if avg_distance < DISTANCE_MEDIUM_CONFIDENCE:
            return "Medium", True
        return "Low", False  # False = not grounded enough, don't trust the LLM here

    def _cache_and_return(self, clean_query, result):
        self.response_cache[clean_query] = result
        return result

    def ask(self, query: str, conversation_id: str = None) -> dict:
        clean_query = query.strip().lower()
        if clean_query in self.response_cache:
            print("[rag_engine] Returning response from CACHE (0 API calls used)!")
            return self.response_cache[clean_query]

        search_query = self._contextualized_query(query, conversation_id)

        # Retrieve with scores so we can compute evidence-based confidence
        # and decide whether we're actually grounded before calling the LLM.
        results = self.vectorstore.similarity_search_with_score(search_query, k=3)

        if not results:
            answer = "I couldn't verify this from the available BIS documents."
            self._save_turn(conversation_id, query, answer)
            result = {"answer": answer, "citations": [], "confidence": "Low (No match found)"}
            return self._cache_and_return(clean_query, result)

        docs = [doc for doc, _score in results]
        avg_distance = sum(score for _doc, score in results) / len(results)
        confidence_label, is_grounded = self._score_bucket(avg_distance)

        if not is_grounded:
            answer = "I couldn't verify this from the available BIS documents."
            self._save_turn(conversation_id, query, answer)
            result = {"answer": answer, "citations": [], "confidence": f"Low (weak match, distance={avg_distance:.2f})"}
            return self._cache_and_return(clean_query, result)

        history_text = self._get_history_text(conversation_id)
        answer = self.qa_chain.invoke({"input": query, "context": docs, "chat_history": history_text})

        # If the LLM itself decided the context wasn't good enough (even
        # though our distance-based check said it was "grounded"), don't
        # show citations/confidence that contradict that — be honest.
        if "couldn't verify this" in answer.lower():
            self._save_turn(conversation_id, query, answer)
            result = {
                "answer": answer,
                "citations": [],
                "confidence": "Low (insufficient information in provided documents)",
            }
            return self._cache_and_return(clean_query, result)

        citations = []
        for doc in docs:
            source_file = os.path.basename(doc.metadata.get("source", "BIS Document"))
            page = doc.metadata.get("page")
            if page is not None:
                citations.append(f"{source_file} (Page {page + 1})")
            else:
                citations.append(source_file)
        citations = list(dict.fromkeys(citations))  # de-dupe, keep order

        self._save_turn(conversation_id, query, answer)

        result = {
            "answer": answer,
            "citations": citations,
            "confidence": f"{confidence_label} (Verified Source)",
        }
        return self._cache_and_return(clean_query, result)
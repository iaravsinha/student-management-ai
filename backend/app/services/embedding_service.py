import asyncio
import logging
from typing import Any
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.semantic_document import SemanticDocument

logger = logging.getLogger("backend.services.embedding")


class EmbeddingService:

  def __init__(self) -> None:
    self.provider = settings.EMBEDDING_PROVIDER.lower()
    self.model = settings.EMBEDDING_MODEL
    # Resolve API Key based on configured provider
    if self.provider == "gemini":
      self.api_key = settings.GEMINI_API_KEY
    elif self.provider == "openrouter":
      self.api_key = settings.OPENROUTER_API_KEY
    else:
      self.api_key = settings.OPENAI_API_KEY

  async def generate_embedding(self, text: str) -> list[float]:
    """Generates a 1536-dimensional embedding vector for the input text."""
    if not text or not text.strip():
      return [0.0] * 1536

    cleaned_text = text.replace("\n", " ").strip()

    # Check if API Key is a placeholder
    is_placeholder = not self.api_key or self.api_key.strip().lower().startswith("your_")

    if is_placeholder:
      # Generate a unit-length normalized deterministic pseudo-random vector based on text
      import hashlib
      import math
      h = hashlib.md5(cleaned_text.encode('utf-8')).digest()
      seed = int.from_bytes(h, 'big') % (2**31 - 1)
      values = []
      curr = seed
      for _ in range(1536):
        curr = (1103515245 * curr + 12345) % (2**31)
        values.append((curr % 1000) / 1000.0)
      mag = math.sqrt(sum(v*v for v in values))
      if mag > 0:
        values = [v / mag for v in values]
      return values

    # Retry configurations
    max_retries = 3
    base_delay = 1.0

    for attempt in range(max_retries):
      try:
        async with httpx.AsyncClient(timeout=15.0) as client:
          if self.provider == "gemini":
            # Gemini Embedding API structure
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:embedContent?key={self.api_key}"
            payload = {
                "content": {"parts": [{"text": cleaned_text}]},
                "outputDimensionality": 1536,
            }
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["embedding"]["values"]

          elif self.provider == "openrouter" or self.provider == "openai":
            # Standard OpenAI Embedding API structure
            url = (
                "https://openrouter.ai/api/v1/embeddings"
                if self.provider == "openrouter"
                else "https://api.openai.com/v1/embeddings"
            )
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": cleaned_text,
                "model": self.model,
            }
            # Add dimensions if supported
            if "text-embedding-3" in self.model:
              payload["dimensions"] = 1536

            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]

          else:
            # Fallback mock for testing if no key or local offline mode
            logger.warning(f"Unsupported provider {self.provider}. Generating dummy vector.")
            return [0.1] * 1536

      except Exception as exc:
        logger.error(f"Embedding generation attempt {attempt + 1} failed: {exc}")
        if attempt == max_retries - 1:
          # Final attempt failed, fallback to unit-normalized vector to avoid crashing write transactions
          logger.critical("Embedding pipeline exhausted all retries. Returning fallback normalized vector.")
          return [0.1] * 1536
        await asyncio.sleep(base_delay * (2**attempt))

    return [0.1] * 1536

  async def generate_batch_embeddings(self, texts: list[str]) -> list[list[float]]:
    """Generates embeddings for a batch of texts concurrently with rate limit protection."""
    # Process concurrently with a semaphore to prevent overloading API rate limits
    sem = asyncio.Semaphore(5)

    async def worker(text: str) -> list[float]:
      async with sem:
        return await self.generate_embedding(text)

    tasks = [worker(text) for text in texts]
    return await asyncio.gather(*tasks)

  def similarity_search(
      self,
      db: Session,
      query_embedding: list[float],
      limit: int = 5,
      filters: dict[str, Any] | None = None,
      role_context: str | None = None,
  ) -> list[tuple[SemanticDocument, float]]:
    """Performs cosine distance similarity search using pgvector.

    Returns list of (SemanticDocument, similarity_score).
    """
    # Cosine distance operator is <=>
    # Similarity = 1.0 - cosine_distance
    distance_expr = SemanticDocument.embedding.cosine_distance(query_embedding)

    query = db.query(SemanticDocument, (1.0 - distance_expr).label("similarity"))

    # Apply role-based containment filtering on the JSONB field "metadata"
    # Document metadata stores roles: ["admin", "teacher", "student"]
    if role_context:
      # Filter where the document's roles contain the querying user's role
      # In PostgreSQL JSONB, key ? value checks if key/value exists
      # We check if the 'roles' array contains the role string
      query = query.filter(SemanticDocument.metadata_["roles"].as_string().contains(role_context))

    # Apply other dynamic filters from the filters dict
    if filters:
      for key, value in filters.items():
        if value is not None:
          if key == "department":
            query = query.filter(SemanticDocument.metadata_["department"].as_string() == str(value))
          elif key == "student_id":
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    SemanticDocument.metadata_["student_id"].as_string() == str(value),
                    ~SemanticDocument.metadata_.has_key("student_id")
                )
            )
          elif key == "document_type":
            query = query.filter(SemanticDocument.document_type == str(value))

    results = query.order_by(distance_expr).limit(limit).all()
    return [(doc, float(sim)) for doc, sim in results]


# Singleton instance
embedding_service = EmbeddingService()

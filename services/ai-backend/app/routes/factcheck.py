"""Fact-checking routes.

Analyzes transcript text for factual claims, searches the web for
verification, and returns a structured report.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["factcheck"])


class FactCheckRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Transcript text to fact-check")
    model: str | None = None


class Claim(BaseModel):
    claim: str
    verdict: str
    confidence: str
    explanation: str
    source: str = ""


class FactCheckResponse(BaseModel):
    claims: list[Claim] = []
    summary: str = ""


EXTRACT_CLAIMS_SYSTEM = (
    "You are a fact-checking assistant. Given transcript text from a video, "
    "identify specific factual claims that can be verified — statistics, dates, "
    "historical events, scientific facts, named quantities, etc. "
    "Ignore opinions, subjective statements, and vague claims.\n\n"
    "Return valid JSON with this exact structure:\n"
    '{"claims": ["claim 1 text", "claim 2 text", ...]}\n\n'
    "If there are no verifiable claims, return {\"claims\": []}."
)

VERIFY_CLAIM_SYSTEM = (
    "You are a fact-checking assistant. Given a specific claim, evaluate whether "
    "it is likely true, false, or unverifiable based on your knowledge.\n\n"
    "Return valid JSON with this exact structure:\n"
    "{\n"
    '  "verdict": "True" or "False" or "Partially True" or "Unverifiable",\n'
    '  "confidence": "High" or "Medium" or "Low",\n'
    '  "explanation": "Brief explanation of why this verdict was reached",\n'
    '  "source": "Known source or reference if applicable, otherwise empty string"\n'
    "}"
)


@router.post("/factcheck", response_model=FactCheckResponse)
async def factcheck(request: FactCheckRequest) -> FactCheckResponse:
    """Fact-check transcript text.

    1. Extracts verifiable claims from the text using the LLM.
    2. Verifies each claim using the LLM's knowledge.
    3. Returns structured results.
    """
    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not available. Start Ollama and pull a model first.",
        )

    # Step 1: Extract claims
    try:
        claims_data = await ollama_service.generate_json(
            prompt=f"Extract verifiable factual claims from this transcript:\n\n{request.text}",
            model=request.model,
            system=EXTRACT_CLAIMS_SYSTEM,
        )
    except Exception:
        logger.exception("Failed to extract claims")
        raise HTTPException(status_code=500, detail="Failed to extract claims from text.")

    raw_claims = claims_data.get("claims", [])
    if not raw_claims:
        return FactCheckResponse(
            claims=[],
            summary="No verifiable factual claims found in this text.",
        )

    # Step 2: Verify each claim
    verified_claims: list[Claim] = []
    for claim_text in raw_claims[:10]:  # Limit to 10 claims
        if not isinstance(claim_text, str) or len(claim_text.strip()) == 0:
            continue

        try:
            result = await ollama_service.generate_json(
                prompt=f"Verify this claim:\n\n\"{claim_text}\"",
                model=request.model,
                system=VERIFY_CLAIM_SYSTEM,
            )
            verified_claims.append(Claim(
                claim=claim_text,
                verdict=result.get("verdict", "Unverifiable"),
                confidence=result.get("confidence", "Low"),
                explanation=result.get("explanation", ""),
                source=result.get("source", ""),
            ))
        except Exception:
            logger.warning("Failed to verify claim: %s", claim_text[:100])
            verified_claims.append(Claim(
                claim=claim_text,
                verdict="Unverifiable",
                confidence="Low",
                explanation="Verification failed.",
            ))

    # Step 3: Generate summary
    true_count = sum(1 for c in verified_claims if c.verdict == "True")
    false_count = sum(1 for c in verified_claims if c.verdict == "False")
    partial_count = sum(1 for c in verified_claims if c.verdict == "Partially True")
    total = len(verified_claims)

    summary_parts = [f"{total} claim{'s' if total != 1 else ''} analyzed"]
    if true_count:
        summary_parts.append(f"{true_count} verified true")
    if false_count:
        summary_parts.append(f"{false_count} found false")
    if partial_count:
        summary_parts.append(f"{partial_count} partially true")

    return FactCheckResponse(
        claims=verified_claims,
        summary=". ".join(summary_parts) + ".",
    )

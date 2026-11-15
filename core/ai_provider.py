"""
Pluggable AI Provider Abstraction and Multi-Tier Fallback Manager for OpenDataLens.
Supports OpenAI, Groq, OpenRouter, Google Gemini, and user BYOK (Bring Your Own Key).
Credentials remain exclusively on backend; user keys are held only in-memory per request.
"""

import os
import logging
from typing import Dict, Any, Optional, List
import httpx

logger = logging.getLogger(__name__)


class ProviderError(Exception):
    """Base class for external AI provider exceptions."""
    def __init__(self, message: str, provider: str = "unknown", status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class AuthenticationError(ProviderError):
    """Invalid or expired API credentials."""
    pass


class RateLimitError(ProviderError):
    """Provider rate limits exceeded or quota exhausted."""
    pass


class ProviderTimeoutError(ProviderError):
    """Network connection or execution timeout."""
    pass


class AIProvider:
    """Base interface for all LLM providers."""
    def __init__(self, name: str):
        self.name = name

    def is_available(self) -> bool:
        raise NotImplementedError

    def generate(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        raise NotImplementedError


class OpenAICompatibleProvider(AIProvider):
    """Universal client for OpenAI-compatible REST endpoints (OpenAI, Groq, OpenRouter, Gemini)."""
    def __init__(
        self,
        name: str,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        default_model: str = "gpt-4o-mini",
        timeout_seconds: float = 18.0
    ):
        super().__init__(name)
        self.api_key = api_key.strip() if api_key else ""
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    def is_available(self) -> bool:
        return bool(self.api_key)

    def generate(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        if not self.is_available():
            raise AuthenticationError(f"No API key configured for {self.name}", provider=self.name)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.default_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        url = f"{self.base_url}/chat/completions"
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                res = client.post(url, json=payload, headers=headers)

                if res.status_code == 401 or res.status_code == 403:
                    raise AuthenticationError(
                        f"Authentication failed for {self.name}: Invalid or unauthorized API key.",
                        provider=self.name,
                        status_code=res.status_code
                    )
                elif res.status_code == 429:
                    raise RateLimitError(
                        f"Rate limit or quota exceeded for {self.name}.",
                        provider=self.name,
                        status_code=429
                    )
                elif res.status_code >= 500:
                    raise ProviderError(
                        f"{self.name} server error ({res.status_code}): {res.text[:200]}",
                        provider=self.name,
                        status_code=res.status_code
                    )
                elif res.status_code != 200:
                    raise ProviderError(
                        f"{self.name} returned status {res.status_code}: {res.text[:200]}",
                        provider=self.name,
                        status_code=res.status_code
                    )

                data = res.json()
                choices = data.get("choices", [])
                if not choices or not choices[0].get("message"):
                    raise ProviderError(f"Malformed response structure from {self.name}", provider=self.name)

                text = choices[0]["message"].get("content", "").strip()
                return {
                    "text": text,
                    "provider": self.name,
                    "model": data.get("model", self.default_model),
                    "finish_reason": choices[0].get("finish_reason", "stop"),
                    "usage": data.get("usage", {})
                }
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(
                f"Request to {self.name} timed out after {self.timeout_seconds} seconds.",
                provider=self.name
            ) from exc
        except (AuthenticationError, RateLimitError, ProviderError):
            raise
        except Exception as exc:
            raise ProviderError(f"Network error contacting {self.name}: {str(exc)}", provider=self.name) from exc


class AIProviderManager:
    """
    Manages provider configuration, BYOK resolution, and tiered fallbacks.
    Tier 1: User BYOK or Configured Primary Provider (e.g. OpenAI)
    Tier 2: Alternative Configured Provider (e.g. Groq / Gemini)
    Tier 3: Local Deterministic Engine (Zero cost, pandas/scipy facts)
    """
    def __init__(self):
        self._load_environment_providers()

    def _load_environment_providers(self):
        self.providers: Dict[str, AIProvider] = {}

        # 1. OpenAI
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            self.providers["openai"] = OpenAICompatibleProvider(
                name="openai",
                api_key=openai_key,
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                default_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            )

        # 2. Groq
        groq_key = os.getenv("GROQ_API_KEY", "")
        if groq_key:
            self.providers["groq"] = OpenAICompatibleProvider(
                name="groq",
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1",
                default_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            )

        # 3. Google Gemini (via OpenAI compatibility endpoint)
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_key:
            self.providers["gemini"] = OpenAICompatibleProvider(
                name="gemini",
                api_key=gemini_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                default_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            )

    def get_provider_status(self) -> Dict[str, Any]:
        """Return provider availability flags without leaking actual secret keys."""
        return {
            "has_openai": "openai" in self.providers and self.providers["openai"].is_available(),
            "has_groq": "groq" in self.providers and self.providers["groq"].is_available(),
            "has_gemini": "gemini" in self.providers and self.providers["gemini"].is_available(),
            "active_configured_count": len(self.providers),
            "supports_byok": True,
            "fallback_available": True
        }

    def execute_with_fallback(
        self,
        prompt: str,
        system_prompt: str,
        custom_key: Optional[str] = None,
        custom_provider: str = "openai",
        max_tokens: int = 1000
    ) -> Optional[Dict[str, Any]]:
        """
        Execute completion with multi-level fallback.
        Returns response dict on remote success, or None to signal fallback to Local Deterministic Engine.
        """
        # Step 1: User BYOK execution if supplied
        if custom_key and custom_key.strip():
            logger.info("Executing AI completion with user-provided BYOK key.")
            c_name = custom_provider.lower().strip()
            base_url = "https://api.openai.com/v1"
            model = "gpt-4o-mini"
            if c_name == "groq":
                base_url = "https://api.groq.com/openai/v1"
                model = "llama-3.3-70b-versatile"
            elif c_name == "gemini":
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
                model = "gemini-1.5-flash"

            byok_provider = OpenAICompatibleProvider(
                name=f"byok_{c_name}",
                api_key=custom_key.strip(),
                base_url=base_url,
                default_model=model
            )
            try:
                return byok_provider.generate(prompt, system_prompt, max_tokens=max_tokens)
            except Exception as exc:
                logger.warning(f"User BYOK completion failed: {exc}. Falling back to system providers.")

        # Step 2: System Tier 1 & Tier 2 Providers
        ordered_providers = ["openai", "groq", "gemini"]
        for p_name in ordered_providers:
            provider = self.providers.get(p_name)
            if provider and provider.is_available():
                try:
                    logger.info(f"Invoking primary/secondary AI provider: {p_name}")
                    return provider.generate(prompt, system_prompt, max_tokens=max_tokens)
                except (AuthenticationError, RateLimitError, ProviderTimeoutError, ProviderError) as exc:
                    logger.warning(f"Provider '{p_name}' failed: {exc}. Checking next tier.")
                    continue

        # If all remote providers fail or none configured, return None to trigger Level 3
        return None


# Global singleton provider manager
provider_manager = AIProviderManager()

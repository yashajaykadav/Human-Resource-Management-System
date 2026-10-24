import os
import time
import httpx
import socket
from pathlib import Path
from typing import Optional, Dict, Any, List
import dotenv
from app.core.config import settings

class LLMClient:
    def __init__(self):
        self.provider = settings.DEFAULT_LLM_PROVIDER or "gemini"
        self.gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = settings.GEMINI_MODEL or "gemini-2.0-flash"
        self.ollama_url = settings.OLLAMA_BASE_URL or "http://ollama:11434"
        self.ollama_model = settings.OLLAMA_MODEL or "llama3.2:1b"

    def persist_config(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        gemini_model: Optional[str] = None,
        ollama_url: Optional[str] = None,
        ollama_model: Optional[str] = None
    ):
        """Update runtime state and persist to .env file."""
        if provider:
            self.provider = provider
            self._update_env("DEFAULT_LLM_PROVIDER", provider)
        if api_key is not None:
            self.gemini_key = api_key
            self._update_env("GEMINI_API_KEY", api_key)
        if gemini_model:
            self.gemini_model = gemini_model
            self._update_env("GEMINI_MODEL", gemini_model)
        if ollama_url:
            self.ollama_url = ollama_url
            self._update_env("OLLAMA_BASE_URL", ollama_url)
        if ollama_model:
            self.ollama_model = ollama_model
            self._update_env("OLLAMA_MODEL", ollama_model)

    def _update_env(self, key: str, value: str):
        os.environ[key] = value
        for candidate in [
            Path(".env"),
            Path("../.env"),
            Path(__file__).resolve().parents[3] / ".env",
            Path(__file__).resolve().parents[2] / ".env",
        ]:
            if candidate.exists():
                try:
                    dotenv.set_key(str(candidate), key, value)
                    break
                except Exception as e:
                    print(f"[LLM Factory] Could not update .env: {e}")

    async def _generate_gemini(
        self,
        system_prompt: str,
        user_message: str,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        key = api_key or self.gemini_key
        model = model_name or self.gemini_model
        if not key:
            raise ValueError("Gemini API key is not configured. Please enter your API key from Google AI Studio.")

        # 1. Try google.generativeai SDK if available
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            try:
                g_model = genai.GenerativeModel(
                    model_name=model,
                    system_instruction=system_prompt
                )
            except Exception:
                g_model = genai.GenerativeModel(model_name=model)
                user_message = f"{system_prompt}\n\nUser: {user_message}"

            import asyncio
            response = await asyncio.to_thread(g_model.generate_content, user_message)
            if response and response.text:
                return {
                    "text": response.text.strip(),
                    "provider": "gemini",
                    "model": model
                }
        except Exception as sdk_err:
            print(f"[LLM Factory] Gemini SDK call failed ({sdk_err}), trying REST API directly...")

        # 2. Direct Google Generative Language REST fallback
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_prompt}\n\n{user_message}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 2048
            }
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    text = "".join(p.get("text", "") for p in parts)
                    if text:
                        return {
                            "text": text.strip(),
                            "provider": "gemini",
                            "model": model
                        }
            else:
                error_data = resp.json().get("error", {})
                err_msg = error_data.get("message", f"HTTP {resp.status_code}: {resp.text}")
                raise RuntimeError(f"Gemini API Error: {err_msg}")

        raise RuntimeError("Gemini completed request but returned empty text candidate.")

    async def _generate_ollama(
        self,
        system_prompt: str,
        user_message: str,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        target_url = (base_url or self.ollama_url).rstrip("/")
        model = model_name or self.ollama_model

        # Candidate endpoints to handle Docker vs host network seamlessly
        candidates = [target_url]
        if "ollama:11434" in target_url:
            candidates.extend(["http://host.docker.internal:11434", "http://localhost:11434", "http://127.0.0.1:11434"])
        elif "localhost" in target_url or "127.0.0.1" in target_url:
            candidates.extend(["http://host.docker.internal:11434", "http://ollama:11434"])

        last_error = None
        for candidate in candidates:
            try:
                async with httpx.AsyncClient(timeout=35.0) as client:
                    resp = await client.post(
                        f"{candidate}/api/chat",
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_message}
                            ],
                            "stream": False
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data.get("message", {}).get("content", "")
                        if text:
                            # Save working endpoint
                            self.ollama_url = candidate
                            return {
                                "text": text.strip(),
                                "provider": "ollama",
                                "model": model
                            }
                    elif resp.status_code == 404:
                        raise RuntimeError(f"Ollama model '{model}' not found. Run 'ollama pull {model}' to install.")
                    else:
                        raise RuntimeError(f"Ollama error HTTP {resp.status_code}: {resp.text}")
            except httpx.ConnectError:
                last_error = f"Cannot connect to Ollama at {candidate}. Please ensure Ollama is running ('ollama serve')."
                continue
            except Exception as e:
                last_error = str(e)
                continue

        raise RuntimeError(last_error or f"Could not reach Ollama at {target_url}")

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Dual-Engine LLM Dispatch with Intelligent Auto-Fallback.
        """
        # 1. Primary: Gemini
        if self.provider == "gemini":
            if self.gemini_key:
                try:
                    return await self._generate_gemini(system_prompt, user_message)
                except Exception as e:
                    print(f"[LLM Factory] Gemini generation failed: {e}. Attempting Ollama fallback...")
            # Fallback to Ollama
            try:
                res = await self._generate_ollama(system_prompt, user_message)
                res["fallback_from"] = "gemini"
                return res
            except Exception as oe:
                print(f"[LLM Factory] Ollama fallback failed: {oe}. Using deterministic agent synthesis.")

        # 2. Primary: Ollama
        elif self.provider == "ollama":
            try:
                return await self._generate_ollama(system_prompt, user_message)
            except Exception as oe:
                print(f"[LLM Factory] Ollama generation failed: {oe}. Attempting Gemini fallback...")
                if self.gemini_key:
                    try:
                        res = await self._generate_gemini(system_prompt, user_message)
                        res["fallback_from"] = "ollama"
                        return res
                    except Exception as ge:
                        print(f"[LLM Factory] Gemini fallback failed: {ge}. Using deterministic agent synthesis.")

        # 3. Built-in Deterministic HRMS Agent Engine (guarantees 100% operational reliability)
        return {
            "text": None,
            "provider": "agent-engine-native",
            "model": "built-in"
        }

    async def test_connection(
        self,
        provider: str,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        ollama_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Test connection to either Gemini or Ollama and return latency & status."""
        start = time.time()
        if provider == "gemini":
            key = api_key if (api_key is not None and api_key != "") else self.gemini_key
            model = model_name or self.gemini_model
            if not key:
                return {
                    "success": False,
                    "provider": "gemini",
                    "error": "Gemini API key is required. Obtain a free key from Google AI Studio (aistudio.google.com)."
                }
            try:
                res = await self._generate_gemini(
                    system_prompt="You are an HRMS system diagnostic agent. Reply in one word: OK.",
                    user_message="Ping test.",
                    api_key=key,
                    model_name=model
                )
                latency = round((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": "gemini",
                    "model": model,
                    "latency_ms": latency,
                    "message": f"Successfully connected to Google Gemini ({model}) in {latency}ms."
                }
            except Exception as e:
                return {
                    "success": False,
                    "provider": "gemini",
                    "model": model,
                    "error": str(e)
                }

        elif provider == "ollama":
            url = (ollama_url or self.ollama_url).rstrip("/")
            model = model_name or self.ollama_model
            try:
                # First check tags to verify service is alive and list pulled models
                models = []
                async with httpx.AsyncClient(timeout=8.0) as client:
                    tag_resp = await client.get(f"{url}/api/tags")
                    if tag_resp.status_code == 200:
                        models = [m.get("name") for m in tag_resp.json().get("models", [])]

                # Run short test generation
                res = await self._generate_ollama(
                    system_prompt="You are an HRMS diagnostic agent. Reply in one word: OK.",
                    user_message="Ping test.",
                    base_url=url,
                    model_name=model
                )
                latency = round((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": "ollama",
                    "model": model,
                    "latency_ms": latency,
                    "installed_models": models,
                    "message": f"Successfully connected to Ollama ({model}) in {latency}ms. Installed models: {', '.join(models) if models else 'none detected'}."
                }
            except Exception as e:
                return {
                    "success": False,
                    "provider": "ollama",
                    "model": model,
                    "error": str(e)
                }

        return {"success": False, "error": f"Unsupported provider: {provider}"}


llm_client = LLMClient()

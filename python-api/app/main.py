from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Permite executar `python manga-translator/app/main.py` sem erro de import do pacote `app`.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.controllers.translate_controller import ocr_service, router as translate_router
from app.core.config import settings

app = FastAPI(
    title="Manga Translate API",
    description="API para detectar baloes, extrair OCR, traduzir e devolver imagem traduzida.",
    version="1.0.0",
)
_ocr_keepalive_task: asyncio.Task | None = None

if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}


app.include_router(translate_router)


async def _ocr_keepalive_loop() -> None:
    interval = max(20, int(settings.ocr_keepalive_interval_sec))
    while True:
        await asyncio.sleep(interval)
        # Mantém os modelos residentes com warmup periódico.
        await asyncio.to_thread(ocr_service.warmup, float(settings.ocr_keepalive_timeout_sec))


@app.on_event("startup")
async def _startup_ocr_warmup() -> None:
    global _ocr_keepalive_task

    if settings.ocr_warmup_on_startup:
        await asyncio.to_thread(ocr_service.warmup, float(settings.ocr_keepalive_timeout_sec))

    if settings.ocr_keepalive_enabled:
        _ocr_keepalive_task = asyncio.create_task(_ocr_keepalive_loop())


@app.on_event("shutdown")
async def _shutdown_ocr_keepalive() -> None:
    global _ocr_keepalive_task
    if _ocr_keepalive_task is not None:
        _ocr_keepalive_task.cancel()
        try:
            await _ocr_keepalive_task
        except asyncio.CancelledError:
            pass
        _ocr_keepalive_task = None


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8023"))
    reload_enabled = os.getenv("UVICORN_RELOAD", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    uvicorn.run("app.main:app", host=host, port=port, reload=reload_enabled)

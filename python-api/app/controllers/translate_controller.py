from __future__ import annotations

import time

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.schemas import ExtractTextBoxesResponse, OCRImageResponse
from app.core.security import require_api_key
from app.services.ocr_service import OCRService
from app.services.pipeline_service import pipeline

router = APIRouter(prefix="/api/v1", tags=["translate"])
ocr_service = OCRService()
OCR_IMAGE_TIMEOUT_SEC = 10.0
IMAGE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {
    "image/bmp",
    "image/gif",
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/tif",
    "image/tiff",
    "image/webp",
}


async def _read_image_upload_bytes(file: UploadFile) -> bytes:
    mime = (file.content_type or "").split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Envie um arquivo de imagem valido.",
        )

    data = await file.read(IMAGE_UPLOAD_MAX_BYTES + 1)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo de imagem vazio.",
        )
    if len(data) > IMAGE_UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Arquivo de imagem excede o limite de {IMAGE_UPLOAD_MAX_BYTES // (1024 * 1024)}MB."
            ),
        )
    return data


@router.post("/extract-text-boxes", response_model=ExtractTextBoxesResponse)
async def extract_text_boxes(
    file: UploadFile = File(..., description="Imagem para detectar caixas e extrair texto"),
    _api_key: str = Depends(require_api_key),
):
    data = await _read_image_upload_bytes(file)

    try:
        return pipeline.extract_text_boxes(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.post("/ocr-image", response_model=OCRImageResponse)
async def ocr_image(
    file: UploadFile = File(..., description="Imagem para extrair OCR"),
    _api_key: str = Depends(require_api_key),
):
    data = await _read_image_upload_bytes(file)
    t0 = time.perf_counter()

    try:
        arr = np.frombuffer(data, dtype=np.uint8)
        image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            raise ValueError("Nao foi possivel decodificar a imagem enviada.")

        extracted_text, meta = ocr_service.extract_text(
            image_bgr,
            timeout_sec=OCR_IMAGE_TIMEOUT_SEC,
        )
        return {
            "extracted_text": extracted_text,
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "timeout_sec": int(OCR_IMAGE_TIMEOUT_SEC),
            "ocr_variant_best": meta.get("ocr_variant_best", "none"),
            "ocr_error": meta.get("ocr_error", ""),
        }
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=str(e) or f"OCR excedeu o timeout de {int(OCR_IMAGE_TIMEOUT_SEC)} segundos.",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e

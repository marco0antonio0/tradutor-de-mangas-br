from __future__ import annotations

from pydantic import BaseModel, Field


class ExtractedTextBox(BaseModel):
    det_id: int
    cls_name: str
    conf: float
    box: list[int] = Field(description="[x1, y1, x2, y2]")
    ocr_text: str = ""
    ocr_error: str = ""


class ExtractTextBoxesResponse(BaseModel):
    width: int
    height: int
    detections_count: int
    elapsed_ms: int
    timings_ms: dict[str, int] | None = None
    slowest_stage: str | None = None
    detections: list[ExtractedTextBox]


class OCRImageResponse(BaseModel):
    extracted_text: str
    elapsed_ms: int
    timeout_sec: int = 10
    ocr_variant_best: str | None = None
    ocr_error: str = ""

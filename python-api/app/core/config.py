from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    project_root: Path = Path(__file__).resolve().parents[2]

    # Caminho do modelo YOLO local.
    model_path: Path = project_root / "models" / "yolo.onnx"

    target_class_name: str = "class_0"
    target_class_id: int | None = None

    conf: float = 0.60
    iou: float = 0.60
    min_box_area: int = 400
    margin: int = 8

    # OCR via PaddleOCR (ONNX local).
    hf_home: Path = project_root / "models" / ".hf-cache"
    huggingface_hub_cache: Path = project_root / "models" / ".hf-cache" / "hub"
    hf_hub_offline: bool = True
    ocr_use_local_onnx: bool = True
    ocr_det_onnx_path: Path = project_root / "models" / "paddleocr_det.onnx"
    ocr_rec_onnx_path: Path = project_root / "models" / "paddleocr_rec.onnx"
    ocr_rec_dict_path: Path = project_root / "models" / "paddleocr_dict.txt"

    ocr_timeout_sec: int = 120
    ocr_det_model: str = "en_PP-OCRv3_det"
    ocr_rec_model: str = "en_PP-OCRv4_rec"
    ocr_det_model_fallbacks: tuple[str, ...] = ()
    ocr_rec_model_fallbacks: tuple[str, ...] = ()
    ocr_variants: tuple[str, ...] = ("raw", "adaptive_inv")
    ocr_max_model_pairs: int = 1
    ocr_early_exit_score: float = 28.0
    ocr_warmup_on_startup: bool = True
    ocr_keepalive_enabled: bool = True
    ocr_keepalive_interval_sec: int = 90
    ocr_keepalive_timeout_sec: float = 8.0
    ocr_parallelism: int = 0
    ocr_heat_threshold: float = 0.28
    ocr_box_threshold: float = 0.60
    ocr_unclip_ratio: float = 2.0
    ocr_max_candidates: int = 1200

    # API key opcional.
    # Vazio => autenticação desabilitada para uso local.
    api_key: str = os.getenv("TRANSLATE_API_KEY", "").strip()

    enable_cors: bool = True


settings = Settings()

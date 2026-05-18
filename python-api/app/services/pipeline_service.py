from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
import numpy as np

from app.core.config import settings
from app.services.detection_service import DetectionService
from app.services.ocr_service import OCRService


class MangaTranslatePipeline:
    def __init__(self) -> None:
        # Instancia os serviços uma única vez para reuso no pipeline.
        self._detector = DetectionService()
        self._ocr = OCRService()

    @staticmethod
    def _decode_image(image_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            raise ValueError("Nao foi possivel decodificar a imagem enviada.")
        return image_bgr

    @staticmethod
    def _crop_with_margin(
        image_bgr: np.ndarray, x1: int, y1: int, x2: int, y2: int
    ) -> tuple[np.ndarray, tuple[int, int, int, int]]:
        h, w = image_bgr.shape[:2]
        x1m = max(0, x1 - settings.margin)
        y1m = max(0, y1 - settings.margin)
        x2m = min(w, x2 + settings.margin)
        y2m = min(h, y2 + settings.margin)
        crop = image_bgr[y1m:y2m, x1m:x2m]
        return crop, (x1m, y1m, x2m, y2m)

    @staticmethod
    def _resolve_ocr_workers(total: int) -> int:
        if total <= 1:
            return 1
        configured = max(0, int(settings.ocr_parallelism))
        if configured > 0:
            return max(1, min(total, configured))
        cpu = os.cpu_count() or 2
        auto_workers = 1 if cpu <= 2 else max(2, min(4, cpu // 2))
        return max(1, min(total, auto_workers))

    def _run_ocr_batch(self, image_bgr: np.ndarray, detections: list[dict]) -> None:
        if not detections:
            return

        def _ocr_task(idx: int, det: dict) -> tuple[int, str, dict, tuple[int, int, int, int]]:
            crop_bgr, margins = self._crop_with_margin(
                image_bgr,
                det["x1"],
                det["y1"],
                det["x2"],
                det["y2"],
            )
            text, ocr_meta = self._ocr.extract_text(crop_bgr)
            return idx, text, ocr_meta, margins

        workers = self._resolve_ocr_workers(len(detections))
        if workers <= 1:
            for i, d in enumerate(detections):
                idx, text, ocr_meta, margins = _ocr_task(i, d)
                detections[idx]["ocr_text"] = text
                detections[idx]["ocr_variant_best"] = ocr_meta.get("ocr_variant_best", "none")
                detections[idx]["ocr_error"] = ocr_meta.get("ocr_error", "")
                x1m, y1m, x2m, y2m = margins
                detections[idx]["x1m"], detections[idx]["y1m"], detections[idx]["x2m"], detections[idx]["y2m"] = (
                    x1m, y1m, x2m, y2m,
                )
            return

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = [ex.submit(_ocr_task, i, d) for i, d in enumerate(detections)]
            for fut in as_completed(futures):
                idx, text, ocr_meta, margins = fut.result()
                detections[idx]["ocr_text"] = text
                detections[idx]["ocr_variant_best"] = ocr_meta.get("ocr_variant_best", "none")
                detections[idx]["ocr_error"] = ocr_meta.get("ocr_error", "")
                x1m, y1m, x2m, y2m = margins
                detections[idx]["x1m"], detections[idx]["y1m"], detections[idx]["x2m"], detections[idx]["y2m"] = (
                    x1m, y1m, x2m, y2m,
                )

    def extract_text_boxes(self, image_bytes: bytes) -> dict:
        """Detecta boxes + OCR. Tradução é feita pelo frontend."""
        t0 = time.perf_counter()
        stage_ms: dict[str, int] = {}

        t_stage = time.perf_counter()
        try:
            image_bgr = self._decode_image(image_bytes)
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"decode: {e}") from e
        stage_ms["decode"] = int((time.perf_counter() - t_stage) * 1000)

        t_stage = time.perf_counter()
        try:
            detections = self._detector.detect(image_bgr)
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"detect: {e}") from e
        stage_ms["detect"] = int((time.perf_counter() - t_stage) * 1000)

        t_stage = time.perf_counter()
        try:
            self._run_ocr_batch(image_bgr, detections)
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"ocr: {e}") from e
        stage_ms["ocr"] = int((time.perf_counter() - t_stage) * 1000)

        h, w = image_bgr.shape[:2]
        slowest_stage = max(stage_ms, key=stage_ms.get) if stage_ms else ""
        return {
            "width": int(w),
            "height": int(h),
            "detections_count": len(detections),
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "timings_ms": stage_ms,
            "slowest_stage": slowest_stage,
            "detections": [
                {
                    "det_id": int(d["det_id"]),
                    "cls_name": str(d.get("cls_name", "class_0")),
                    "conf": float(d.get("conf", 0.0)),
                    "box": [int(d["x1"]), int(d["y1"]), int(d["x2"]), int(d["y2"])],
                    "ocr_text": d.get("ocr_text", ""),
                    "ocr_error": d.get("ocr_error", ""),
                }
                for d in detections
            ],
        }


pipeline = MangaTranslatePipeline()

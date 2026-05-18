from __future__ import annotations

from pathlib import Path
from pickle import UnpicklingError
from threading import Lock

import numpy as np
import torch
from ultralytics import YOLO

from app.core.config import settings


class DetectionService:
    def __init__(self) -> None:
        self._validate_model_path(settings.model_path)
        torch.backends.mkldnn.enabled = False

        try:
            self._model = YOLO(str(settings.model_path), task="detect")
        except (UnpicklingError, RuntimeError, ValueError) as exc:
            hint = self._build_invalid_model_hint(settings.model_path)
            raise RuntimeError(
                f"Falha ao carregar modelo YOLO em '{settings.model_path}'. {hint}"
            ) from exc
        self._lock = Lock()

    @staticmethod
    def _validate_model_path(model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"Modelo YOLO nao encontrado: {model_path}")
        if not model_path.is_file():
            raise FileNotFoundError(f"Caminho do modelo YOLO nao e arquivo: {model_path}")

        header = DetectionService._read_header(model_path)
        if header.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise RuntimeError(
                "Modelo YOLO invalido (ponteiro Git LFS detectado). "
                "Baixe o arquivo real com 'git lfs pull' e refaca o build do container."
            )

    @staticmethod
    def _read_header(model_path: Path, size: int = 64) -> bytes:
        with model_path.open("rb") as f:
            return f.read(size)

    @staticmethod
    def _build_invalid_model_hint(model_path: Path) -> str:
        header = DetectionService._read_header(model_path)
        if header.startswith(b"version https://git-lfs.github.com/spec/v1"):
            return (
                "O arquivo parece ser um ponteiro Git LFS, nao um modelo real. "
                "Execute 'git lfs pull' e reconstrua a imagem."
            )

        preview = header[:12].hex()
        return (
            "Verifique se o arquivo e um modelo YOLO Ultralytics exportado valido "
            f"(cabecalho hex: {preview})."
        )

    def _resolve_target_class_id(self, names: dict[int, str]) -> int:
        for cls_id, cls_name in names.items():
            if cls_name == settings.target_class_name:
                return int(cls_id)
        return 0

    def detect(self, image_bgr: np.ndarray, conf: float | None = None) -> list[dict]:
        conf_threshold = settings.conf if conf is None else float(conf)
        if conf_threshold < 0.0 or conf_threshold > 1.0:
            raise ValueError("conf deve estar entre 0.0 e 1.0.")

        with self._lock:
            results = self._model.predict(
                source=image_bgr,
                conf=conf_threshold,
                iou=settings.iou,
                verbose=False,
            )

        if not results:
            return []

        result = results[0]
        names = result.names or {}
        target_class_id = self._resolve_target_class_id(names)

        detections: list[dict] = []
        for box in result.boxes:
            cls_id = int(box.cls.item())
            if cls_id != target_class_id:
                continue

            conf = float(box.conf.item())
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            area = max(0, x2 - x1) * max(0, y2 - y1)
            if area < settings.min_box_area:
                continue

            detections.append(
                {
                    "det_id": len(detections),
                    "cls_id": cls_id,
                    "cls_name": names.get(cls_id, str(cls_id)),
                    "conf": conf,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "area": area,
                }
            )

        detections.sort(key=lambda d: (d["y1"], d["x1"]))
        for i, d in enumerate(detections):
            d["det_id"] = i
        return detections

    def detect_batch(self, images_bgr: list[np.ndarray], conf: float | None = None) -> list[list[dict]]:
        if not images_bgr:
            return []

        conf_threshold = settings.conf if conf is None else float(conf)
        if conf_threshold < 0.0 or conf_threshold > 1.0:
            raise ValueError("conf deve estar entre 0.0 e 1.0.")

        with self._lock:
            results = self._model.predict(
                source=images_bgr,
                conf=conf_threshold,
                iou=settings.iou,
                verbose=False,
            )

        detections_per_image: list[list[dict]] = []
        for result in results:
            names = result.names or {}
            target_class_id = self._resolve_target_class_id(names)

            detections: list[dict] = []
            for box in result.boxes:
                cls_id = int(box.cls.item())
                if cls_id != target_class_id:
                    continue

                det_conf = float(box.conf.item())
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                area = max(0, x2 - x1) * max(0, y2 - y1)
                if area < settings.min_box_area:
                    continue

                detections.append(
                    {
                        "det_id": len(detections),
                        "cls_id": cls_id,
                        "cls_name": names.get(cls_id, str(cls_id)),
                        "conf": det_conf,
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2,
                        "area": area,
                    }
                )

            detections.sort(key=lambda d: (d["y1"], d["x1"]))
            for i, d in enumerate(detections):
                d["det_id"] = i
            detections_per_image.append(detections)

        if len(detections_per_image) < len(images_bgr):
            detections_per_image.extend([[] for _ in range(len(images_bgr) - len(detections_per_image))])

        return detections_per_image[: len(images_bgr)]

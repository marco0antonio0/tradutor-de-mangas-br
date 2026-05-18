from __future__ import annotations

import os
import re
import shutil
import threading
import time
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.services.crop_preprocess_service import CropPreprocessService


class OCRService:
    def __init__(self) -> None:
        self._ocr_callable = None
        self._rec_callable = None
        self._preprocess = CropPreprocessService()
        self._last_activity = time.monotonic()
        self._activity_lock = threading.Lock()
        # Com ONNX local, nao precisa inicializar cache HF.
        if not settings.ocr_use_local_onnx:
            self._configure_hf_cache()

    @staticmethod
    def _configure_hf_cache() -> None:
        settings.hf_home.mkdir(parents=True, exist_ok=True)
        settings.huggingface_hub_cache.mkdir(parents=True, exist_ok=True)

        os.environ["HF_HOME"] = str(settings.hf_home)
        os.environ["HUGGINGFACE_HUB_CACHE"] = str(settings.huggingface_hub_cache)
        if settings.hf_hub_offline:
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
        else:
            os.environ.pop("HF_HUB_OFFLINE", None)
            os.environ.pop("TRANSFORMERS_OFFLINE", None)

    @staticmethod
    def _hf_snapshot_dir() -> str:
        refs_main = settings.huggingface_hub_cache / "models--deepghs--paddleocr" / "refs" / "main"
        if not refs_main.exists():
            return ""
        commit = refs_main.read_text(encoding="utf-8").strip()
        if not commit:
            return ""
        snapshot = settings.huggingface_hub_cache / "models--deepghs--paddleocr" / "snapshots" / commit
        if not snapshot.exists():
            return ""
        return str(snapshot)

    @staticmethod
    def _ensure_local_onnx_files() -> None:
        settings.ocr_det_onnx_path.parent.mkdir(parents=True, exist_ok=True)
        settings.ocr_rec_onnx_path.parent.mkdir(parents=True, exist_ok=True)
        settings.ocr_rec_dict_path.parent.mkdir(parents=True, exist_ok=True)

        if settings.ocr_det_onnx_path.exists() and settings.ocr_rec_onnx_path.exists() and settings.ocr_rec_dict_path.exists():
            return

        snapshot = OCRService._hf_snapshot_dir()
        if not snapshot:
            raise RuntimeError(
                "Snapshot do deepghs/paddleocr nao encontrado no cache local. "
                "Esperado em models/.hf-cache/hub/models--deepghs--paddleocr."
            )

        det_src = os.path.join(snapshot, "det", settings.ocr_det_model, "model.onnx")
        rec_src = os.path.join(snapshot, "rec", settings.ocr_rec_model, "model.onnx")
        dict_src = os.path.join(snapshot, "rec", settings.ocr_rec_model, "dict.txt")

        if not os.path.exists(det_src) or not os.path.exists(rec_src) or not os.path.exists(dict_src):
            raise RuntimeError(
                "Arquivos ONNX/dict do OCR nao encontrados no snapshot local para os modelos "
                f"{settings.ocr_det_model}/{settings.ocr_rec_model}."
            )

        if not settings.ocr_det_onnx_path.exists():
            shutil.copyfile(det_src, settings.ocr_det_onnx_path)
        if not settings.ocr_rec_onnx_path.exists():
            shutil.copyfile(rec_src, settings.ocr_rec_onnx_path)
        if not settings.ocr_rec_dict_path.exists():
            shutil.copyfile(dict_src, settings.ocr_rec_dict_path)

    @staticmethod
    def _ensure_local_ocr_cache() -> None:
        if (
            settings.ocr_use_local_onnx
            and settings.ocr_det_onnx_path.exists()
            and settings.ocr_rec_onnx_path.exists()
            and settings.ocr_rec_dict_path.exists()
        ):
            return

        model_repo = settings.huggingface_hub_cache / "models--deepghs--paddleocr"
        if model_repo.exists():
            return
        if settings.hf_hub_offline:
            raise RuntimeError(
                "Cache local do OCR nao encontrado em "
                f"'{model_repo}'. Coloque o modelo em models/.hf-cache/hub "
                "ou desative HF_HUB_OFFLINE para permitir download."
            )

    @staticmethod
    def _patch_imgutils_to_local_onnx() -> None:
        if not settings.ocr_use_local_onnx:
            return

        OCRService._ensure_local_onnx_files()

        from imgutils.ocr import detect as detect_mod
        from imgutils.ocr import recognize as rec_mod
        from imgutils.utils import open_onnx_model, ts_lru_cache

        original_det_open = detect_mod._open_ocr_detection_model
        original_rec_open = rec_mod._open_ocr_recognition_model
        original_rec_dict = rec_mod._open_ocr_recognition_dictionary

        @ts_lru_cache()
        def _open_det_local(model: str):
            if model == settings.ocr_det_model:
                return open_onnx_model(str(settings.ocr_det_onnx_path))
            return original_det_open(model)

        @ts_lru_cache()
        def _open_rec_local(model: str):
            if model == settings.ocr_rec_model:
                return open_onnx_model(str(settings.ocr_rec_onnx_path))
            return original_rec_open(model)

        @ts_lru_cache()
        def _open_dict_local(model: str):
            if model == settings.ocr_rec_model:
                with settings.ocr_rec_dict_path.open("r", encoding="utf-8") as f:
                    dict_ = [line.strip() for line in f]
                return ["<blank>", *dict_, " "]
            return original_rec_dict(model)

        detect_mod._open_ocr_detection_model = _open_det_local
        rec_mod._open_ocr_recognition_model = _open_rec_local
        rec_mod._open_ocr_recognition_dictionary = _open_dict_local

    def _touch_activity(self) -> None:
        with self._activity_lock:
            self._last_activity = time.monotonic()

    def seconds_since_last_activity(self) -> float:
        with self._activity_lock:
            return max(0.0, time.monotonic() - self._last_activity)

    @staticmethod
    def _normalize_text(text: str) -> str:
        text = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
        lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.split("\n")]
        lines = [ln for ln in lines if ln]
        return "\n".join(lines)

    @staticmethod
    def _adaptive_inv(crop_bgr: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        inv = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            12,
        )
        # Volta para texto escuro em fundo claro, que tende a ficar melhor pro OCR LLM.
        restored = cv2.bitwise_not(inv)
        return cv2.cvtColor(restored, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _clahe_bgr(crop_bgr: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
        eq = clahe.apply(gray)
        return cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _sharpen(crop_bgr: np.ndarray) -> np.ndarray:
        kernel = np.array([[0, -1, 0], [-1, 5.0, -1], [0, -1, 0]], dtype=np.float32)
        return cv2.filter2D(crop_bgr, -1, kernel)

    @staticmethod
    def _upscale_if_small(crop_bgr: np.ndarray) -> np.ndarray:
        h, w = crop_bgr.shape[:2]
        if min(h, w) >= 56:
            return crop_bgr
        return cv2.resize(crop_bgr, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    def _load_ocr_callable(self):
        if self._ocr_callable is not None:
            return self._ocr_callable
        self._ensure_local_ocr_cache()
        try:
            from imgutils.ocr import ocr as imgutils_ocr
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                "Dependencia de OCR ausente. Instale 'dghs-imgutils' para usar deepghs/paddleocr."
            ) from e
        self._patch_imgutils_to_local_onnx()
        self._ocr_callable = imgutils_ocr
        return self._ocr_callable

    def _load_recognize_callable(self):
        if self._rec_callable is not None:
            return self._rec_callable
        self._ensure_local_ocr_cache()
        try:
            from imgutils.ocr.recognize import _text_recognize as imgutils_text_recognize
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                "Dependencia de reconhecimento OCR ausente. Instale 'dghs-imgutils' para usar deepghs/paddleocr."
            ) from e
        self._patch_imgutils_to_local_onnx()
        self._rec_callable = imgutils_text_recognize
        return self._rec_callable

    @staticmethod
    def _pil_from_bgr(image_bgr: np.ndarray) -> Image.Image:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    @staticmethod
    def _box_rect(box: Any) -> tuple[float, float, float, float] | None:
        if not isinstance(box, (list, tuple)) or not box:
            return None
        if len(box) >= 4 and all(isinstance(v, (int, float)) for v in box[:4]):
            x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
            if x2 < x1:
                x1, x2 = x2, x1
            if y2 < y1:
                y1, y2 = y2, y1
            return x1, y1, x2, y2
        pts: list[tuple[float, float]] = []
        for p in box:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                try:
                    pts.append((float(p[0]), float(p[1])))
                except Exception:  # noqa: BLE001
                    continue
        if not pts:
            return None
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return min(xs), min(ys), max(xs), max(ys)

    @staticmethod
    def _assemble_lines(items: list[dict[str, float | str]]) -> str:
        if not items:
            return ""

        # agrupa por linha usando centro Y e altura média dos boxes.
        lines: list[list[dict[str, float | str]]] = []
        for it in sorted(items, key=lambda i: float(i["cy"])):
            placed = False
            h = float(it["h"])
            for ln in lines:
                avg_cy = sum(float(x["cy"]) for x in ln) / len(ln)
                avg_h = sum(float(x["h"]) for x in ln) / len(ln)
                y_tol = max(6.0, min(avg_h, h) * 0.60)
                if abs(float(it["cy"]) - avg_cy) <= y_tol:
                    ln.append(it)
                    placed = True
                    break
            if not placed:
                lines.append([it])

        lines.sort(key=lambda ln: min(float(x["y1"]) for x in ln))

        out_lines: list[str] = []
        for ln in lines:
            ln.sort(key=lambda x: float(x["x1"]))
            pieces: list[str] = []
            prev = None
            for w in ln:
                txt = str(w["text"]).strip()
                if not txt:
                    continue
                if prev is None:
                    pieces.append(txt)
                    prev = w
                    continue

                gap = float(w["x1"]) - float(prev["x2"])
                prev_len = max(1, len(str(prev["text"])))
                prev_w = max(1.0, float(prev["x2"]) - float(prev["x1"]))
                prev_char_w = max(2.0, prev_w / prev_len)

                curr_len = max(1, len(txt))
                curr_w = max(1.0, float(w["x2"]) - float(w["x1"]))
                curr_char_w = max(2.0, curr_w / curr_len)

                # Usa a menor largura média de caractere para ser mais sensível a separações.
                char_w = min(prev_char_w, curr_char_w)

                prev_txt = str(prev["text"]).strip()
                cur_starts_punct = bool(txt) and txt[0] in ",.;:!?)]}%\"'’"
                prev_ends_joiner = bool(prev_txt) and prev_txt[-1] in "([{\"'’/$"

                prev_is_word = any(ch.isalnum() for ch in prev_txt)
                cur_is_word = any(ch.isalnum() for ch in txt)

                # Regra principal:
                # - Se for pontuação de fechamento, não adiciona espaço.
                # - Para tokens alfanuméricos, aceita até sobreposição moderada e ainda insere espaço.
                should_space = False
                if not cur_starts_punct and not prev_ends_joiner:
                    if prev_is_word and cur_is_word:
                        should_space = gap >= (-0.45 * char_w)
                    else:
                        should_space = gap >= (char_w * 0.10)

                if should_space:
                    if gap <= 0:
                        spaces = 1
                    else:
                        spaces = max(1, int(round(gap / (char_w * 1.15))))
                    pieces.append((" " * min(3, spaces)) + txt)
                else:
                    pieces.append(txt)
                prev = w

            line_text = "".join(pieces).strip()
            if line_text:
                out_lines.append(line_text)

        return "\n".join(out_lines)

    @staticmethod
    def _should_try_gap_split(text: str) -> bool:
        t = (text or "").strip()
        if len(t) < 8:
            return False
        # aplica apenas em linhas/textos textuais longos (sem depender de dicionário/hardcode).
        return bool(re.fullmatch(r"[A-Za-z']{8,}", t))

    @staticmethod
    def _count_joined_word_lines(text: str) -> int:
        count = 0
        for line in (text or "").split("\n"):
            line = line.strip()
            if not line:
                continue
            if re.fullmatch(r"[A-Za-z']{8,}", line):
                count += 1
        return count

    @staticmethod
    def _find_line_segments(crop_bgr: np.ndarray) -> list[tuple[int, int]]:
        if crop_bgr is None or crop_bgr.size == 0:
            return []
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        ink = (255 - th) if float(np.mean(th)) > 127.0 else th
        row = ink.sum(axis=1).astype(np.float32)
        if row.size == 0:
            return []
        mx = float(np.max(row))
        if mx <= 0.0:
            return []

        active = row > (mx * 0.06)
        h = int(active.shape[0])
        min_h = max(8, int(round(h * 0.05)))
        segments: list[tuple[int, int]] = []

        i = 0
        while i < h:
            if not active[i]:
                i += 1
                continue
            j = i
            while j < h and active[j]:
                j += 1
            if (j - i) >= min_h:
                y1 = max(0, i - 2)
                y2 = min(h, j + 2)
                segments.append((y1, y2))
            i = j

        return segments

    @staticmethod
    def _find_word_segments_from_image(crop_bgr: np.ndarray) -> list[tuple[int, int]]:
        if crop_bgr is None or crop_bgr.size == 0:
            return []
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # normaliza para "ink" alto onde há traço de caractere.
        ink = (255 - th) if float(np.mean(th)) > 127.0 else th
        col = ink.sum(axis=0).astype(np.float32)
        if col.size == 0:
            return []
        mx = float(np.max(col))
        if mx <= 0.0:
            return []

        active = col > (mx * 0.08)
        w = int(col.shape[0])
        active_idx = np.where(active)[0]
        if active_idx.size == 0:
            return []

        # Remove margens laterais vazias do box para que o corte reflita os grupos de caracteres reais.
        left = max(0, int(active_idx[0]))
        right = min(w, int(active_idx[-1]) + 1)
        active = active[left:right]
        inner_w = int(active.shape[0])
        if inner_w <= 0:
            return []

        min_gap = max(2, int(round(inner_w * 0.025)))

        gaps: list[tuple[int, int]] = []
        i = 0
        while i < inner_w:
            if active[i]:
                i += 1
                continue
            j = i
            while j < inner_w and not active[j]:
                j += 1
            if (j - i) >= min_gap and i > 1 and j < (inner_w - 1):
                gaps.append((left + i, left + j))
            i = j

        if not gaps:
            return []

        cuts = [int((a + b) / 2) for a, b in gaps]
        bounds = [left, *cuts, right]
        segments: list[tuple[int, int]] = []
        min_seg_w = max(4, int(round((right - left) * 0.06)))
        for a, b in zip(bounds[:-1], bounds[1:], strict=False):
            if (b - a) >= min_seg_w:
                segments.append((a, b))

        if len(segments) < 2:
            return []
        if len(segments) > 4:
            return []
        return segments

    @staticmethod
    def _find_word_segments_from_components(crop_bgr: np.ndarray) -> list[tuple[int, int]]:
        if crop_bgr is None or crop_bgr.size == 0:
            return []

        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        ink = (255 - th) if float(np.mean(th)) > 127.0 else th

        # Elimina ruído fino sem unir palavras.
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats((ink > 0).astype(np.uint8), connectivity=8)
        if num_labels <= 1:
            return []

        comps: list[tuple[int, int, int, int, int]] = []
        h, w = ink.shape[:2]
        min_area = max(6, int((h * w) * 0.0003))
        for idx in range(1, num_labels):
            x = int(stats[idx, cv2.CC_STAT_LEFT])
            y = int(stats[idx, cv2.CC_STAT_TOP])
            ww = int(stats[idx, cv2.CC_STAT_WIDTH])
            hh = int(stats[idx, cv2.CC_STAT_HEIGHT])
            area = int(stats[idx, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            if hh < max(4, int(h * 0.18)):
                continue
            comps.append((x, y, x + ww, y + hh, area))

        if len(comps) < 2:
            return []

        comps.sort(key=lambda c: c[0])
        gaps: list[float] = []
        widths: list[float] = []
        for comp in comps:
            widths.append(float(comp[2] - comp[0]))
        for prev, cur in zip(comps[:-1], comps[1:], strict=False):
            gaps.append(float(cur[0] - prev[2]))

        pos_gaps = [g for g in gaps if g > 0]
        if not pos_gaps:
            return []

        median_gap = float(np.median(pos_gaps))
        median_width = float(np.median(widths)) if widths else 1.0
        word_gap_threshold = max(median_gap * 2.4, median_width * 0.55, 5.0)

        bounds: list[tuple[int, int]] = []
        seg_start = comps[0][0]
        seg_end = comps[0][2]
        for prev, cur, gap in zip(comps[:-1], comps[1:], gaps, strict=False):
            if gap >= word_gap_threshold:
                bounds.append((seg_start, seg_end))
                seg_start = cur[0]
                seg_end = cur[2]
            else:
                seg_end = max(seg_end, cur[2])
        bounds.append((seg_start, seg_end))

        min_seg_w = max(4, int(round(w * 0.06)))
        segments = [(a, b) for a, b in bounds if (b - a) >= min_seg_w]
        if len(segments) < 2 or len(segments) > 4:
            return []
        return segments

    def _recognize_word_segments(
        self,
        crop_bgr: np.ndarray,
        segments: list[tuple[int, int]],
        rec_model: str,
    ) -> tuple[str, float] | None:
        if crop_bgr is None or crop_bgr.size == 0 or len(segments) < 2:
            return None

        recognize_fn = self._load_recognize_callable()
        h, w = crop_bgr.shape[:2]
        parts: list[str] = []
        scores: list[float] = []

        for x1, x2 in segments:
            sx1 = max(0, int(x1) - 1)
            sx2 = min(w, int(x2) + 1)
            if sx2 <= sx1:
                return None
            seg_crop = crop_bgr[:, sx1:sx2]
            pil_seg = self._pil_from_bgr(seg_crop)
            try:
                txt, score = recognize_fn(
                    pil_seg,
                    model=rec_model,
                    is_remove_duplicate=True,
                )
            except Exception:  # noqa: BLE001
                return None
            txt = self._normalize_text(str(txt))
            if not txt:
                return None
            parts.append(txt.replace("\n", " "))
            scores.append(float(score))

        if not parts:
            return None
        return " ".join(parts), (sum(scores) / len(scores) if scores else 0.0)

    def _recognize_line_segments(
        self,
        crop_bgr: np.ndarray,
        rec_model: str,
    ) -> str | None:
        if crop_bgr is None or crop_bgr.size == 0:
            return None

        recognize_fn = self._load_recognize_callable()
        line_segments = self._find_line_segments(crop_bgr)
        if not line_segments:
            return None

        out_lines: list[str] = []
        h, _ = crop_bgr.shape[:2]
        for y1, y2 in line_segments:
            sy1 = max(0, y1)
            sy2 = min(h, y2)
            if sy2 <= sy1:
                continue
            line_crop = crop_bgr[sy1:sy2, :]

            word_segments = self._find_word_segments_from_components(line_crop)
            if len(word_segments) < 2:
                word_segments = self._find_word_segments_from_image(line_crop)

            line_text = ""
            if len(word_segments) >= 2:
                recognized = self._recognize_word_segments(line_crop, word_segments, rec_model=rec_model)
                if recognized is not None:
                    line_text = recognized[0]

            if not line_text:
                try:
                    txt, _ = recognize_fn(self._pil_from_bgr(line_crop), model=rec_model, is_remove_duplicate=True)
                    line_text = self._normalize_text(str(txt))
                except Exception:  # noqa: BLE001
                    line_text = ""

            if line_text:
                out_lines.append(line_text)

        if not out_lines:
            return None
        return "\n".join(out_lines)

    def _refine_joined_tokens_with_geometry(
        self,
        positioned_items: list[dict[str, float | str]],
        source_bgr: np.ndarray | None,
        rec_model: str,
    ) -> None:
        if source_bgr is None:
            return
        h, w = source_bgr.shape[:2]
        for it in positioned_items:
            text = str(it.get("text", "")).strip()

            x1 = max(0, int(round(float(it["x1"]))) - 1)
            y1 = max(0, int(round(float(it["y1"]))) - 1)
            x2 = min(w, int(round(float(it["x2"]))) + 1)
            y2 = min(h, int(round(float(it["y2"]))) + 1)
            if x2 <= x1 or y2 <= y1:
                continue

            crop = source_bgr[y1:y2, x1:x2]
            segments = self._find_word_segments_from_image(crop)
            if len(segments) < 2:
                segments = self._find_word_segments_from_components(crop)
            if len(segments) < 2:
                continue

            current_words = len([p for p in re.split(r"\s+", text) if p])
            if not self._should_try_gap_split(text) and len(segments) <= current_words:
                continue

            recognized = self._recognize_word_segments(crop, segments, rec_model=rec_model)
            if recognized is None:
                continue
            split_text, avg_score = recognized
            original_score = self._text_quality_score(text)
            refined_score = self._text_quality_score(split_text)

            # Aceita a versão segmentada quando ela preserva/eleva a qualidade e aumenta a separação lexical.
            if split_text != text and (refined_score >= original_score - 2.0 or avg_score >= 0.85):
                it["text"] = split_text

    def _parse_ocr_items(
        self,
        result: Any,
        source_bgr: np.ndarray | None = None,
        rec_model: str | None = None,
    ) -> str:
        if result is None:
            return ""

        # A API do imgutils pode retornar diferentes estruturas dependendo da versao.
        if not isinstance(result, (list, tuple)):
            return self._normalize_text(str(result))

        positioned_items: list[dict[str, float | str]] = []
        loose_texts: list[str] = []

        for it in result:
            if isinstance(it, dict):
                text = str(it.get("text") or it.get("rec_text") or it.get("label") or "").strip()
                box = it.get("box") or it.get("bbox") or it.get("points")
                rect = self._box_rect(box)
                if text:
                    if rect is None:
                        loose_texts.append(text)
                    else:
                        x1, y1, x2, y2 = rect
                        positioned_items.append(
                            {
                                "x1": x1,
                                "y1": y1,
                                "x2": x2,
                                "y2": y2,
                                "cy": (y1 + y2) / 2.0,
                                "h": max(1.0, y2 - y1),
                                "text": text,
                            }
                        )
                continue

            if isinstance(it, (list, tuple)):
                text_candidate = ""
                box_candidate = None
                for v in it:
                    if isinstance(v, str) and not text_candidate:
                        text_candidate = v.strip()
                    elif isinstance(v, (list, tuple)) and box_candidate is None:
                        box_candidate = v
                if text_candidate:
                    rect = self._box_rect(box_candidate)
                    if rect is None:
                        loose_texts.append(text_candidate)
                    else:
                        x1, y1, x2, y2 = rect
                        positioned_items.append(
                            {
                                "x1": x1,
                                "y1": y1,
                                "x2": x2,
                                "y2": y2,
                                "cy": (y1 + y2) / 2.0,
                                "h": max(1.0, y2 - y1),
                                "text": text_candidate,
                            }
                        )
                continue

            txt = str(it).strip()
            if txt:
                loose_texts.append(txt)

        if positioned_items:
            self._refine_joined_tokens_with_geometry(
                positioned_items,
                source_bgr,
                rec_model=rec_model or settings.ocr_rec_model,
            )
            assembled = self._assemble_lines(positioned_items)
            if loose_texts:
                assembled = f"{assembled}\n" if assembled else ""
                assembled += "\n".join(loose_texts)
            return self._normalize_text(assembled)

        return self._normalize_text("\n".join(loose_texts))

    @staticmethod
    def _box_center(box: Any) -> tuple[float | None, float | None]:
        if not isinstance(box, (list, tuple)) or not box:
            return None, None
        if len(box) >= 4 and all(isinstance(v, (int, float)) for v in box[:4]):
            x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
            return (x1 + x2) / 2.0, (y1 + y2) / 2.0
        pts: list[tuple[float, float]] = []
        for p in box:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                try:
                    x = float(p[0])
                    y = float(p[1])
                    pts.append((x, y))
                except Exception:  # noqa: BLE001
                    continue
        if not pts:
            return None, None
        sx = sum(x for x, _ in pts) / len(pts)
        sy = sum(y for _, y in pts) / len(pts)
        return sx, sy

    @staticmethod
    def _text_quality_score(text: str) -> float:
        txt = (text or "").strip()
        if not txt:
            return -1e9

        visible = [ch for ch in txt if not ch.isspace()]
        if not visible:
            return -1e9

        n = float(len(visible))
        printable = sum(ch.isprintable() for ch in visible) / n
        alnum = sum(ch.isalnum() for ch in visible) / n
        noise = sum(ch in "{}[]<>|\\~`_^" for ch in visible) / n
        repeats = len(re.findall(r"(.)\1{4,}", txt))
        long_token_penalty = sum(1 for tok in txt.split() if len(tok) >= 28)

        return (
            len(txt)
            + printable * 18.0
            + alnum * 10.0
            - noise * 26.0
            - (repeats * 4.5)
            - (long_token_penalty * 2.0)
        )

    @staticmethod
    def _remaining_timeout(deadline: float | None) -> float | None:
        if deadline is None:
            return None
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Tempo limite do OCR excedido.")
        return remaining

    @staticmethod
    def _is_early_exit_candidate(text: str, score: float, joined: int) -> bool:
        if not text:
            return False
        if len(text) < 8:
            return False
        if joined > 0:
            return False
        return score >= float(settings.ocr_early_exit_score)

    @staticmethod
    def _variant_images(crop_bgr: np.ndarray) -> list[tuple[str, np.ndarray]]:
        variant_builders = {
            "raw": lambda img: img,
            "upscale_x2": OCRService._upscale_if_small,
            "adaptive_inv": OCRService._adaptive_inv,
            "clahe": OCRService._clahe_bgr,
            "sharpen": OCRService._sharpen,
        }

        requested = [v.lower() for v in settings.ocr_variants if v.strip()]
        if not requested:
            requested = ["raw", "adaptive_inv"]

        variants: list[tuple[str, np.ndarray]] = []
        for name in requested:
            builder = variant_builders.get(name)
            if builder is None:
                continue
            out = builder(crop_bgr)
            if name == "upscale_x2" and out is crop_bgr:
                continue
            variants.append((name, out))

        if not variants:
            variants.append(("raw", crop_bgr))
        return variants

    @staticmethod
    def _model_pairs() -> list[tuple[str, str]]:
        det_models = [settings.ocr_det_model, *settings.ocr_det_model_fallbacks]
        rec_models = [settings.ocr_rec_model, *settings.ocr_rec_model_fallbacks]

        candidates: list[tuple[str, str]] = []
        candidates.append((det_models[0], rec_models[0]))

        for rec in rec_models[1:]:
            candidates.append((det_models[0], rec))
        for det in det_models[1:]:
            candidates.append((det, rec_models[0]))
        for det in det_models[1:]:
            for rec in rec_models[1:]:
                candidates.append((det, rec))

        seen: set[tuple[str, str]] = set()
        ordered: list[tuple[str, str]] = []
        for pair in candidates:
            if pair in seen:
                continue
            seen.add(pair)
            ordered.append(pair)

        limit = max(1, int(settings.ocr_max_model_pairs))
        return ordered[:limit]

    def _call_paddleocr(
        self,
        image_bgr: np.ndarray,
        det_model: str,
        rec_model: str,
        timeout_sec: float | None = None,
    ) -> str:
        if timeout_sec is not None and timeout_sec <= 0:
            raise TimeoutError("Tempo limite do OCR excedido antes de processar a imagem.")

        ocr_fn = self._load_ocr_callable()
        pil_image = self._pil_from_bgr(image_bgr)
        started = time.monotonic()
        result = ocr_fn(
            pil_image,
            detect_model=det_model,
            recognize_model=rec_model,
            heat_threshold=float(settings.ocr_heat_threshold),
            box_threshold=float(settings.ocr_box_threshold),
            max_candidates=int(settings.ocr_max_candidates),
            unclip_ratio=float(settings.ocr_unclip_ratio),
            is_remove_duplicate=True,
        )

        if timeout_sec is not None and (time.monotonic() - started) > timeout_sec:
            raise TimeoutError("Tempo limite do OCR excedido.")

        parsed = self._parse_ocr_items(result, source_bgr=image_bgr, rec_model=rec_model)
        if self._count_joined_word_lines(parsed) > 0:
            segmented = self._recognize_line_segments(image_bgr, rec_model=rec_model)
            if segmented:
                parsed_joined = self._count_joined_word_lines(parsed)
                segmented_joined = self._count_joined_word_lines(segmented)
                if segmented_joined < parsed_joined or self._text_quality_score(segmented) >= self._text_quality_score(parsed):
                    parsed = self._normalize_text(segmented)
        return parsed

    def extract_text(self, crop_bgr: np.ndarray, timeout_sec: float | None = None) -> tuple[str, dict]:
        self._touch_activity()
        errors: list[str] = []
        if timeout_sec is None:
            timeout_sec = float(settings.ocr_timeout_sec)
        deadline = (time.monotonic() + float(timeout_sec)) if timeout_sec is not None else None

        best_text = ""
        best_score = -1e9
        best_joined = 10**9
        best_variant = "none"
        best_model = "none"
        best_variant_bgr: np.ndarray | None = None
        best_rec_model = settings.ocr_rec_model

        def _evaluate_variant(variant_name: str, variant_bgr: np.ndarray) -> bool:
            nonlocal best_text, best_score, best_joined, best_variant, best_model, best_variant_bgr, best_rec_model
            for det_model, rec_model in self._model_pairs():
                model_id = f"{det_model}/{rec_model}"
                try:
                    text = self._call_paddleocr(
                        variant_bgr,
                        det_model=det_model,
                        rec_model=rec_model,
                        timeout_sec=self._remaining_timeout(deadline),
                    )
                except TimeoutError:
                    if best_text:
                        errors.append("timeout: usando melhor resultado parcial")
                        return True
                    raise TimeoutError("Tempo limite do OCR excedido.")
                except Exception as e:  # noqa: BLE001
                    errors.append(f"{variant_name}@{model_id}: {e}")
                    continue

                score = self._text_quality_score(text)
                joined = self._count_joined_word_lines(text)
                if joined < best_joined or (joined == best_joined and score > best_score):
                    best_joined = joined
                    best_score = score
                    best_text = text
                    best_variant = variant_name
                    best_model = model_id
                    best_variant_bgr = variant_bgr
                    best_rec_model = rec_model
                    if self._is_early_exit_candidate(best_text, best_score, best_joined):
                        return True
            return False

        # Caminho rápido: tenta só o crop original antes de qualquer preprocess pesado.
        if _evaluate_variant("orig_raw", crop_bgr):
            pass
        else:
            normalized_crop = crop_bgr
            try:
                normalized_crop = self._preprocess.normalize(crop_bgr)
            except Exception as e:  # noqa: BLE001
                errors.append(f"preprocess: {e}")

            for variant_name, variant_bgr in self._variant_images(normalized_crop):
                if variant_name == "raw":
                    continue
                if _evaluate_variant(f"norm_{variant_name}", variant_bgr):
                    break
                if best_text and deadline is not None:
                    remaining = deadline - time.monotonic()
                    if remaining < 0.20:
                        break

        if best_text and best_variant_bgr is not None and self._count_joined_word_lines(best_text) > 0:
            try:
                segmented = self._recognize_line_segments(best_variant_bgr, rec_model=best_rec_model)
            except Exception as e:  # noqa: BLE001
                errors.append(f"line_segment_post: {e}")
                segmented = None
            if segmented:
                current_best_joined = self._count_joined_word_lines(best_text)
                seg_joined = self._count_joined_word_lines(segmented)
                if seg_joined < current_best_joined or self._text_quality_score(segmented) >= (best_score - 1.0):
                    best_text = self._normalize_text(segmented)
                    best_score = self._text_quality_score(best_text)
                    best_joined = self._count_joined_word_lines(best_text)
                    best_variant = f"{best_variant}+line_segments"

        meta = {
            "ocr_variant_best": f"{best_variant}@{best_model}" if best_text else "none",
            "ocr_error": " | ".join(errors),
        }
        self._touch_activity()
        return best_text, meta

    def warmup(self, timeout_sec: float | None = None) -> tuple[bool, str]:
        self._touch_activity()
        if timeout_sec is None:
            timeout_sec = float(settings.ocr_keepalive_timeout_sec)
        try:
            dummy = np.full((48, 192, 3), 255, dtype=np.uint8)
            cv2.putText(dummy, "warmup text", (8, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 1, cv2.LINE_AA)
            _ = self._call_paddleocr(
                dummy,
                det_model=settings.ocr_det_model,
                rec_model=settings.ocr_rec_model,
                timeout_sec=float(timeout_sec),
            )
            self._touch_activity()
            return True, ""
        except Exception as e:  # noqa: BLE001
            return False, str(e)

from __future__ import annotations

import cv2
import numpy as np


class CropPreprocessService:
    @staticmethod
    def _as_bgr_uint8(image_bgr: np.ndarray) -> np.ndarray:
        if image_bgr is None or image_bgr.size == 0:
            raise ValueError("Crop de OCR vazio.")

        if image_bgr.dtype != np.uint8:
            img = np.clip(image_bgr, 0, 255).astype(np.uint8)
        else:
            img = image_bgr

        if img.ndim == 2:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if img.ndim == 3 and img.shape[2] == 3:
            return img
        raise ValueError("Formato de imagem de OCR invalido.")

    @staticmethod
    def _gray_world_white_balance(image_bgr: np.ndarray) -> np.ndarray:
        b, g, r = cv2.split(image_bgr)
        b_mean, g_mean, r_mean = float(np.mean(b)), float(np.mean(g)), float(np.mean(r))
        gray = (b_mean + g_mean + r_mean) / 3.0

        eps = 1e-6
        kb = gray / (b_mean + eps)
        kg = gray / (g_mean + eps)
        kr = gray / (r_mean + eps)

        b = np.clip(b.astype(np.float32) * kb, 0, 255).astype(np.uint8)
        g = np.clip(g.astype(np.float32) * kg, 0, 255).astype(np.uint8)
        r = np.clip(r.astype(np.float32) * kr, 0, 255).astype(np.uint8)
        return cv2.merge((b, g, r))

    @staticmethod
    def _normalize_luminance(image_bgr: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)

    @staticmethod
    def _auto_gamma_luminance(gray: np.ndarray, target_mean: float = 145.0) -> np.ndarray:
        m = float(np.mean(gray))
        if m < 1.0 or m > 254.0:
            return gray
        norm_m = m / 255.0
        norm_target = target_mean / 255.0
        gamma = np.log(norm_target) / np.log(norm_m)
        gamma = float(np.clip(gamma, 0.6, 1.8))
        lut = np.array([((i / 255.0) ** gamma) * 255.0 for i in range(256)], dtype=np.uint8)
        return cv2.LUT(gray, lut)

    @staticmethod
    def _odd(v: int) -> int:
        return v if v % 2 == 1 else v + 1

    @staticmethod
    def _multi_direction_tophat_blackhat(gray: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        h, w = gray.shape[:2]
        base = max(9, int(min(h, w) * 0.12))
        long_k = CropPreprocessService._odd(max(9, base))
        short_k = 3

        kernels = [
            cv2.getStructuringElement(cv2.MORPH_RECT, (long_k, short_k)),
            cv2.getStructuringElement(cv2.MORPH_RECT, (short_k, long_k)),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CropPreprocessService._odd(base), CropPreprocessService._odd(base))),
        ]

        top_hat = np.zeros_like(gray)
        black_hat = np.zeros_like(gray)

        for k in kernels:
            th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k)
            bh = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k)
            top_hat = cv2.max(top_hat, th)
            black_hat = cv2.max(black_hat, bh)

        return top_hat, black_hat

    @staticmethod
    def _illumination_normalize(gray: np.ndarray) -> tuple[np.ndarray, bool]:
        top_hat, black_hat = CropPreprocessService._multi_direction_tophat_blackhat(gray)
        enhanced = cv2.add(gray, top_hat)
        enhanced = cv2.subtract(enhanced, black_hat)

        # heuristica de polaridade:
        # - top_hat alto: tendência de texto claro em fundo escuro
        # - black_hat alto: tendência de texto escuro em fundo claro
        top_score = float(np.mean(top_hat))
        black_score = float(np.mean(black_hat))
        invert = top_score > (black_score * 1.08)

        if invert:
            enhanced = cv2.bitwise_not(enhanced)

        return enhanced, invert

    @staticmethod
    def _shade_correction_divide(gray: np.ndarray) -> np.ndarray:
        h, w = gray.shape[:2]
        k = CropPreprocessService._odd(max(21, int(min(h, w) * 0.45)))
        bg = cv2.GaussianBlur(gray, (k, k), 0)
        corrected = cv2.divide(gray, bg, scale=255)
        return corrected

    @staticmethod
    def _contrast_stretch(gray: np.ndarray, low_q: float = 1.0, high_q: float = 99.0) -> np.ndarray:
        lo = float(np.percentile(gray, low_q))
        hi = float(np.percentile(gray, high_q))
        if hi - lo < 6.0:
            return gray
        out = ((gray.astype(np.float32) - lo) * (255.0 / (hi - lo))).clip(0, 255).astype(np.uint8)
        return out

    @staticmethod
    def _hybrid_adaptive_enhance(gray: np.ndarray) -> np.ndarray:
        block = 35 if min(gray.shape[:2]) >= 80 else 25
        if block % 2 == 0:
            block += 1
        bin_img = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block,
            11,
        )
        # Blending leve mantém textura útil para OCR sem "estourar" como binarização pura.
        return cv2.addWeighted(gray, 0.72, bin_img, 0.28, 0)

    @staticmethod
    def _channel_stroke_score(gray: np.ndarray) -> float:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k)
        bh = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k)
        lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        edge_energy = float(np.mean(np.abs(lap)))
        return float(np.mean(th) + np.mean(bh) + (0.25 * edge_energy))

    @staticmethod
    def _best_contrast_gray(image_bgr: np.ndarray) -> np.ndarray:
        b, g, r = cv2.split(image_bgr)
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
        l, _, _ = cv2.split(lab)

        candidates = [("b", b), ("g", g), ("r", r), ("l", l)]
        best_name, best = candidates[0]
        best_score = CropPreprocessService._channel_stroke_score(candidates[0][1])
        for name, ch in candidates[1:]:
            sc = CropPreprocessService._channel_stroke_score(ch)
            if sc > best_score:
                best_name = name
                best = ch
                best_score = sc
        _ = best_name
        return best

    @staticmethod
    def _light_denoise_and_sharpen(image_bgr: np.ndarray) -> np.ndarray:
        # Remove ruído fino sem borrar muito o traço/letra.
        den = cv2.bilateralFilter(image_bgr, d=3, sigmaColor=20, sigmaSpace=20)

        # Unsharp mask conservador para evitar halo em caracteres.
        blur = cv2.GaussianBlur(den, (0, 0), 1.0)
        sharp = cv2.addWeighted(den, 1.10, blur, -0.10, 0)
        return sharp

    @staticmethod
    def _pick_best_gray(candidates: list[np.ndarray]) -> np.ndarray:
        if not candidates:
            raise ValueError("Sem candidatos de preprocessamento.")
        best = candidates[0]
        best_score = CropPreprocessService._channel_stroke_score(best)
        for c in candidates[1:]:
            s = CropPreprocessService._channel_stroke_score(c)
            if s > best_score:
                best = c
                best_score = s
        return best

    def normalize(self, crop_bgr: np.ndarray) -> np.ndarray:
        img = self._as_bgr_uint8(crop_bgr)
        img = self._gray_world_white_balance(img)
        img = self._normalize_luminance(img)

        gray = self._best_contrast_gray(img)
        gray = self._auto_gamma_luminance(gray, target_mean=138.0)
        norm, _ = self._illumination_normalize(gray)

        # Mistura parcial para reduzir distorção causada por operações morfológicas agressivas.
        gray = cv2.addWeighted(gray, 0.70, norm, 0.30, 0)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        gray = self._contrast_stretch(gray, low_q=2.0, high_q=98.0)

        out = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        out = self._light_denoise_and_sharpen(out)
        return out

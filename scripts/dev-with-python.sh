#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_DIR="$ROOT_DIR/python-api"
PY_VENV="$PY_DIR/.venv"
PY_BIN="$PY_VENV/bin/python"
PIP_BIN="$PY_VENV/bin/pip"
REQ_FILE="$PY_DIR/requirements.txt"
REQ_STAMP="$PY_VENV/.requirements.sha256"

if [ ! -d "$PY_DIR" ]; then
  echo "[dev] pasta python-api nao encontrada em $PY_DIR"
  exit 1
fi

if [ ! -x "$PY_BIN" ]; then
  echo "[dev] criando ambiente virtual python em $PY_VENV"
  python3 -m venv "$PY_VENV"
fi

REQ_HASH="$(sha256sum "$REQ_FILE" | awk '{print $1}')"
STAMP_HASH=""
if [ -f "$REQ_STAMP" ]; then
  STAMP_HASH="$(cat "$REQ_STAMP" || true)"
fi

NEEDS_INSTALL=0
if [ ! -f "$REQ_STAMP" ]; then
  NEEDS_INSTALL=1
elif [ "$REQ_HASH" != "$STAMP_HASH" ]; then
  NEEDS_INSTALL=1
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  echo "[dev] instalando dependencias Python (CPU-only, primeira vez ou requirements alterado)"
  "$PIP_BIN" install --upgrade pip
  "$PIP_BIN" install -r "$REQ_FILE"

  mapfile -t NVIDIA_PKGS < <("$PIP_BIN" freeze | awk -F'==' '/^nvidia-/{print $1}')
  if [ "${#NVIDIA_PKGS[@]}" -gt 0 ]; then
    echo "[dev] removendo pacotes NVIDIA da venv (CPU-only): ${NVIDIA_PKGS[*]}"
    "$PIP_BIN" uninstall -y "${NVIDIA_PKGS[@]}" >/dev/null || true
  fi

  echo "$REQ_HASH" > "$REQ_STAMP"
else
  echo "[dev] dependencias Python ja prontas; pulando pip install"
fi

export TRANSLATE_API_KEY="${TRANSLATE_API_KEY:-example-translate-api-key}"
export YOLO_MODEL_PATH="${YOLO_MODEL_PATH:-$PY_DIR/models/yolo.onnx}"
export OCR_DET_ONNX_PATH="${OCR_DET_ONNX_PATH:-$PY_DIR/models/paddleocr_det.onnx}"
export OCR_REC_ONNX_PATH="${OCR_REC_ONNX_PATH:-$PY_DIR/models/paddleocr_rec.onnx}"
export OCR_REC_DICT_PATH="${OCR_REC_DICT_PATH:-$PY_DIR/models/paddleocr_dict.txt}"
export HF_HOME="${HF_HOME:-$PY_DIR/models/.hf-cache}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-$PY_DIR/models/.hf-cache/hub}"
export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-1}"
export OCR_USE_LOCAL_ONNX="${OCR_USE_LOCAL_ONNX:-true}"

cleanup() {
  if [ -n "${PY_PID:-}" ] && kill -0 "$PY_PID" >/dev/null 2>&1; then
    kill "$PY_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "[dev] iniciando API Python em http://localhost:8023"
(
  cd "$PY_DIR"
  exec "$PY_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8023 --reload
) &
PY_PID=$!

echo "[dev] iniciando Next.js"
cd "$ROOT_DIR"
exec next dev -p 3080

"""
Dataset Loader Engine for OpenDataLens
Supports Hugging Face Hub discovery, Hugging Face Dataset Viewer API loading,
robust CSV uploads, and offline curated machine learning benchmarks.
"""

import io
import csv
import logging
from typing import Dict, Any, List, Tuple, Optional
import requests
import pandas as pd
import numpy as np

from sklearn.datasets import (
    load_iris,
    load_wine,
    fetch_california_housing,
    load_breast_cancer,
    load_diabetes
)

from core.config import (
    HF_API_BASE_URL,
    HF_DATASET_VIEWER_BASE_URL,
    CURATED_DATASETS
)

logger = logging.getLogger(__name__)


def get_sample_datasets_list() -> List[Dict[str, Any]]:
    """Return the list of pre-configured curated benchmark datasets."""
    return CURATED_DATASETS


def load_curated_dataset(dataset_id: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Load an offline-ready curated benchmark dataset from scikit-learn or embedded data.
    """
    # Support canonical IDs and backward-compatible aliases
    dataset_aliases = {
        "wine_quality": "wine_recognition",
        "titanic": "titanic_synthetic",
        "titanic_sample": "titanic_synthetic",
    }
    canonical_id = dataset_aliases.get(dataset_id, dataset_id)

    meta = next((item for item in CURATED_DATASETS if item["id"] == canonical_id), None)
    if not meta:
        raise ValueError(f"Unknown curated dataset ID: '{dataset_id}'. Choose from: {[d['id'] for d in CURATED_DATASETS]}")

    if canonical_id == "iris":
        raw = load_iris(as_frame=True)
        df = raw.frame.copy()
        if "target" not in df.columns:
            df["target"] = raw.target
    elif canonical_id == "wine_recognition":
        raw = load_wine(as_frame=True)
        df = raw.frame.copy()
        if "target" not in df.columns:
            df["target"] = raw.target
    elif canonical_id == "california_housing":
        raw = fetch_california_housing(as_frame=True)
        df = raw.frame.copy()
    elif canonical_id == "breast_cancer":
        raw = load_breast_cancer(as_frame=True)
        df = raw.frame.copy()
    elif canonical_id == "diabetes":
        raw = load_diabetes(as_frame=True)
        df = raw.frame.copy()
    elif canonical_id == "titanic_synthetic":
        # Generate realistic Titanic benchmark structure
        np.random.seed(42)
        n = 891
        pclasses = np.random.choice([1, 2, 3], size=n, p=[0.24, 0.21, 0.55])
        sexes = np.random.choice(["male", "female"], size=n, p=[0.64, 0.36])
        ages = np.random.normal(loc=29.7, scale=14.5, size=n)
        ages = np.where(np.random.rand(n) < 0.20, np.nan, np.clip(ages, 0.5, 80))
        sibsp = np.random.choice([0, 1, 2, 3], size=n, p=[0.68, 0.23, 0.06, 0.03])
        parch = np.random.choice([0, 1, 2], size=n, p=[0.76, 0.13, 0.11])
        fares = np.where(pclasses == 1, np.random.exponential(60, n) + 20,
                np.where(pclasses == 2, np.random.exponential(20, n) + 10,
                         np.random.exponential(10, n) + 5))
        embarked = np.random.choice(["S", "C", "Q", None], size=n, p=[0.72, 0.19, 0.08, 0.01])
        
        # Realistic survival probability based on demographics
        prob_surv = 0.38 + (sexes == "female") * 0.35 - (pclasses == 3) * 0.25 - (fares < 10) * 0.1
        prob_surv = np.clip(prob_surv, 0.05, 0.95)
        survived = (np.random.rand(n) < prob_surv).astype(int)

        df = pd.DataFrame({
            "PassengerId": np.arange(1, n + 1),
            "Survived": survived,
            "Pclass": pclasses,
            "Sex": sexes,
            "Age": np.round(ages, 1),
            "SibSp": sibsp,
            "Parch": parch,
            "Fare": np.round(fares, 2),
            "Embarked": embarked
        })
    else:
        raise ValueError(f"Curated dataset loader not implemented for: {canonical_id}")

    dataset_info = {
        "id": meta["id"],
        "name": meta["name"],
        "description": meta["description"],
        "task": meta["task"],
        "suggested_target": meta.get("target"),
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "source": "curated"
    }
    return df, dataset_info


def load_csv_dataset(
    file_or_path,
    filename: str = "upload.csv",
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Safely load a CSV dataset from a file path, file-like object, or bytes buffer.
    Detects delimiter, handles common encodings, and strips column names.
    """
    encodings_to_try = ["utf-8", "latin1", "iso-8859-1", "cp1252"]
    delimiters_to_try = [",", ";", "\t", "|"]

    # Read bytes or string content
    if isinstance(file_or_path, bytes):
        content = file_or_path
    elif hasattr(file_or_path, "read"):
        content = file_or_path.read()
    else:
        with open(file_or_path, "rb") as f:
            content = f.read()

    if isinstance(content, str):
        content_bytes = content.encode("utf-8")
    else:
        content_bytes = content

    if len(content_bytes.strip()) == 0:
        raise ValueError("The provided CSV file is completely empty.")

    # Try decoding
    text_content = None
    used_encoding = None
    for enc in encodings_to_try:
        try:
            text_content = content_bytes.decode(enc)
            used_encoding = enc
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if text_content is None:
        text_content = content_bytes.decode("utf-8", errors="replace")
        used_encoding = "utf-8-replaced"

    # Sniff delimiter
    sample = text_content[:4096]
    detected_sep = ","
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample, delimiters=";,|\t,")
        detected_sep = dialect.delimiter
    except Exception:
        # Fallback heuristic: count delimiter occurrences in first non-empty lines
        first_line = sample.splitlines()[0] if sample.splitlines() else ""
        counts = {d: first_line.count(d) for d in delimiters_to_try}
        detected_sep = max(counts, key=counts.get) if max(counts.values()) > 0 else ","

    try:
        df = pd.read_csv(
            io.StringIO(text_content),
            sep=detected_sep,
            nrows=max_rows,
            on_bad_lines="skip"
        )
    except Exception as e:
        raise ValueError(f"Failed to parse CSV file: {str(e)}")

    if df.empty:
        raise ValueError("Parsed dataset has 0 rows.")

    # Clean whitespace in column names
    df.columns = [str(col).strip() for col in df.columns]

    metadata = {
        "id": filename.replace(".csv", "").lower(),
        "name": filename,
        "filename": filename,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "delimiter": detected_sep,
        "encoding": used_encoding,
        "source": "csv"
    }

    return df, metadata


def search_hf_datasets(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search public datasets on Hugging Face using the HF API.
    Returns cleaned list of dataset cards with metadata.
    """
    if not query.strip():
        # Default query for popular tabular datasets
        query = "tabular"

    url = f"{HF_API_BASE_URL}?search={requests.utils.quote(query)}&full=true&limit={limit}"
    results = []

    try:
        response = requests.get(url, timeout=6)
        if response.status_code == 200:
            data = response.json()
            for item in data:
                ds_id = item.get("id", "")
                results.append({
                    "id": ds_id,
                    "name": ds_id.split("/")[-1] if "/" in ds_id else ds_id,
                    "author": item.get("author", ds_id.split("/")[0] if "/" in ds_id else "community"),
                    "description": item.get("description", "No description provided.") or "No description provided.",
                    "downloads": item.get("downloads", 0),
                    "likes": item.get("likes", 0),
                    "tags": item.get("tags", [])[:6],
                    "private": item.get("private", False)
                })
    except Exception as exc:
        logger.warning(f"Could not query Hugging Face API: {exc}")
        # Return fallback popular datasets matching query keyword
        results = [
            {
                "id": f"hf-internal/{d['id']}",
                "name": d["name"],
                "author": "huggingface",
                "description": d["description"],
                "downloads": 5420,
                "likes": 128,
                "tags": ["tabular", d["task"]],
                "private": False
            }
            for d in CURATED_DATASETS if query.lower() in d["name"].lower() or query.lower() in d["task"].lower()
        ]

    return results


def load_hf_dataset_via_api(
    dataset_name: str,
    split: str = "train",
    max_rows: int = 2000
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Load rows from Hugging Face using the Dataset Viewer API.
    API: https://datasets-server.huggingface.co/rows?dataset=...&config=...&split=...
    """
    # 1. Fetch splits first
    splits_url = f"{HF_DATASET_VIEWER_BASE_URL}/splits?dataset={requests.utils.quote(dataset_name)}"
    config = "default"
    chosen_split = split

    try:
        s_resp = requests.get(splits_url, timeout=6)
        if s_resp.status_code == 200:
            s_data = s_resp.json()
            splits_list = s_data.get("splits", [])
            if splits_list:
                config = splits_list[0].get("config", "default")
                available_splits = [item.get("split") for item in splits_list]
                if split not in available_splits:
                    chosen_split = available_splits[0]
    except Exception:
        pass

    # 2. Fetch rows
    rows_url = f"{HF_DATASET_VIEWER_BASE_URL}/rows?dataset={requests.utils.quote(dataset_name)}&config={config}&split={chosen_split}&offset=0&length={min(max_rows, 100)}"
    resp = requests.get(rows_url, timeout=10)

    if resp.status_code != 200:
        # Try /first-rows endpoint
        first_rows_url = f"{HF_DATASET_VIEWER_BASE_URL}/first-rows?dataset={requests.utils.quote(dataset_name)}&config={config}&split={chosen_split}"
        resp = requests.get(first_rows_url, timeout=8)

    if resp.status_code != 200:
        raise ValueError(
            f"Hugging Face Dataset Viewer returned error status {resp.status_code}. "
            f"The dataset '{dataset_name}' may be gated, large-scale, or lacks a viewer configuration. "
            f"Details: {resp.text[:200]}"
        )

    json_data = resp.json()
    rows = json_data.get("rows", [])
    if not rows:
        raise ValueError(f"No records returned for Hugging Face dataset '{dataset_name}'.")

    # Extract row dictionaries
    extracted_records = [r.get("row", r) for r in rows]
    df = pd.DataFrame(extracted_records)

    metadata = {
        "id": dataset_name,
        "name": dataset_name.split("/")[-1] if "/" in dataset_name else dataset_name,
        "config": config,
        "split": chosen_split,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "source": "huggingface_hub"
    }

    return df, metadata

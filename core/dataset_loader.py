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


def load_excel_dataset(
    file_or_path,
    filename: str = "upload.xlsx",
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Safely load an Excel workbook (.xlsx / .xls) into a pandas DataFrame.
    Prevents macro/VBA execution using openpyxl data_only mode.
    Automatically detects the first non-empty worksheet and handles headers.
    """
    if isinstance(file_or_path, bytes):
        content = file_or_path
    elif hasattr(file_or_path, "read"):
        content = file_or_path.read()
        if isinstance(content, str):
            content = content.encode("utf-8")
    else:
        with open(file_or_path, "rb") as f:
            content = f.read()

    if len(content.strip()) == 0:
        raise ValueError("The provided Excel file is completely empty.")

    bio = io.BytesIO(content)

    try:
        excel_file = pd.ExcelFile(bio, engine="openpyxl")
        sheet_names = excel_file.sheet_names
        if not sheet_names:
            raise ValueError("Excel file contains no worksheets.")

        chosen_sheet = None
        df = pd.DataFrame()
        # Scan for first non-empty sheet
        for sheet in sheet_names:
            sample_df = pd.read_excel(excel_file, sheet_name=sheet, nrows=5)
            if not sample_df.empty and sample_df.shape[1] > 0:
                chosen_sheet = sheet
                df = pd.read_excel(excel_file, sheet_name=sheet, nrows=max_rows)
                break

        if chosen_sheet is None:
            chosen_sheet = sheet_names[0]
            df = pd.read_excel(excel_file, sheet_name=chosen_sheet, nrows=max_rows)

    except Exception as e:
        raise ValueError(f"Failed to parse Excel file '{filename}': {str(e)}")

    if df.empty:
        raise ValueError(f"Excel file '{filename}' contains 0 records or all sheets are empty.")

    df.columns = [str(col).strip() for col in df.columns]
    df = df.dropna(how="all").dropna(axis=1, how="all")
    if df.empty:
        raise ValueError(f"Excel file '{filename}' contains only empty/blank cells.")

    metadata = {
        "id": filename.rsplit(".", 1)[0].lower(),
        "name": filename,
        "filename": filename,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "sheet_name": chosen_sheet,
        "available_sheets": sheet_names,
        "source": "excel"
    }
    return df, metadata


def load_json_dataset(
    file_or_path,
    filename: str = "upload.json",
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Load JSON / JSON-Lines tabular data.
    Supports records arrays `[{...}, ...]`, split format `{"columns": [...], "data": [...]}`,
    tabular wrappers `{"data": [...]}`, column-oriented dicts `{"col": [...]}`, or JSON Lines.
    """
    import json
    if isinstance(file_or_path, bytes):
        raw_text = file_or_path.decode("utf-8", errors="replace")
    elif hasattr(file_or_path, "read"):
        raw_bytes = file_or_path.read()
        raw_text = raw_bytes.decode("utf-8", errors="replace") if isinstance(raw_bytes, bytes) else str(raw_bytes)
    else:
        with open(file_or_path, "r", encoding="utf-8", errors="replace") as f:
            raw_text = f.read()

    if not raw_text.strip():
        raise ValueError("The provided JSON file is empty.")

    parsed = None
    parse_mode = "json"
    try:
        parsed = json.loads(raw_text)
    except Exception as e:
        # Check if it's JSON Lines (jsonl)
        try:
            lines = [json.loads(line) for line in raw_text.strip().splitlines() if line.strip()]
            if lines:
                parsed = lines
                parse_mode = "jsonl"
        except Exception:
            raise ValueError(f"Failed to parse JSON file: {str(e)}")

    if parsed is None or (isinstance(parsed, (list, dict)) and len(parsed) == 0):
        raise ValueError("JSON file contains an empty root object or empty array.")

    df = None
    if isinstance(parsed, list):
        if len(parsed) == 0:
            raise ValueError("JSON file contains an empty array.")
        if isinstance(parsed[0], dict):
            df = pd.DataFrame(parsed[:max_rows] if max_rows else parsed)
        elif isinstance(parsed[0], list):
            df = pd.DataFrame(parsed[:max_rows] if max_rows else parsed)
        else:
            df = pd.DataFrame({"value": parsed[:max_rows] if max_rows else parsed})

    elif isinstance(parsed, dict):
        # 1. Standard Split Format: {"columns": [...], "data": [[...], ...]}
        if "columns" in parsed and "data" in parsed and isinstance(parsed["data"], list):
            cols = parsed["columns"]
            data = parsed["data"][:max_rows] if max_rows else parsed["data"]
            index = parsed.get("index")
            df = pd.DataFrame(data=data, columns=cols, index=index[:len(data)] if index else None)

        # 2. Tabular wrapper keys: {"data": [...]}, {"records": [...]}, etc.
        if df is None:
            for key in ["data", "rows", "records", "items", "dataset", "results"]:
                if key in parsed and isinstance(parsed[key], list) and len(parsed[key]) > 0:
                    val = parsed[key][:max_rows] if max_rows else parsed[key]
                    if isinstance(val[0], dict):
                        df = pd.DataFrame(val)
                    elif isinstance(val[0], list):
                        df = pd.DataFrame(val)
                    break

        # 3. Column-oriented dict: {"col1": [1, 2], "col2": [3, 4]}
        if df is None:
            if all(isinstance(v, list) for v in parsed.values()) and len(parsed) > 0:
                try:
                    df = pd.DataFrame(parsed)
                    if max_rows:
                        df = df.head(max_rows)
                except Exception:
                    df = None

        # 4. Fallback from_dict or single record
        if df is None:
            try:
                df = pd.DataFrame.from_dict(parsed)
                if max_rows:
                    df = df.head(max_rows)
            except Exception:
                df = pd.DataFrame([parsed])

    else:
        raise ValueError(f"Unsupported JSON root type: {type(parsed).__name__}. Expected array or object.")

    if df is None or df.empty:
        raise ValueError("Parsed JSON produced an empty dataset with 0 rows.")

    df.columns = [str(col).strip() for col in df.columns]
    metadata = {
        "id": filename.rsplit(".", 1)[0].lower(),
        "name": filename,
        "filename": filename,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "format": parse_mode,
        "source": "json"
    }
    return df, metadata


def load_pdf_dataset(
    file_or_path,
    filename: str = "upload.pdf",
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Extract structured tabular records from PDF documents.
    Validates whether genuine extractable tabular rows exist.
    Rejects scanned/image-only PDFs or unformatted prose with helpful guidance.
    """
    import pypdf
    import re

    if isinstance(file_or_path, bytes):
        bio = io.BytesIO(file_or_path)
    elif hasattr(file_or_path, "read"):
        content = file_or_path.read()
        bio = io.BytesIO(content if isinstance(content, bytes) else content.encode("utf-8"))
    else:
        with open(file_or_path, "rb") as f:
            bio = io.BytesIO(f.read())

    try:
        reader = pypdf.PdfReader(bio)
        num_pages = len(reader.pages)
        if num_pages == 0:
            raise ValueError("PDF contains 0 pages.")

        all_lines = []
        for p in reader.pages:
            text = p.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if line:
                    all_lines.append(line)
    except Exception as e:
        raise ValueError(f"Failed to read PDF document: {str(e)}")

    if not all_lines:
        raise ValueError(
            "Could not extract any readable text from the provided PDF. "
            "Scanned or image-only PDFs require optical character recognition (OCR), which is not supported. "
            "Please upload a PDF containing selectable digital text or export the table directly as CSV/Excel."
        )

    table_rows = []
    header = None

    for line in all_lines:
        if "\t" in line:
            parts = [p.strip() for p in line.split("\t") if p.strip()]
        elif "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
        elif "," in line:
            parts = [p.strip() for p in line.split(",") if p.strip()]
        else:
            parts = [p.strip() for p in re.split(r"\s{2,}", line) if p.strip()]

        # Only consider multi-column tokens (at least 2 distinct columns)
        if len(parts) >= 2:
            if header is None:
                header = parts
            elif len(parts) == len(header):
                table_rows.append(parts)
            elif abs(len(parts) - len(header)) <= 1:
                if len(parts) < len(header):
                    parts = parts + [""] * (len(header) - len(parts))
                else:
                    parts = parts[:len(header)]
                table_rows.append(parts)

    # Validation: If no multi-column tabular data was found across all pages
    if not table_rows or header is None or len(header) < 2:
        raise ValueError(
            "No extractable tabular data found in the provided PDF. "
            "OpenDataLens requires PDFs containing structured tables (with columns separated by tabs, pipes, commas, or columnar whitespace). "
            "Scanned/image-only PDFs and free-form narrative prose are not supported."
        )

    df = pd.DataFrame(table_rows[:max_rows] if max_rows else table_rows, columns=header)

    cols = []
    seen = {}
    for c in df.columns:
        c_str = str(c).strip() or "Col"
        if c_str in seen:
            seen[c_str] += 1
            cols.append(f"{c_str}_{seen[c_str]}")
        else:
            seen[c_str] = 0
            cols.append(c_str)
    df.columns = cols

    for col in df.columns:
        try:
            df[col] = pd.to_numeric(df[col])
        except (ValueError, TypeError):
            pass

    metadata = {
        "id": filename.rsplit(".", 1)[0].lower(),
        "name": filename,
        "filename": filename,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "pages": num_pages,
        "source": "pdf"
    }
    return df, metadata


def load_sql_dataset(
    file_or_path,
    filename: str = "upload.sql",
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Safely parse SQL dump statements (CREATE TABLE & INSERT INTO) into a pandas DataFrame.
    Strictly offline static parser: never connects to external databases or executes arbitrary SQL.
    Disallows administrative, remote-execution, or destructive commands for security.
    """
    import re
    if isinstance(file_or_path, bytes):
        raw_text = file_or_path.decode("utf-8", errors="replace")
    elif hasattr(file_or_path, "read"):
        raw_bytes = file_or_path.read()
        raw_text = raw_bytes.decode("utf-8", errors="replace") if isinstance(raw_bytes, bytes) else str(raw_bytes)
    else:
        with open(file_or_path, "r", encoding="utf-8", errors="replace") as f:
            raw_text = f.read()

    if not raw_text.strip():
        raise ValueError("The provided SQL file is empty.")

    # Security check: Disallow dangerous / administrative statements
    dangerous_patterns = [
        (r"\bDROP\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)\b", "DROP statement"),
        (r"\bALTER\s+(?:USER|ROLE|SYSTEM|DATABASE)\b", "Administrative ALTER statement"),
        (r"\bTRUNCATE\s+(?:TABLE)?\b", "TRUNCATE statement"),
        (r"\bEXEC(?:UTE)?\s+xp_\w+", "Extended stored procedure execution"),
        (r"\b(?:SHUTDOWN|RESTART)\b", "Server shutdown command"),
        (r"\bGRANT\s+.*\bTO\b", "Privilege GRANT statement"),
        (r"\bREVOKE\s+.*\bFROM\b", "Privilege REVOKE statement"),
        (r"\bATTACH\s+DATABASE\b", "ATTACH DATABASE statement"),
        (r"\bLOAD_EXTENSION\b", "LOAD_EXTENSION command")
    ]
    for pattern, label in dangerous_patterns:
        if re.search(pattern, raw_text, re.IGNORECASE):
            raise ValueError(
                f"Security Warning: Uploaded SQL file contains disallowed or dangerous statement ({label}). "
                f"OpenDataLens operates in zero-execution static mode and only safely extracts data from CREATE TABLE and INSERT INTO statements. "
                f"Destructive, administrative, or remote execution statements are strictly forbidden."
            )

    insert_pattern = re.compile(
        r"INSERT\s+INTO\s+[`\"']?(\w+)[`\"']?\s*(?:\(([^)]+)\))?\s+VALUES\s*([\s\S]+?)(?:;|$)",
        re.IGNORECASE
    )
    matches = insert_pattern.findall(raw_text)

    records = []
    columns = None
    table_name = "sql_table"

    for tbl, cols_str, values_block in matches:
        if tbl:
            table_name = tbl
        if cols_str and columns is None:
            columns = [c.strip().strip("`\"' ") for c in cols_str.split(",") if c.strip()]

        tuple_pattern = re.compile(r"\(([^)]+)\)")
        for tup in tuple_pattern.findall(values_block):
            vals = []
            for item in csv.reader([tup], quotechar="'", skipinitialspace=True):
                for val in item:
                    v = val.strip().strip("'\"")
                    if v.upper() == "NULL":
                        vals.append(None)
                    else:
                        try:
                            if "." in v:
                                vals.append(float(v))
                            else:
                                vals.append(int(v))
                        except ValueError:
                            vals.append(v)
            if vals:
                records.append(vals)

    if not records:
        if re.search(r"\bSELECT\b", raw_text, re.IGNORECASE):
            raise ValueError(
                "Unsupported SQL statement: Query statements (e.g. SELECT) without table definitions or literal INSERT records cannot be converted into an offline dataset. "
                "OpenDataLens does not connect to live databases. Please upload a SQL dump containing CREATE TABLE and INSERT INTO statements, or export query results as CSV."
            )

        create_pattern = re.compile(r"CREATE\s+TABLE\s+[`\"']?(\w+)[`\"']?\s*\(([\s\S]+?)\);", re.IGNORECASE)
        create_match = create_pattern.search(raw_text)
        if create_match:
            cols_def = create_match.group(2)
            col_names = []
            for line in cols_def.splitlines():
                line = line.strip().rstrip(",")
                if line and not line.upper().startswith(("PRIMARY", "KEY", "CONSTRAINT", "FOREIGN", "UNIQUE")):
                    parts = line.split()
                    if parts:
                        col_names.append(parts[0].strip("`\"'"))
            if col_names:
                df = pd.DataFrame(columns=col_names)
                metadata = {
                    "id": filename.rsplit(".", 1)[0].lower(),
                    "name": filename,
                    "filename": filename,
                    "rows": 0,
                    "cols": len(col_names),
                    "table_name": create_match.group(1),
                    "source": "sql"
                }
                return df, metadata
        raise ValueError(
            "Could not parse SQL table or INSERT records. "
            "Ensure the file contains standard SQL DDL (CREATE TABLE) and DML (INSERT INTO) statements with literal values."
        )

    if columns is None:
        columns = [f"col_{i+1}" for i in range(len(records[0]))]
    elif len(columns) < len(records[0]):
        columns = columns + [f"col_{i+1}" for i in range(len(columns), len(records[0]))]
    elif len(columns) > len(records[0]):
        columns = columns[:len(records[0])]

    df = pd.DataFrame(records[:max_rows] if max_rows else records, columns=columns)
    metadata = {
        "id": filename.rsplit(".", 1)[0].lower(),
        "name": filename,
        "filename": filename,
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "table_name": table_name,
        "source": "sql"
    }
    return df, metadata


def load_uploaded_file(
    file_or_path,
    filename: str,
    max_rows: Optional[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Unified ingestion router that inspects file extension and safely parses
    CSV, Excel (.xlsx, .xls), JSON (.json, .jsonl), PDF tables (.pdf), and SQL dumps (.sql).
    """
    if isinstance(file_or_path, bytes) and len(file_or_path.strip()) == 0:
        raise ValueError("The uploaded file is empty (0 bytes).")

    fn = filename.lower().strip()
    if fn.endswith((".csv", ".tsv", ".txt")):
        return load_csv_dataset(file_or_path, filename=filename, max_rows=max_rows)
    elif fn.endswith((".xlsx", ".xls")):
        return load_excel_dataset(file_or_path, filename=filename, max_rows=max_rows)
    elif fn.endswith((".json", ".jsonl")):
        return load_json_dataset(file_or_path, filename=filename, max_rows=max_rows)
    elif fn.endswith(".pdf"):
        return load_pdf_dataset(file_or_path, filename=filename, max_rows=max_rows)
    elif fn.endswith(".sql"):
        return load_sql_dataset(file_or_path, filename=filename, max_rows=max_rows)
    else:
        raise ValueError(
            f"Unsupported file format for '{filename}'. "
            f"Supported extensions: CSV (.csv), Excel (.xlsx, .xls), JSON (.json), PDF (.pdf), SQL (.sql)."
        )

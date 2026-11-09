"""
Tests for the dataset loader module.
"""

import io
import pytest
import pandas as pd
from core.dataset_loader import (
    load_csv_dataset,
    load_curated_dataset,
    get_sample_datasets_list,
    search_hf_datasets
)


def test_get_sample_datasets_list():
    samples = get_sample_datasets_list()
    assert isinstance(samples, list)
    assert len(samples) >= 5
    ids = [s["id"] for s in samples]
    assert "iris" in ids
    assert "california_housing" in ids
    assert "breast_cancer" in ids


def test_load_curated_dataset_iris():
    df, meta = load_curated_dataset("iris")
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert df.shape[0] == 150
    assert "target" in df.columns
    assert meta["id"] == "iris"
    assert meta["task"] == "classification"


def test_load_curated_dataset_california():
    df, meta = load_curated_dataset("california_housing")
    assert isinstance(df, pd.DataFrame)
    assert df.shape[0] > 1000
    assert meta["task"] == "regression"
    assert "MedHouseVal" in df.columns


def test_load_curated_dataset_invalid():
    with pytest.raises(ValueError, match="Unknown curated dataset"):
        load_curated_dataset("non_existent_dataset_xyz")


def test_load_csv_dataset_standard():
    csv_data = "col1,col2,col3\n1,2.5,A\n2,3.5,B\n3,4.5,C\n"
    file_obj = io.StringIO(csv_data)
    df, meta = load_csv_dataset(file_obj, filename="test.csv")
    assert isinstance(df, pd.DataFrame)
    assert df.shape == (3, 3)
    assert list(df.columns) == ["col1", "col2", "col3"]
    assert meta["source"] == "csv"
    assert meta["filename"] == "test.csv"


def test_load_csv_dataset_semicolon():
    csv_data = "feature_a;feature_b;label\n10;20;yes\n30;40;no\n"
    file_obj = io.StringIO(csv_data)
    df, meta = load_csv_dataset(file_obj, filename="semicolon.csv")
    assert df.shape == (2, 3)
    assert "feature_a" in df.columns
    assert "label" in df.columns


def test_load_csv_dataset_empty_error():
    empty_csv = ""
    file_obj = io.StringIO(empty_csv)
    with pytest.raises(ValueError, match="empty"):
        load_csv_dataset(file_obj, filename="empty.csv")


def test_search_hf_datasets_mock_or_network():
    # Should safely return a list and not raise uncaught network exceptions
    results = search_hf_datasets(query="imdb", limit=3)
    assert isinstance(results, list)

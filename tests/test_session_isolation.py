"""
Tests for Session Store, Isolation, and Expiration.
"""

import time
import pytest
import pandas as pd
from backend.api.session_store import SessionStore, is_valid_session_id, generate_session_id


def test_session_id_validation():
    assert is_valid_session_id(generate_session_id()) is True
    assert is_valid_session_id("workspace_12345") is True
    assert is_valid_session_id("abc") is False  # too short
    assert is_valid_session_id("") is False
    assert is_valid_session_id(None) is False
    assert is_valid_session_id("invalid!@#$characters") is False


def test_session_isolation():
    store = SessionStore(ttl_seconds=3600)
    sid1 = generate_session_id()
    sid2 = generate_session_id()

    df1 = pd.DataFrame({"a": [1, 2, 3]})
    df2 = pd.DataFrame({"b": [4, 5, 6, 7]})

    store.set_dataset(sid1, df1, {"name": "Dataset 1"})
    store.set_dataset(sid2, df2, {"name": "Dataset 2"})

    # Check isolation
    retrieved_df1 = store.get_dataset(sid1)
    retrieved_df2 = store.get_dataset(sid2)

    assert retrieved_df1 is not None and len(retrieved_df1) == 3
    assert retrieved_df2 is not None and len(retrieved_df2) == 4
    assert list(retrieved_df1.columns) == ["a"]
    assert list(retrieved_df2.columns) == ["b"]


def test_clear_session():
    store = SessionStore()
    sid = generate_session_id()
    df = pd.DataFrame({"x": [10, 20]})
    store.set_dataset(sid, df, {"name": "Temp"})

    assert store.get_dataset(sid) is not None
    cleared = store.clear_session(sid)
    assert cleared is True
    assert store.get_dataset(sid) is None
    assert store.get_metadata(sid) is None


def test_session_expiration():
    # Store with 0.1 second TTL for test
    short_store = SessionStore(ttl_seconds=1)
    sid = generate_session_id()
    df = pd.DataFrame({"x": [1, 2]})
    short_store.set_dataset(sid, df, {"name": "Quick"})

    # Manually backdate last_accessed_at to simulate expiration
    session = short_store.get_or_create_session(sid)
    session["last_accessed_at"] = time.time() - 10

    # Evict expired
    evicted_count = short_store.evict_expired()
    assert evicted_count >= 1
    assert short_store.get_dataset(sid) is None

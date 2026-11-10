"""
Helper launcher to run the FastAPI server locally on port 8000.
"""

import os
import sys
from pathlib import Path

# Add root directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting OpenDataLens FastAPI server on http://localhost:{port}")
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=port, reload=True)

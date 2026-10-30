"""ASGI entry point.

conda activate annotepgui_3_11
cd gui/backend
uvicorn app.main:app --reload
"""

from .api import create_app

app = create_app()

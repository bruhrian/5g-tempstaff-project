#!/bin/bash
source .venv/Scripts/activate
cd backend && uvicorn session_app.main:app --reload &
cd frontend/my-app && npm run dev

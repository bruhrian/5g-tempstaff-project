#! Use git bash to run this script using 'bash start.sh'
source .venv/Scripts/activate
cd backend && uvicorn session_app.main:app --reload &
cd frontend/my-app && npm run dev

# 5g-tempstaff-project
CCTV IoT x MCP project: No-code end-user agentic framework

<img width="668" height="426" alt="image" src="https://github.com/user-attachments/assets/18242dad-922a-4c01-a8dd-df633d3a8c46" />

### Installation
```bash
# Clone repository
git clone https://github.com/bruhrian/5g-tempstaff-project.git
cd 5g-tempstaff-project

# Set up Python environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up frontend
cd frontend
npm install
cd ..

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

Run MCP server
# Start MCP server
cd "backend"
python mcp-server.py

Running the System
# Start backend services
python xxx

# Start frontend development server
cd Frontend
npm start
```

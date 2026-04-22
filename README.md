# 5g-tempstaff-project
CCTV IoT x MCP project: No-code end-user agentic framework

## 🏗️ System Architecture

<img width="668" height="426" alt="image" src="https://github.com/user-attachments/assets/18242dad-922a-4c01-a8dd-df633d3a8c46" />

###
- Orchestrator: Delgates tasks to sub-agents and use available tools via MCP server & configuration.
- Sub-agents: Use tools available to them to deliver the tasks given by the orchestrator.
- Tools: Only serves a type of function per tool
 
###
## 📚 User Interface(Sandbox)
<img width="955" height="614" alt="image" src="https://github.com/user-attachments/assets/260ce35d-60e7-4ea3-9884-23f34c8a398b" />

Credits: inspired by n8n's AI workflow user interface


### Installation
```bash
# Clone repository
git clone https://github.com/bruhrian/5g-tempstaff-project.git
cd 5g-tempstaff-project

# Set up Python environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up frontend(sandbox)
cd frontend
npm install
cd ..

# Set up frontend(telegram)
python telegram.py

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
```

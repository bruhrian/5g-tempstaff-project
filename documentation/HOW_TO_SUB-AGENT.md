# Building a Sub-Agent under the Orchestrator

This guide walks you through creating a new **sub-agent** and registering it on the **MCP server** so the orchestrator can call it. The pattern is identical across all agents — you only need to change a few values to personalise it.

---

## Project Structure

```
backend/
├── mcp-server.py                  # FastMCP server — exposes agents & tools over HTTP
└── agents/                        # All agent files live here
    ├── __init__.py                # Exports agent response functions for mcp-server.py
    ├── orchestrator.py
    ├── research_agent.py          # example sub-agent
    ├── sql_agent.py               # example sub-agent
    ├── prompts/                   # System prompt .md files, one per agent
    │   ├── orchestrator.md
    │   ├── research_agent.md
    │   └── sql_agent.md
    └── tools/                     # Standalone functions/classes used by agents or MCP
        ├── timey.py               # e.g. get_current_datetime_json
        └── my_tool.py             # add your own tool modules here
```

`mcp-server.py` sits at the root of `backend/` and imports directly from the `agents` package. Sub-agents and utility tools are both exposed through it as MCP tools — the orchestrator loads all of them at runtime via `load_mcp_tools`.

---

## Prerequisites

Ensure the following are installed and configured:

```bash
pip install fastmcp langchain-ollama langgraph langchain-core langchain-mcp-adapters langchain-community mcp python-dotenv psycopg2
```

Your `.env` file should have these keys (add your agent-specific ones as needed):

```env
agents_memory_db=postgresql://user:password@host:port/dbname
mcp_server_ip=http://your-mcp-server-ip:8015
orc_prompt=./agents/prompts/orchestrator.md
your_agent_prompt=./agents/prompts/your_agent.md   # add one per agent
```

---

## Part 1 — The MCP Server

`mcp-server.py` is the **single entry point** that the orchestrator connects to. Every sub-agent and utility tool must be registered here as an `@agent_mcp.tool` before the orchestrator can use it.

### Base template

```python
from fastmcp import FastMCP
import asyncio
from langchain_community.tools import DuckDuckGoSearchRun
from dotenv import load_dotenv
from agents import sql_agent_query          # ← import your agent response functions
from agents.tools.timey import get_current_datetime_json  # ← import utility tools

load_dotenv()

agent_mcp = FastMCP(
    "OrchestratorMCP",
    instructions="An MCP server that exposes AI agents as tools and other utilities for the orchestrator."
)

# ── AGENT TOOLS ───────────────────────────────────────────────────────────────

@agent_mcp.tool(
    name="run_database_agent",
    description=(
        "Directly query or modify the PostgreSQL database using natural language. "
        "Supports SELECT, INSERT, UPDATE, and DELETE on existing tables. "
        "Pass a plain natural language instruction or question as the input. "
        "Example: 'List the 5 most recent alerts' or 'Add a new camera at location T1432'."
    )
)
async def run_database_agent(query: str) -> str:
    response = await sql_agent_query(query=query)
    return response

@agent_mcp.tool
async def run_gmail_agent() -> str:
    print(f"gmail called!")

@agent_mcp.tool
async def RAG_agent() -> str:
    print(f"RAG agent called!")

# ── UTILITY TOOLS ─────────────────────────────────────────────────────────────

@agent_mcp.tool
async def run_web(search_input: str) -> str:
    search = DuckDuckGoSearchRun()
    return await asyncio.to_thread(search.run, search_input)

@agent_mcp.tool
async def get_datetime_and_timezone():
    response = await get_current_datetime_json()
    return response

# ── SERVER ENTRYPOINT ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    agent_mcp.run(transport="http", port=8015)
```

---

### Adding a new sub-agent to the MCP server

Adding a sub-agent takes **3 steps**:

**Step 1 — Create the agent file** in `backend/agents/` (see Part 2 of this guide).

**Step 2 — Export the response function** from `agents/__init__.py`:

```python
# agents/__init__.py
from .sql_agent import sql_agent_query
from .research_agent import research_agent_response   # ← add your new agent
```

**Step 3 — Register it as a tool** in `mcp-server.py`:

```python
# At the top of mcp-server.py, import the function
from agents import research_agent_response

# Then add a new decorated async function anywhere in the AGENT TOOLS section
@agent_mcp.tool(
    name="run_research_agent",
    description=(
        "Searches and summarises information on a given topic. "
        "Pass a plain natural language question or research instruction. "
        "Example: 'Summarise recent news about computer vision'."
    )
)
async def run_research_agent(query: str) -> str:
    response = await research_agent_response(query=query)
    return response["result"]
```

> **Note on descriptions:** The `description` field is what the orchestrator's LLM reads to decide *when* to call this tool. Write it in plain language — describe what the agent does and give a concrete usage example. If you omit `name` and `description`, FastMCP infers the tool name from the function name and uses the docstring as the description instead.

---

### Adding a new utility tool to the MCP server

Utility tools are standalone functions (not agents) stored under `agents/tools/`. The pattern is the same:

**Step 1 — Write the function** in `agents/tools/my_tool.py`:

```python
# agents/tools/my_tool.py

async def my_utility_function(input: str) -> str:
    # your logic here
    return "result"
```

**Step 2 — Register it in `mcp-server.py`:**

```python
from agents.tools.my_tool import my_utility_function

@agent_mcp.tool
async def my_tool(input: str) -> str:
    """Brief description of what this tool does and when to use it."""
    return await my_utility_function(input)
```

---

## Part 2 — Creating a Sub-Agent

### The agent template

Copy the code below in full. The next section tells you exactly what to change.

```python
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, BaseMessage
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_community.chat_message_histories import SQLChatMessageHistory
from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession
from dotenv import load_dotenv
import os, time, psycopg2

load_dotenv()

# ── 1. CONFIGURATION ──────────────────────────────────────────────────────────
ORCHESTRATOR_PROMPT_PATH = os.getenv('orc_prompt')          # ← change env key
MODEL = "gemma4:e4b"
MCP_SERVER_IP = os.getenv('mcp_server_ip')
DEFAULT_SESSION_ID = "orchestrator-default-session"          # ← change session id

DB_CONN = os.getenv('agents_memory_db')
if not DB_CONN:
    raise ValueError("❌ agents_memory_db not set. Please add a PostgreSQL connection string to your .env")
else:
    print(f"✅ Postgres connection string loaded.")

# ── 2. DB HELPERS (leave as-is) ───────────────────────────────────────────────
def init_postgres_db(conn_string: str = DB_CONN) -> bool:
    try:
        conn = psycopg2.connect(conn_string)
        conn.close()
        print(f"✅ Postgres DB connection verified.")
        return True
    except Exception as e:
        print(f"❌ Failed to connect to Postgres: {e}")
        return False

def get_session_history(session_id: str, conn_string: str = DB_CONN) -> SQLChatMessageHistory:
    return SQLChatMessageHistory(
        session_id=session_id,
        connection_string=conn_string
    )

def log_session_history(session_id: str, conn_string: str = DB_CONN) -> None:
    history = get_session_history(session_id, conn_string)
    messages: list[BaseMessage] = history.messages
    print(f"\n🔍 Chat history for session [{session_id}]:")
    if not messages:
        print("   ⚠️  No prior messages (normal for a new session)")
        return
    print(f"   {len(messages)} message(s) loaded:")
    for i, msg in enumerate(messages):
        preview = str(msg.content)[:120]
        if len(str(msg.content)) > 120:
            preview += "..."
        print(f"   [{i}] {type(msg).__name__}: {preview}")

# ── 3. AGENT FUNCTION (rename + wire up) ──────────────────────────────────────
async def orchestrator_response(                             # ← rename this function
    query: str,
    session_id: str | None = None,
    conn_string: str = DB_CONN
) -> dict:

    if not init_postgres_db(conn_string):
        return {
            "result": "Agent could not start: memory database failed to initialise.",
            "error": "DB init failure",
            "session_id": session_id
        }

    if not session_id:
        session_id = DEFAULT_SESSION_ID
        print(f"ℹ️  No session_id provided — using default: [{session_id}]")
    else:
        print(f"🔄 Resuming session: [{session_id}]")

    log_session_history(session_id, conn_string)

    with open(ORCHESTRATOR_PROMPT_PATH, 'r', encoding='utf-8') as f:   # ← uses your prompt path var
        system_prompt = f.read()

    llm = ChatOllama(model=MODEL)

    async with streamable_http_client(MCP_SERVER_IP) as (read, write, _):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            tools = await load_mcp_tools(mcp_session)

            agent = create_react_agent(
                model=llm,
                tools=tools,
                prompt=system_prompt,
            )

            history = get_session_history(session_id, conn_string)
            messages_in = history.messages + [HumanMessage(content=query)]

            print(f"📨 Sending {len(messages_in)} message(s) to agent "
                  f"({len(history.messages)} from history + 1 new)")

            try:
                start_time = time.time()
                raw_res = await agent.ainvoke({"messages": messages_in})
                output = raw_res["messages"][-1].content
                elapsed = time.time() - start_time

                history.add_user_message(query)
                history.add_ai_message(output)
                print(f"💾 Turn saved to DB (session: {session_id})")

                print(f"\n💬 Response : {output}")
                print(f"⏱️  Elapsed  : {elapsed:.2f}s")
                print(f"🗂️  Session  : {session_id}")

                return {
                    "result": output,
                    "session_id": session_id,
                    "elapsed_time": elapsed
                }

            except Exception as e:
                print(f"❌ Agent execution error: {e}")
                return {
                    "result": f"Error processing request: {str(e)}",
                    "error": str(e),
                    "session_id": session_id
                }
```

---

### What to change

There are exactly **4 things** to modify when creating a new sub-agent:

#### 1. Prompt path env key

```python
# Before (orchestrator)
ORCHESTRATOR_PROMPT_PATH = os.getenv('orc_prompt')

# After (e.g. a research agent)
RESEARCH_AGENT_PROMPT_PATH = os.getenv('research_agent_prompt')
```

Add the matching key to your `.env`:
```env
research_agent_prompt=./agents/prompts/research_agent.md
```

---

#### 2. Default session ID

Give each agent a unique session ID so their memory is stored separately in Postgres.

```python
# Before
DEFAULT_SESSION_ID = "orchestrator-default-session"

# After
DEFAULT_SESSION_ID = "research-agent-default-session"
```

---

#### 3. MCP connection (optional — remove for most sub-agents)

Sub-agents are *called by* the orchestrator, so they generally do not need their own MCP connection. If the sub-agent only needs tools from `agents/tools/`, remove the MCP block entirely and load tools directly (see the section below). Only keep the MCP block if this sub-agent itself needs to call other MCP-registered tools.

---

#### 4. Function name

Rename `orchestrator_response` to match your agent. This is the function you will import and register in `mcp-server.py`.

```python
# Before
async def orchestrator_response(query, session_id, conn_string) -> dict:

# After
async def research_agent_response(query, session_id, conn_string) -> dict:
```

Also update the internal prompt path reference:

```python
# Before
with open(ORCHESTRATOR_PROMPT_PATH, 'r', encoding='utf-8') as f:

# After
with open(RESEARCH_AGENT_PROMPT_PATH, 'r', encoding='utf-8') as f:
```

---

### Using LangChain tools instead of MCP (recommended for sub-agents)

Sub-agents generally work with a fixed set of functions from `agents/tools/`. You can load those directly rather than opening an MCP connection.

**Remove** this block:

```python
async with streamable_http_client(MCP_SERVER_IP) as (read, write, _):
    async with ClientSession(read, write) as mcp_session:
        await mcp_session.initialize()
        tools = await load_mcp_tools(mcp_session)

        agent = create_react_agent(
            model=llm,
            tools=tools,
            prompt=system_prompt,
        )
        # ... rest of invoke logic inside the context managers
```

**Replace** it with:

```python
from langchain_core.tools import tool
from agents.tools.my_tool import my_utility_function   # import from agents/tools/

@tool
async def my_tool(input: str) -> str:
    """Describe what this tool does so the agent knows when to call it."""
    return await my_utility_function(input)

tools = [my_tool]   # list all tools this sub-agent needs

agent = create_react_agent(
    model=llm,
    tools=tools,
    prompt=system_prompt,
)

history = get_session_history(session_id, conn_string)
messages_in = history.messages + [HumanMessage(content=query)]

# ... rest of the invoke / save logic (same as template)
```

> **Note:** Removing the MCP context managers removes one level of `async with` nesting. Move the invoke, history save, and return block up one indentation level.

---

## Part 3 — Writing the System Prompt

Each agent's system prompt lives in `agents/prompts/` as a `.md` file. Markdown gives you a clean, readable way to structure instructions — use headings for sections, bullet points for rules, and code blocks for examples.

Recommended structure:

```markdown
# [Agent Name] — System Prompt

## Role
You are a [describe the agent's role and purpose in one or two sentences].

## Responsibilities
- [What this agent is responsible for]
- [What kinds of tasks it should handle]
- [Any specific domain knowledge it should apply]

## Behaviour Rules
- Always [important behavioural constraint]
- Never [what the agent must not do]
- If you are unsure, [fallback behaviour]

## Output Format
Respond in [format: plain text / JSON / markdown / etc.].
[Any specific structure the response must follow]

## Tools Available
You have access to the following tools. Use them when appropriate:
- `tool_name` — [what it does and when to use it]

## Examples
[Optional: one or two input → output examples to guide the model's behaviour]
```

> **Tip:** The more precise your headings and bullet points, the more reliably the agent will follow them. Keep each rule to one clear sentence. The agent code reads this file as a plain string and passes it directly to `create_react_agent` as the `prompt` argument — all Markdown formatting is preserved and interpreted correctly.

---

## Quick Reference

### Adding a sub-agent end-to-end

| Step | What to do | Where |
|---|---|---|
| 1 | Create `your_agent.py` from the template | `backend/agents/` |
| 2 | Rename the response function | Inside `your_agent.py` |
| 3 | Update the prompt path variable & env key | Inside `your_agent.py` + `.env` |
| 4 | Set a unique `DEFAULT_SESSION_ID` | Inside `your_agent.py` |
| 5 | Write the system prompt | `backend/agents/prompts/your_agent.md` |
| 6 | Export the function | `backend/agents/__init__.py` |
| 7 | Register as `@agent_mcp.tool` | `backend/mcp-server.py` |

### Adding a utility tool end-to-end

| Step | What to do | Where |
|---|---|---|
| 1 | Write the function | `backend/agents/tools/my_tool.py` |
| 2 | Register as `@agent_mcp.tool` | `backend/mcp-server.py` |

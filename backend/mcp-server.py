from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from fastmcp import FastMCP
import asyncio
from langchain_community.tools import DuckDuckGoSearchRun
from dotenv import load_dotenv
from agents import sql_agent_query
from agents.tools.timey import get_current_datetime_json
from agents.tools.QingRAG import rag, MODE
from agents.tools.gmailing import send_email
from lightrag import QueryParam
from lightrag.kg.shared_storage import initialize_pipeline_status

load_dotenv()

# mainly used to init the RAG
@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[None]:
    # Startup
    # below is RAG's required inits
    await rag.initialize_storages()
    await initialize_pipeline_status()
    yield
    # Shutdown (add cleanup here if needed)


agent_mcp = FastMCP(
    "OrchestratorMCP",
    instructions="An MCP server that exposes AI agents as a tool and other tools for orchestrator.",
    lifespan=lifespan  # for initialising the RAG
)


@agent_mcp.tool()  # gmail tool
async def run_gmail_agent(to: str, subject: str, body: str) -> str:
    return await send_email(to, subject, body)


# nlp2sql agent 
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
    print(f"DEBUG tool return: repr={repr(response)}")
    return response

# lightrag agent 
@agent_mcp.tool()
async def RAG_agent(query: str) -> str:
    result = await rag.aquery(
        query=query,
        param=QueryParam(mode=MODE)
    )
    return result

# web tool
@agent_mcp.tool()
async def run_web(search_input: str) -> str:
    search = DuckDuckGoSearchRun()
    return await asyncio.to_thread(search.run, search_input)

# datetime & timezone tool
@agent_mcp.tool()
async def get_datetime_and_timezone():
    response = await get_current_datetime_json()
    return response

# to run the mcp-server
if __name__ == "__main__":
    agent_mcp.run(transport="http", port=8015)

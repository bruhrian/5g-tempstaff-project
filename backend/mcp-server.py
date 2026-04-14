from fastmcp import FastMCP
import asyncio
from langchain_community.tools import DuckDuckGoSearchRun
from dotenv import load_dotenv
from agents import sql_agent_query
from agents.tools.timey import get_current_datetime_json

load_dotenv()

agent_mcp = FastMCP(
    "OrchestratorMCP",
    instructions="An MCP server that exposes AI agents as a tool and other tools for orchestrator."
)

@agent_mcp.tool
async def run_gmail_agent() -> str: 
    print(f"gmail called!")

@agent_mcp.tool(name="run_database_agent",
    description=(
        "Directly query or modify the PostgreSQL database using natural language. "
        "Supports SELECT, INSERT, UPDATE, and DELETE on existing tables. "
        "Pass a plain natural language instruction or question as the input. "
        "Example: 'List the 5 most recent alerts' or 'Add a new camera at location T1432'."
    ))
async def run_database_agent(query: str) -> str: 
    response = await sql_agent_query(query=query)
    #print(f"DEBUG tool return: repr={repr(response)}")
    return response

@agent_mcp.tool
async def RAG_agent() -> str: 
    print(f"RAG agent called!")

@agent_mcp.tool
async def run_web(search_input: str) -> str:
    search = DuckDuckGoSearchRun()
    return await asyncio.to_thread(search.run, search_input)

@agent_mcp.tool
async def get_datetime_and_timezone():
    response = await get_current_datetime_json()
    return response

if __name__ == "__main__":
    agent_mcp.run(transport="http", port=8015)

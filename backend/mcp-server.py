from fastapi import FastMCP
import asyncio
from langchain_community.tools import DuckDuckGoSearchRun
import os
from dotenv import load_dotenv

load_dotenv()

PORT = os.getenv('PORT')

agent_mcp = FastMCP(
    "OrchestratorMCP",
    instructions="An MCP server that exposes AI agents as a tool and other tools for orchestrator."
)

@agent_mcp.tool
async def run_gmail_agent() -> str: 
    print(f"gmail called!")

@agent_mcp.tool
async def run_database_agent(query: str) -> str: 
    response = await dba_response(query=query)
    return response

@agent_mcp.tool
async def RAG_agent() -> str: 
    print(f"RAG agent called!")

@agent_mcp.tool
async def run_web(search_input: str) -> str:
    search = DuckDuckGoSearchRun()
    return await asyncio.to_thread(search.run, search_input)

if __name__ == "__main__":
    agent_mcp.run(transport="http", port=PORT)

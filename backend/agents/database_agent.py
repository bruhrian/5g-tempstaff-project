# issue
# 1. say got query db but db did not receive the execution

from langchain_ollama import ChatOllama
from dotenv import load_dotenv
from pydantic import BaseModel
import os, time, uuid, sqlite3
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_classic.memory import ConversationBufferMemory
from pathlib import Path


load_dotenv()
dba_prompt = os.getenv('database_agent_prompt')
model="gemma4:e4b"
DB_PATH = os.getenv('dba_memory_db')

def get_sqlite_memory(session_id: str, db_path: str = None):
    if db_path is None:
        db_path = DB_PATH

    connection_string = f"sqlite:///{db_path}"

    return SQLChatMessageHistory(
        session_id=session_id,
        connection_string=connection_string
    )

def init_sqlite_db(db_path: str = None):
    if db_path is None:
        db_path = DB_PATH

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS message_store (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            message_type TEXT,
            additional_kwargs TEXT
        )
    ''')
    conn.commit()
    conn.close()

class DBA_Response(BaseModel):
    response: str
    
async def dba_response(query: str, session_id: str = None, db_path: str = None):
    init_sqlite_db(db_path)
    
    if not session_id:
        session_id = str(uuid.uuid4())


    llm = ChatOllama(
        model=model
    )

    with open(dba_prompt, 'r', encoding='utf-8') as f:
        dba_prompt_content = f.read()
    
    prompt = ChatPromptTemplate.from_messages(
        [
        ("system", dba_prompt_content),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"), 
    ]
    )

    tools = []

    agent = create_tool_calling_agent(
        llm=llm,
        prompt=prompt,
        tools=tools
    )
    
    message_history = get_sqlite_memory(session_id, db_path)
    memory = ConversationBufferMemory(
        chat_memory=message_history,
        memory_key="chat_history",
        return_messages=True
    )

    agent_exe = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=5,
        early_stopping_method="force"
    )

    try:
        start_time = time.time()
        raw_res = agent_exe.invoke({"input": query})
        output = raw_res.get("output", "")
        
        elapsed = time.time() - start_time
        
        print(f"Response: {output}")
        print(f"Elapsed time - {elapsed:.2f} seconds")
        print(f"Session ID: {session_id}")
        
        return {
            "result": output,
            "session_id": session_id,
            "elapsed_time": elapsed
        }

    except Exception as e:
        print(f"Error in agent execution: {e}")
        return {
            "result": f"Error processing request: {str(e)}",
            "error": str(e),
            "session_id": session_id
        }

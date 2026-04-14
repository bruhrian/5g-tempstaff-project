from llama_index.core import SQLDatabase, Settings
from llama_index.core.query_engine import NLSQLTableQueryEngine
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.ollama import OllamaEmbedding
from sqlalchemy import create_engine, text, inspect, event
from sqlalchemy.engine import Engine
from dotenv import load_dotenv
import os, re

load_dotenv()
SQL_prompt = os.getenv('db_manager_prompt')

PG_HOST            = os.getenv("PG_HOST")
PG_PORT            = os.getenv("PG_PORT")
PG_USER            = os.getenv("PG_USER")
PG_PASSWORD        = os.getenv("PG_PASSWORD")
PG_DB              = os.getenv("PG_DB")
OLLAMA_MODEL       = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL    = os.getenv("OLLAMA_BASE_URL")

_PROHIBITED_PATTERNS = re.compile(
    r"""
    \b(
        CREATE\s+DATABASE   |
        DROP\s+DATABASE     |
        ALTER\s+DATABASE    |
        CREATE\s+TABLE      |
        DROP\s+TABLE        |
        ALTER\s+TABLE       |
        TRUNCATE\s+TABLE    |
        TRUNCATE            |
        CREATE\s+SCHEMA     |
        DROP\s+SCHEMA       |
        CREATE\s+INDEX      |
        DROP\s+INDEX        |
        CREATE\s+VIEW       |
        DROP\s+VIEW         |
        CREATE\s+SEQUENCE   |
        DROP\s+SEQUENCE     |
        RENAME\s+TABLE      |
        RENAME\s+TO
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_WRITE_PATTERNS = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|UPSERT)\b",
    re.IGNORECASE,
)

def _is_prohibited(sql: str) -> bool:
    return bool(_PROHIBITED_PATTERNS.search(sql))

def _is_write_operation(sql: str) -> bool:
    return bool(_WRITE_PATTERNS.match(sql.strip()))

def _attach_guard(engine: Engine) -> None:
    @event.listens_for(engine, "before_cursor_execute")
    def _guard(conn, cursor, statement, parameters, context, executemany):
        if _is_prohibited(statement):
            raise PermissionError(
                f"Prohibited SQL intercepted and blocked:\n{statement}\n\n"
                "Allowed operations: SELECT, INSERT, UPDATE, DELETE on existing tables only."
            )

_engine: Engine | None = None
_query_engine: NLSQLTableQueryEngine | None = None

def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        connection_string = (
            f"postgresql+psycopg2://{PG_USER}:{PG_PASSWORD}"
            f"@{PG_HOST}:{PG_PORT}/{PG_DB}"
        )
        _engine = create_engine(connection_string)
        _attach_guard(_engine)
        inspector = inspect(_engine)
        available_tables = inspector.get_table_names(schema="public")
        print(f"✅ Tables available to agent: {available_tables}")
    return _engine

def _get_query_engine() -> NLSQLTableQueryEngine:
    global _query_engine
    if _query_engine is None:
        engine = _get_engine()
        inspector = inspect(engine)
        available_tables = inspector.get_table_names(schema="public")

        if not available_tables:
            raise RuntimeError("No tables found in the public schema.")

        sql_database = SQLDatabase(
            engine=engine,
            include_tables=available_tables,
            schema="public",
        )

        llm = Ollama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            request_timeout=120.0,
        )
        embed_model = OllamaEmbedding(
            model_name=OLLAMA_EMBED_MODEL,
            base_url=OLLAMA_BASE_URL,
        )
        Settings.llm = llm
        Settings.embed_model = embed_model

        _query_engine = NLSQLTableQueryEngine(
            sql_database=sql_database,
            tables=available_tables,
            synthesize_response=True,
            verbose=True,
        )
    return _query_engine

def _execute_write(sql: str) -> str:
    if _is_prohibited(sql):
        raise PermissionError(f"Prohibited SQL blocked:\n{sql}")

    engine = _get_engine()
    with engine.begin() as conn:  # engine.begin() auto-commits on exit
        result = conn.execute(text(sql))
        rowcount = result.rowcount

    if rowcount == 0:
        return (
            "⚠️ Query executed successfully but affected 0 rows. "
            "The record may already exist or the condition matched nothing."
        )
    return f"✅ Success — {rowcount} row(s) affected."

def _load_prompt(query: str) -> str:
    with open(SQL_prompt, "r", encoding="utf-8") as f:
        template = f.read()
    return template.replace("{query}", query)

async def _nl_write_query(query: str) -> str:
    qe = _get_query_engine()

    generate_sql_prompt = _load_prompt(query)

    llm: Ollama = Settings.llm
    sql_response = llm.complete(generate_sql_prompt)
    generated_sql = str(sql_response).strip()

    generated_sql = re.sub(r"^```(?:sql)?|```$", "", generated_sql, flags=re.MULTILINE).strip()

    print(f"🔧 Generated write SQL: {generated_sql}")

    if not _is_write_operation(generated_sql):
        return (
            f"⚠️ Expected a write SQL statement but got:\n{generated_sql}\n"
            "Please rephrase your request."
        )

    return _execute_write(generated_sql)

async def sql_agent_query(query: str) -> str:
    try:
        write_intent = re.search(
            r"\b(add|insert|create|update|delete|remove|set|put)\b",
            query,
            re.IGNORECASE,
        )

        if write_intent:
            return await _nl_write_query(query)

        qe = _get_query_engine()
        response = qe.query(query)

        if hasattr(response, "response") and response.response:
            return response.response

        result = str(response).strip()
        return result if result else "Query completed but returned an empty response."

    except PermissionError as pe:
        return f"⛔ Operation blocked: {str(pe)}"

    except Exception as e:
        print(f"❌ SQL agent error: {type(e).__name__}: {e}")
        return f"❌ SQL agent error: {str(e)}"

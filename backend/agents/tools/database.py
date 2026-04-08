import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()
PG_CONN_STRING = os.getenv('pg_connection_string')

async def sql_Db_Query(sql_query: str):
    """Input to this tool is a detailed and correct SQL query, output is a result from the database. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again. If you encounter an issue with Unknown column 'xxxx' in 'field list', using sql_db_schema to query the correct table fields."""
    pg_conn_string = PG_CONN_STRING
    conn = await asyncpg.connect(pg_conn_string)

    try:
        rows = await conn.fetch(sql_query)
        if not rows:
            return "Query returned no results."
        return "\n".join(str(dict(row)) for row in rows)
    except Exception as e:
        return f"Error executing query: {str(e)}"
    finally:
        await conn.close()

async def sql_Db_Schema(tables: str):
    """Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables. Be sure that the tables actually exist by calling sql_db_list_tables first! Example Input: 'table1, table2, table3'"""
    pg_conn_string = PG_CONN_STRING
    conn = await asyncpg.connect(pg_conn_string)

    try:
        table_list = [t.strip() for t in tables.split(",")]
        result = []

        for table in table_list:
            # Get schema
            columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
            """, table)

            if not columns:
                result.append(f"Table '{table}' not found.")
                continue

            schema_str = f"Table: {table}\nColumns:\n"
            schema_str += "\n".join(f"  - {row['column_name']} ({row['data_type']})" for row in columns)

            rows = await conn.fetch(f"SELECT * FROM {table} LIMIT 3")
            sample_str = "\nSample Rows:\n"
            sample_str += "\n".join(str(dict(row)) for row in rows)

            result.append(schema_str + sample_str)

        return "\n\n".join(result)
    finally:
        await conn.close()

async def sql_Db_List_Tables():
    """Input is an empty string, output is a comma separated list of tables in the database."""
    pg_conn_string = PG_CONN_STRING
    conn = await asyncpg.connect(pg_conn_string)
    try:
        rows = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        return ", ".join(row['table_name'] for row in rows)
    finally:
        await conn.close()

async def sql_Db_Query_Checker(sql_query: str):
    """Use this tool to double check if your query is correct before executing it. Always use this tool before executing a query with sql_db_query!"""
    pg_conn_string = PG_CONN_STRING
    conn = await asyncpg.connect(pg_conn_string)
    
    try:
        await conn.execute(f"EXPLAIN {sql_query}")
        return f"Query is valid: {sql_query}"
    except Exception as e:
        return f"Invalid query: {str(e)}"
    finally:
        await conn.close()

from .orchestrator import orchestrator_response # DO NOT TOUCH
from agents.database_agent import dba_response # DO NOT TOUCH

from langchain_classic.tools import Tool
from .tools.database import sql_Db_Query, sql_Db_Schema, sql_Db_List_Tables, sql_Db_Query_Checker


sql_db_query = Tool(
    name="sql_db_query",
    func=sql_Db_Query,
    description="Input to this tool is a detailed and correct SQL query, output is a result from the database. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again. If you encounter an issue with Unknown column 'xxxx' in 'field list', using sql_db_schema to query the correct table fields."
)

sql_db_schema = Tool(
    name="sql_db_schema",
    func=sql_Db_Schema,
    description="Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables. Be sure that the tables actually exist by calling sql_db_list_tables first! Example Input: 'table1, table2, table3'"   
)

sql_db_list_tables = Tool(
    name="sql_db_list_tables",
    func=sql_Db_List_Tables,
    description="Input is an empty string, output is a comma separated list of tables in the database."   
)

sql_db_query_checker = Tool(
    name="sql_db_query_checker",
    func=sql_Db_Query_Checker,
    description="Use this tool to double check if your query is correct before executing it. Always use this tool before executing a query with sql_db_query!"
)

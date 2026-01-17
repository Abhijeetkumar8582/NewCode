"""
Script to run SQL commands directly against MySQL database
Usage: python run_sql_command.py "SELECT * FROM frame_analyses LIMIT 5;"
"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine
from app.config import settings
from sqlalchemy import text


async def run_sql(sql_command: str):
    """Run a SQL command against the database"""
    db_info = settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'unknown'
    print(f"Connecting to database: {db_info}")
    print(f"Executing SQL command:")
    print(f"{'=' * 60}")
    print(sql_command)
    print(f"{'=' * 60}\n")
    
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text(sql_command))
            
            # Try to fetch results for SELECT, SHOW, DESCRIBE queries
            sql_upper = sql_command.strip().upper()
            is_select_query = sql_upper.startswith('SELECT') or sql_upper.startswith('SHOW') or sql_upper.startswith('DESCRIBE') or sql_upper.startswith('DESC')
            
            if is_select_query:
                try:
                    rows = result.fetchall()
                    if rows:
                        # Get column names
                        columns = result.keys()
                        print(f"Results ({len(rows)} rows):")
                        print("-" * 80)
                        
                        # Print column headers
                        header = " | ".join(str(col) for col in columns)
                        print(header)
                        print("-" * 80)
                        
                        # Print rows
                        for row in rows:
                            row_str = " | ".join(str(val) if val is not None else "NULL" for val in row)
                            print(row_str)
                        print("-" * 80)
                    else:
                        print("No rows returned.")
                except Exception as fetch_error:
                    # Some queries might not support fetchall
                    print(f"[SUCCESS] Command executed successfully")
                    print(f"Note: Could not fetch results ({fetch_error})")
            else:
                # For non-SELECT queries, show affected rows
                print(f"[SUCCESS] Command executed successfully")
                if hasattr(result, 'rowcount') and result.rowcount >= 0:
                    print(f"Rows affected: {result.rowcount}")
        
    except Exception as e:
        print(f"[ERROR] SQL execution failed: {e}")
        raise


async def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python run_sql_command.py \"SQL_COMMAND\"")
        print("\nExamples:")
        print('  python run_sql_command.py "SELECT * FROM frame_analyses LIMIT 5;"')
        print('  python run_sql_command.py "SHOW TABLES;"')
        print('  python run_sql_command.py "DESCRIBE frame_analyses;"')
        return
    
    sql_command = sys.argv[1]
    await run_sql(sql_command)


if __name__ == "__main__":
    asyncio.run(main())

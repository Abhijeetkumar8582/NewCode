"""
Script to run MySQL migration for frame_analyses table
Run this script to create the frame_analyses table in MySQL/AWS RDS MySQL
"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path (parent of scripts folder)
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine
from app.config import settings
from sqlalchemy import text


async def run_migration():
    """Run MySQL migration to create frame_analyses table"""
    migration_file = Path(__file__).parent.parent / "migrations" / "010_create_tables_mysql.sql"
    
    if not migration_file.exists():
        print(f"Error: Migration file not found: {migration_file}")
        return
    
    print(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        migration_sql = f.read()
    
    # Remove comments and empty lines, split by semicolons
    # MySQL doesn't use GO like SQL Server, so we split by semicolons
    statements = []
    current_statement = []
    
    for line in migration_sql.split('\n'):
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith('--'):
            continue
        current_statement.append(line)
        # If line ends with semicolon, it's the end of a statement
        if line.endswith(';'):
            statement = ' '.join(current_statement)
            if statement.strip():
                statements.append(statement)
            current_statement = []
    
    # Add any remaining statement
    if current_statement:
        statement = ' '.join(current_statement)
        if statement.strip():
            statements.append(statement)
    
    print(f"Found {len(statements)} SQL statements to execute")
    db_info = settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'unknown'
    print(f"Connecting to database: {db_info}")
    
    try:
        async with engine.begin() as conn:
            for i, statement in enumerate(statements, 1):
                print(f"\nExecuting statement {i}/{len(statements)}...")
                print(f"SQL: {statement[:100]}..." if len(statement) > 100 else f"SQL: {statement}")
                try:
                    await conn.execute(text(statement))
                    print(f"[OK] Statement {i} executed successfully")
                except Exception as e:
                    # Some errors are expected (like table already exists)
                    error_msg = str(e).lower()
                    if "already exists" in error_msg or "duplicate" in error_msg:
                        print(f"[WARN] Statement {i}: Table/index already exists (this is OK)")
                    else:
                        print(f"[ERROR] Statement {i} error: {e}")
                        # For MySQL, we might want to continue with other statements
                        # unless it's a critical error
                        if "foreign key" in error_msg and "cannot add" in error_msg:
                            print("  (This might be because video_uploads table doesn't exist yet)")
        print("\n[SUCCESS] Migration completed!")
    except Exception as e:
        print(f"\n[FAILED] Migration failed: {e}")
        raise


async def main():
    """Main function"""
    print("=" * 60)
    print("MySQL Migration Script - frame_analyses table")
    print("=" * 60)
    
    # Check if using MySQL
    if "mysql" not in settings.DATABASE_URL.lower():
        print("⚠ Warning: This script is for MySQL. Your database URL doesn't contain 'mysql'")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
    
    await run_migration()
    
    print("\n" + "=" * 60)
    print("Migration process completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

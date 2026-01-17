"""Test script to debug .env file loading"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

# Check if .env file exists
env_file = Path(__file__).parent.parent / ".env"
print(f".env file path: {env_file.absolute()}")
print(f".env file exists: {env_file.exists()}")

if env_file.exists():
    content = env_file.read_text(encoding='utf-8-sig')  # utf-8-sig handles BOM
    # Find GPT_BASE_URL line
    for line in content.split('\n'):
        if 'GPT_BASE_URL' in line:
            line_clean = line.replace('\ufeff', '').strip()
            print(f"Found GPT_BASE_URL line: {line_clean[:100]}")
            break
    
    # Find GPT_BEARER_TOKEN line
    for line in content.split('\n'):
        if 'GPT_BEARER_TOKEN' in line and not line.strip().startswith('#'):
            line_clean = line.replace('\ufeff', '').strip()
            print(f"Found GPT_BEARER_TOKEN line (first 50 chars): {line_clean[:50]}")
            break

# Test pydantic settings loading
class TestSettings(BaseSettings):
    GPT_BASE_URL: Optional[str] = None
    GPT_BEARER_TOKEN: Optional[str] = None
    
    class Config:
        env_file = str(env_file)
        case_sensitive = True
        env_file_encoding = 'utf-8'

print("\n" + "=" * 60)
print("Testing Pydantic Settings Loading")
print("=" * 60)

test_settings = TestSettings()
print(f"GPT_BASE_URL loaded: {test_settings.GPT_BASE_URL is not None}")
print(f"GPT_BASE_URL value: {test_settings.GPT_BASE_URL}")
print(f"GPT_BEARER_TOKEN loaded: {test_settings.GPT_BEARER_TOKEN is not None}")
print(f"GPT_BEARER_TOKEN (first 30): {test_settings.GPT_BEARER_TOKEN[:30] + '...' if test_settings.GPT_BEARER_TOKEN else None}")

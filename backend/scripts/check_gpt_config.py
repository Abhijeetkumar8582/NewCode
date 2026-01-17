"""
Quick script to check GPT configuration
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings

print("=" * 60)
print("GPT Configuration Check")
print("=" * 60)
print(f"GPT_BASE_URL configured: {settings.GPT_BASE_URL is not None and settings.GPT_BASE_URL != ''}")
print(f"GPT_BEARER_TOKEN configured: {settings.GPT_BEARER_TOKEN is not None and settings.GPT_BEARER_TOKEN != ''}")
print(f"has_custom_gpt: {bool(settings.GPT_BASE_URL and settings.GPT_BEARER_TOKEN)}")
print()

if settings.GPT_BASE_URL:
    masked_url = settings.GPT_BASE_URL[:50] + "..." if len(settings.GPT_BASE_URL) > 50 else settings.GPT_BASE_URL
    print(f"GPT_BASE_URL: {masked_url}")
else:
    print("GPT_BASE_URL: NOT SET")

if settings.GPT_BEARER_TOKEN:
    masked_token = f"{settings.GPT_BEARER_TOKEN[:7]}...{settings.GPT_BEARER_TOKEN[-4:]}" if len(settings.GPT_BEARER_TOKEN) > 11 else "***"
    print(f"GPT_BEARER_TOKEN: {masked_token}")
else:
    print("GPT_BEARER_TOKEN: NOT SET")

print("=" * 60)

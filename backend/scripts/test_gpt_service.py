"""
Test script to verify custom GPT service is working
"""
import sys
import asyncio
import base64
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
import httpx

async def test_custom_gpt():
    """Test the custom GPT service endpoint"""
    print("=" * 60)
    print("Testing Custom GPT Service")
    print("=" * 60)
    print(f"GPT_BASE_URL: {settings.GPT_BASE_URL}")
    print(f"GPT_BEARER_TOKEN: {'***' + settings.GPT_BEARER_TOKEN[-10:] if settings.GPT_BEARER_TOKEN else 'NOT SET'}")
    print()
    
    if not settings.GPT_BASE_URL or not settings.GPT_BEARER_TOKEN:
        print("ERROR: GPT_BASE_URL or GPT_BEARER_TOKEN not configured!")
        return
    
    # Create a simple test image (1x1 pixel red image)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    base64_image = base64.b64encode(test_image_data).decode('utf-8')
    
    headers = {
        "Authorization": f"Bearer {settings.GPT_BEARER_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this image in detail. What do you see?"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 200
    }
    
    print("Making request to GPT service...")
    print(f"URL: {settings.GPT_BASE_URL}")
    print(f"Model: {payload['model']}")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.GPT_BASE_URL,
                headers=headers,
                json=payload
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print()
            
            if response.status_code == 200:
                result = response.json()
                print("SUCCESS! GPT service is working!")
                print(f"Response: {result}")
            else:
                print(f"ERROR: Request failed with status {response.status_code}")
                print(f"Response: {response.text}")
                
    except Exception as e:
        print(f"ERROR: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_custom_gpt())

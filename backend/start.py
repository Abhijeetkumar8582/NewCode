#!/usr/bin/env python3
"""
Startup script for the video processing backend
"""
import os
import sys
from pathlib import Path

# Check for .env file
env_file = Path(".env")
if not env_file.exists():
    print("[WARNING] .env file not found!")
    print("Please create a .env file with your OPENAI_API_KEY")
    print()
    print("Quick setup:")
    print("  cp env.example .env")
    print("  # Then edit .env and add your OPENAI_API_KEY")
    print()
    print("Or set environment variables:")
    print("  OPENAI_API_KEY=your_key_here")
    print("  UPLOAD_DIR=./uploads")
    print()
    
    # Check if OPENAI_API_KEY is set in environment
    if not os.getenv("OPENAI_API_KEY"):
        print("[ERROR] OPENAI_API_KEY not found in environment variables either.")
        print("Please set it before starting the server.")
        sys.exit(1)
    else:
        print("[OK] Using OPENAI_API_KEY from environment variables")

# Check for required directories
upload_dir = Path(os.getenv("UPLOAD_DIR", "./uploads"))
upload_dir.mkdir(exist_ok=True)
print(f"[OK] Upload directory: {upload_dir.absolute()}")

# Start the server
if __name__ == "__main__":
    import uvicorn
    import traceback
    import sys
    
    # #region agent log
    try:
        log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
        import json
        import time
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:main","message":"start.py entry","data":{},"timestamp":int(time.time()*1000)}) + "\n")
    except: pass
    # #endregion
    
    try:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:import_config","message":"Before importing app.config","data":{},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        from app.config import settings
        
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:import_config","message":"After importing app.config","data":{"port":settings.PORT,"host":settings.HOST},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        port = settings.PORT
        print("\n[STARTING] FastAPI server...")
        print(f"[INFO] API will be available at http://localhost:{port}")
        print(f"[INFO] API docs at http://localhost:{port}/docs\n")
        
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:uvicorn_run","message":"Before uvicorn.run","data":{"app":"app.main:app","host":settings.HOST,"port":port,"reload":settings.DEBUG},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        # Test import before uvicorn.run to catch import errors
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:test_import","message":"Before test import of app.main","data":{},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        
        try:
            import app.main
            # #region agent log
            try:
                log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                import json
                import time
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A,B,C","location":"start.py:test_import","message":"After test import of app.main - success","data":{"has_app":hasattr(app.main, 'app')},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
        except SyntaxError as e:
            # #region agent log
            try:
                log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                import json
                import time
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A","location":"start.py:test_import","message":"SyntaxError during import","data":{"error":str(e),"filename":e.filename if hasattr(e, 'filename') else None,"lineno":e.lineno if hasattr(e, 'lineno') else None,"text":e.text if hasattr(e, 'text') else None,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            print(f"[ERROR] Syntax Error in app.main: {e}")
            print(f"File: {e.filename if hasattr(e, 'filename') else 'unknown'}, Line: {e.lineno if hasattr(e, 'lineno') else 'unknown'}")
            if hasattr(e, 'text') and e.text:
                print(f"Problematic code: {e.text.strip()}")
            traceback.print_exc()
            sys.exit(1)
        except ImportError as e:
            # #region agent log
            try:
                log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                import json
                import time
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"B","location":"start.py:test_import","message":"ImportError during import","data":{"error":str(e),"name":e.name if hasattr(e, 'name') else None,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            print(f"[ERROR] Import Error in app.main: {e}")
            traceback.print_exc()
            sys.exit(1)
        except Exception as e:
            # #region agent log
            try:
                log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
                import json
                import time
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"C","location":"start.py:test_import","message":"Exception during import","data":{"error":str(e),"error_type":type(e).__name__,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
            except: pass
            # #endregion
            print(f"[ERROR] Error importing app.main: {e}")
            traceback.print_exc()
            sys.exit(1)
        
        uvicorn.run("app.main:app", host=settings.HOST, port=port, reload=settings.DEBUG)
    except SyntaxError as e:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"A","location":"start.py:error","message":"SyntaxError","data":{"error":str(e),"filename":e.filename if hasattr(e, 'filename') else None,"lineno":e.lineno if hasattr(e, 'lineno') else None,"text":e.text if hasattr(e, 'text') else None,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        print(f"[ERROR] Syntax Error: {e}")
        print(f"File: {e.filename if hasattr(e, 'filename') else 'unknown'}, Line: {e.lineno if hasattr(e, 'lineno') else 'unknown'}")
        traceback.print_exc()
        sys.exit(1)
    except ImportError as e:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"B","location":"start.py:error","message":"ImportError","data":{"error":str(e),"name":e.name if hasattr(e, 'name') else None,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        print(f"[ERROR] Import Error: {e}")
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        # #region agent log
        try:
            log_path = r"c:\Users\abhij\OneDrive\Desktop\NewEpiplex\.cursor\debug.log"
            import json
            import time
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"startup-debug","hypothesisId":"C","location":"start.py:error","message":"General Exception","data":{"error":str(e),"error_type":type(e).__name__,"traceback":traceback.format_exc()},"timestamp":int(time.time()*1000)}) + "\n")
        except: pass
        # #endregion
        print(f"[ERROR] Failed to start server: {e}")
        traceback.print_exc()
        sys.exit(1)


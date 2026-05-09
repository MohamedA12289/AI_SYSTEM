import os
import sys
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=None)
    args, _ = parser.parse_known_args()

    port = args.port or int(os.environ.get('CUBOS_API_PORT', '8000'))
    host = os.environ.get('CUBOS_API_HOST', '127.0.0.1')

    print(f"[SERVER] Starting import of main.app...")
    from main import app
    print(f"[SERVER] main.app imported successfully")

    print(f"[SERVER] Starting uvicorn on {host}:{port}...")
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level='info', log_config=None)

if __name__ == '__main__':
    main()

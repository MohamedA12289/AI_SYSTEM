import requests
import sys
import time

def test_backend():
    print("[TEST] Testing backend startup and Go 2 endpoints...")
    
    base_url = "http://localhost:8000"
    
    # Test 1: Basic health check
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Backend responded with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend not responding: {e}")
        return False
    
    # Test 2: List projects
    try:
        response = requests.get(f"{base_url}/api/projects", timeout=5)
        if response.status_code == 200:
            projects = response.json()
            print(f"✅ /api/projects endpoint works ({len(projects)} projects)")
        else:
            print(f"❌ /api/projects failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ /api/projects error: {e}")
    
    # Test 3: File tree endpoint (if projects exist)
    try:
        response = requests.get(f"{base_url}/api/projects", timeout=5)
        projects = response.json()
        if projects:
            project_name = projects[0]['project_name']
            response = requests.get(f"{base_url}/project/{project_name}/files", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ File tree endpoint works (project: {project_name}, {len(data.get('items', []))} items)")
            else:
                print(f"❌ File tree failed with status {response.status_code}")
        else:
            print("⚠️  No projects to test file tree")
    except Exception as e:
        print(f"❌ File tree error: {e}")
    
    print("\n[TEST] Backend verification complete")
    return True

if __name__ == "__main__":
    # Wait a moment for server to fully start
    time.sleep(2)
    success = test_backend()
    sys.exit(0 if success else 1)

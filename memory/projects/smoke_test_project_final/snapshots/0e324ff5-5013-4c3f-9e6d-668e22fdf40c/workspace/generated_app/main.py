from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"app": "generated_app", "status": "ok"}

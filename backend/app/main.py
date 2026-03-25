from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "WhatTheDogDoing"}

# backend/app/main.py 修改
from .auth import router as auth_router
app.include_router(auth_router)
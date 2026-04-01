# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth import router as auth_router
from .chat import router as chat_router
from .database import engine
from . import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WhatTheDogDoing API")

# backend/app/main.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # 增加下面这些，确保包含全小写版本，且没有末尾斜杠
        "https://frontend-dyno-whatthedogdoing.app.spring26b.secoder.net",
        "https://frontend-dyno-WhatTheDogDoing.app.spring26b.secoder.net",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/")
def read_root():
    return {"Hello": "WhatTheDogDoing"}

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(auth_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])

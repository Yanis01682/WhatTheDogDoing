from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import models # 引用你提到的 models.py

# ====================
# 1. 基础配置
# ====================
SECRET_KEY = "whatthedogdoing-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ====================
# 2. Pydantic 数据验证模型
# ====================
class UserAuth(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ====================
# 3. 核心认证与加密工具
# ====================
def verify_password(plain_password, hashed_password):
    """验证明文密码与哈希值是否匹配"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """生成密码哈希"""
    return pwd_context.hash(password)

def create_access_token(data: dict):
    """生成 JWT Access Token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ====================
# 4. 数据库交互逻辑 (调用 models.User)
# ====================
def get_user_by_username(db: Session, username: str):
    """根据用户名查询用户"""
    return db.query(models.User).filter(models.User.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    """验证用户登录信息"""
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

# 此处为获取数据库会话的依赖注入占位符。
# 你需要在你的项目中引入实际的 get_db 函数 (例如从 database.py 中引入)
def get_db():
    raise NotImplementedError("请替换为你们实际的数据库 Session 依赖")

# ====================
# 5. 路由接口定义
# ====================
@router.post("/register", response_model=UserResponse)
def register(user_data: UserAuth, db: Session = Depends(get_db)):
    """用户注册接口"""
    # 检查用户是否已存在
    db_user = get_user_by_username(db, username=user_data.username)
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已被注册")
    
    # 创建新用户
    hashed_password = get_password_hash(user_data.password)
    new_user = models.User(username=user_data.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=TokenResponse)
def login(user_data: UserAuth, db: Session = Depends(get_db)):
    """用户登录接口"""
    # 验证账号密码
    user = authenticate_user(db, user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 生成 Token
    access_token = create_access_token(data={"sub": user.username})
    
    # 严格按照规范返回格式供 mwq 进行前端对接
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username
        }
    }
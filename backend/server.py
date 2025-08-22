from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    level: int = 1
    exp: int = 0
    gold: int = 0
    stat_points: int = 0
    strength: int = 1
    stamina: int = 1
    vitality: int = 1
    agility: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Quest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    type: str  # "daily" or "weekly"
    exp_reward: int
    gold_reward: int
    stat_bonus: Optional[Dict[str, int]] = None
    requirements: Optional[Dict[str, int]] = None

class UserQuest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    quest_id: str
    completed: bool = False
    completed_at: Optional[datetime] = None
    reset_date: datetime

class ShopItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: int
    type: str  # "cosmetic", "booster", "title"
    effect: Optional[Dict] = None

class StatDistribution(BaseModel):
    strength: int = 0
    stamina: int = 0
    vitality: int = 0
    agility: int = 0

class Token(BaseModel):
    access_token: str
    token_type: str

# Utility Functions
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

def calculate_exp_for_level(level: int) -> int:
    """Calculate total EXP needed to reach a level"""
    return level * 100

def calculate_level_from_exp(exp: int) -> int:
    """Calculate level from total EXP"""
    return max(1, exp // 100)

# Auth Routes
@api_router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        stat_points=3  # Starting stat points
    )
    
    user_dict = user.dict()
    user_dict["password_hash"] = hashed_password
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# User Routes
@api_router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/distribute-stats")
async def distribute_stats(
    stats: StatDistribution, 
    current_user: User = Depends(get_current_user)
):
    total_points = stats.strength + stats.stamina + stats.vitality + stats.agility
    
    if total_points > current_user.stat_points:
        raise HTTPException(status_code=400, detail="Not enough stat points")
    
    # Update user stats
    update_data = {
        "strength": current_user.strength + stats.strength,
        "stamina": current_user.stamina + stats.stamina,
        "vitality": current_user.vitality + stats.vitality,
        "agility": current_user.agility + stats.agility,
        "stat_points": current_user.stat_points - total_points
    }
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    return {"message": "Stats distributed successfully"}

# Quest Routes
@api_router.get("/quests", response_model=List[Quest])
async def get_quests():
    quests = await db.quests.find().to_list(1000)
    return [Quest(**quest) for quest in quests]

@api_router.get("/user-quests")
async def get_user_quests(current_user: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    user_quests = await db.user_quests.find({
        "user_id": current_user.id,
        "reset_date": {"$gte": datetime.combine(today, datetime.min.time())}
    }).to_list(1000)
    
    quest_ids = [uq["quest_id"] for uq in user_quests]
    quests = await db.quests.find({"id": {"$in": quest_ids}}).to_list(1000)
    
    # Combine quest data with completion status
    result = []
    for quest in quests:
        user_quest = next((uq for uq in user_quests if uq["quest_id"] == quest["id"]), None)
        quest_data = Quest(**quest).dict()
        quest_data["completed"] = user_quest["completed"] if user_quest else False
        quest_data["user_quest_id"] = user_quest["id"] if user_quest else None
        result.append(quest_data)
    
    return result

@api_router.post("/complete-quest/{quest_id}")
async def complete_quest(quest_id: str, current_user: User = Depends(get_current_user)):
    # Get quest
    quest = await db.quests.find_one({"id": quest_id})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    quest_obj = Quest(**quest)
    
    # Check if user quest exists
    today = datetime.now(timezone.utc).date()
    user_quest = await db.user_quests.find_one({
        "user_id": current_user.id,
        "quest_id": quest_id,
        "reset_date": {"$gte": datetime.combine(today, datetime.min.time())}
    })
    
    if not user_quest:
        # Create user quest
        reset_date = datetime.combine(today, datetime.min.time())
        if quest_obj.type == "weekly":
            # Set reset date to next Monday
            days_ahead = 6 - today.weekday()  # Monday is 0
            reset_date = datetime.combine(today + timedelta(days=days_ahead), datetime.min.time())
        
        user_quest_data = UserQuest(
            user_id=current_user.id,
            quest_id=quest_id,
            reset_date=reset_date
        )
        await db.user_quests.insert_one(user_quest_data.dict())
        user_quest = user_quest_data.dict()
    
    if user_quest["completed"]:
        raise HTTPException(status_code=400, detail="Quest already completed")
    
    # Calculate new stats after quest completion
    new_exp = current_user.exp + quest_obj.exp_reward
    new_level = calculate_level_from_exp(new_exp)
    level_up = new_level > current_user.level
    new_stat_points = current_user.stat_points
    
    if level_up:
        levels_gained = new_level - current_user.level
        new_stat_points += levels_gained * 3  # 3 stat points per level
    
    # Update user
    update_data = {
        "exp": new_exp,
        "level": new_level,
        "gold": current_user.gold + quest_obj.gold_reward,
        "stat_points": new_stat_points
    }
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    # Mark quest as completed
    await db.user_quests.update_one(
        {"id": user_quest["id"]},
        {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": "Quest completed!",
        "exp_gained": quest_obj.exp_reward,
        "gold_gained": quest_obj.gold_reward,
        "level_up": level_up,
        "new_level": new_level,
        "stat_points_gained": (new_level - current_user.level) * 3 if level_up else 0
    }

# Shop Routes
@api_router.get("/shop", response_model=List[ShopItem])
async def get_shop_items():
    items = await db.shop_items.find().to_list(1000)
    return [ShopItem(**item) for item in items]

@api_router.post("/purchase/{item_id}")
async def purchase_item(item_id: str, current_user: User = Depends(get_current_user)):
    item = await db.shop_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item_obj = ShopItem(**item)
    
    if current_user.gold < item_obj.price:
        raise HTTPException(status_code=400, detail="Insufficient gold")
    
    # Deduct gold
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"gold": current_user.gold - item_obj.price}}
    )
    
    # Add to user inventory (simple implementation)
    inventory_item = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "item_id": item_id,
        "purchased_at": datetime.now(timezone.utc)
    }
    await db.user_inventory.insert_one(inventory_item)
    
    return {"message": f"Purchased {item_obj.name}!"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Initialize sample quests
    existing_quests = await db.quests.count_documents({})
    if existing_quests == 0:
        sample_quests = [
            # Daily Quests
            Quest(
                title="Morning Warrior Training",
                description="Complete 50 push-ups to strengthen your warrior spirit",
                type="daily",
                exp_reward=25,
                gold_reward=10
            ),
            Quest(
                title="Swift Scout Mission", 
                description="Run or walk for 30 minutes to build your stamina",
                type="daily",
                exp_reward=30,
                gold_reward=12
            ),
            Quest(
                title="Flexibility Training",
                description="Complete 15 minutes of stretching or yoga",
                type="daily", 
                exp_reward=20,
                gold_reward=8
            ),
            Quest(
                title="Core Strengthening Ritual",
                description="Hold a plank for 2 minutes total (can be broken into sets)",
                type="daily",
                exp_reward=25,
                gold_reward=10
            ),
            # Weekly Quests
            Quest(
                title="The Goblin's Lair (HIIT Dungeon)",
                description="Complete 3 High-Intensity Interval Training sessions this week",
                type="weekly",
                exp_reward=100, 
                gold_reward=50
            ),
            Quest(
                title="Dragon's Endurance Trial",
                description="Complete 150 minutes of cardio activity this week",
                type="weekly",
                exp_reward=120,
                gold_reward=60
            ),
            Quest(
                title="Strength Guild Challenge",
                description="Complete 3 strength training sessions this week",
                type="weekly",
                exp_reward=110,
                gold_reward=55
            )
        ]
        
        for quest in sample_quests:
            await db.quests.insert_one(quest.dict())
        
        # Initialize sample shop items
        sample_items = [
            ShopItem(
                name="EXP Potion",
                description="Double EXP from your next completed quest",
                price=50,
                type="booster",
                effect={"type": "exp_multiplier", "value": 2, "uses": 1}
            ),
            ShopItem(
                name="Legendary Hunter Title",
                description="Display 'Legendary Hunter' as your title",
                price=100,
                type="title"
            ),
            ShopItem(
                name="Shadow Theme",
                description="Unlock the exclusive Shadow theme for your interface",
                price=75,
                type="cosmetic"
            ),
            ShopItem(
                name="Gold Rush Potion",
                description="Double gold from your next completed quest", 
                price=40,
                type="booster",
                effect={"type": "gold_multiplier", "value": 2, "uses": 1}
            )
        ]
        
        for item in sample_items:
            await db.shop_items.insert_one(item.dict())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
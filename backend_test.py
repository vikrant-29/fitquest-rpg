import requests
import sys
import json
from datetime import datetime
import time

class RPGFitnessAPITester:
    def __init__(self, base_url="https://fitquest-rpg-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.quest_ids = []
        self.shop_item_ids = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}

            return success, response.status_code, response_data

        except Exception as e:
            return False, 0, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_data = {
            "email": f"test{timestamp}@example.com",
            "username": f"TestHunter{timestamp}",
            "password": "password123"
        }
        
        success, status, response = self.make_request('POST', 'register', test_data, 200)
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return self.log_test("User Registration", True, f"- Token received")
        else:
            return self.log_test("User Registration", False, f"- Status: {status}, Response: {response}")

    def test_user_login(self):
        """Test user login with existing credentials"""
        # First register a user
        timestamp = int(time.time())
        register_data = {
            "email": f"login_test{timestamp}@example.com", 
            "username": f"LoginTest{timestamp}",
            "password": "password123"
        }
        
        # Register user
        success, status, response = self.make_request('POST', 'register', register_data, 200)
        if not success:
            return self.log_test("User Login Setup", False, f"Registration failed: {response}")
        
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        success, status, response = self.make_request('POST', 'login', login_data, 200)
        
        if success and 'access_token' in response:
            return self.log_test("User Login", True, f"- Login successful")
        else:
            return self.log_test("User Login", False, f"- Status: {status}, Response: {response}")

    def test_get_current_user(self):
        """Test getting current user info"""
        success, status, response = self.make_request('GET', 'me', expected_status=200)
        
        if success and 'id' in response and 'username' in response:
            self.user_id = response['id']
            return self.log_test("Get Current User", True, f"- User: {response['username']}, Level: {response['level']}")
        else:
            return self.log_test("Get Current User", False, f"- Status: {status}, Response: {response}")

    def test_get_quests(self):
        """Test fetching available quests"""
        success, status, response = self.make_request('GET', 'quests', expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            self.quest_ids = [quest['id'] for quest in response]
            daily_quests = [q for q in response if q['type'] == 'daily']
            weekly_quests = [q for q in response if q['type'] == 'weekly']
            return self.log_test("Get Quests", True, f"- {len(daily_quests)} daily, {len(weekly_quests)} weekly quests")
        else:
            return self.log_test("Get Quests", False, f"- Status: {status}, Response: {response}")

    def test_get_user_quests(self):
        """Test fetching user's quest progress"""
        success, status, response = self.make_request('GET', 'user-quests', expected_status=200)
        
        if success and isinstance(response, list):
            return self.log_test("Get User Quests", True, f"- {len(response)} user quests found")
        else:
            return self.log_test("Get User Quests", False, f"- Status: {status}, Response: {response}")

    def test_complete_quest(self):
        """Test completing a quest"""
        if not self.quest_ids:
            return self.log_test("Complete Quest", False, "- No quest IDs available")
        
        quest_id = self.quest_ids[0]  # Use first available quest
        success, status, response = self.make_request('POST', f'complete-quest/{quest_id}', expected_status=200)
        
        if success and 'exp_gained' in response and 'gold_gained' in response:
            return self.log_test("Complete Quest", True, f"- EXP: +{response['exp_gained']}, Gold: +{response['gold_gained']}")
        else:
            return self.log_test("Complete Quest", False, f"- Status: {status}, Response: {response}")

    def test_distribute_stats(self):
        """Test stat point distribution"""
        # First get current user to check stat points
        success, status, user_data = self.make_request('GET', 'me', expected_status=200)
        if not success or user_data.get('stat_points', 0) == 0:
            return self.log_test("Distribute Stats", True, "- No stat points to distribute (expected)")
        
        # Distribute 1 point to strength
        stat_data = {
            "strength": 1,
            "stamina": 0,
            "vitality": 0,
            "agility": 0
        }
        
        success, status, response = self.make_request('POST', 'distribute-stats', stat_data, expected_status=200)
        
        if success and 'message' in response:
            return self.log_test("Distribute Stats", True, f"- {response['message']}")
        else:
            return self.log_test("Distribute Stats", False, f"- Status: {status}, Response: {response}")

    def test_get_shop_items(self):
        """Test fetching shop items"""
        success, status, response = self.make_request('GET', 'shop', expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            self.shop_item_ids = [item['id'] for item in response]
            return self.log_test("Get Shop Items", True, f"- {len(response)} items available")
        else:
            return self.log_test("Get Shop Items", False, f"- Status: {status}, Response: {response}")

    def test_purchase_item(self):
        """Test purchasing an item"""
        if not self.shop_item_ids:
            return self.log_test("Purchase Item", False, "- No shop items available")
        
        # Get current user gold
        success, status, user_data = self.make_request('GET', 'me', expected_status=200)
        if not success:
            return self.log_test("Purchase Item", False, "- Could not get user data")
        
        current_gold = user_data.get('gold', 0)
        
        # Get shop items to find affordable one
        success, status, shop_items = self.make_request('GET', 'shop', expected_status=200)
        if not success:
            return self.log_test("Purchase Item", False, "- Could not get shop items")
        
        affordable_item = None
        for item in shop_items:
            if item['price'] <= current_gold:
                affordable_item = item
                break
        
        if not affordable_item:
            return self.log_test("Purchase Item", True, f"- No affordable items (Gold: {current_gold})")
        
        # Purchase the item
        item_id = affordable_item['id']
        success, status, response = self.make_request('POST', f'purchase/{item_id}', expected_status=200)
        
        if success and 'message' in response:
            return self.log_test("Purchase Item", True, f"- {response['message']}")
        else:
            return self.log_test("Purchase Item", False, f"- Status: {status}, Response: {response}")

    def test_authentication_required(self):
        """Test that protected endpoints require authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, status, response = self.make_request('GET', 'me', expected_status=401)
        
        # Restore token
        self.token = original_token
        
        if not success and status == 401:
            return self.log_test("Authentication Required", True, "- Properly rejected unauthenticated request")
        else:
            return self.log_test("Authentication Required", False, f"- Status: {status}, should be 401")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting RPG Fitness API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        self.test_authentication_required()
        
        # Quest system tests
        self.test_get_quests()
        self.test_get_user_quests()
        self.test_complete_quest()
        
        # Stat system tests
        self.test_distribute_stats()
        
        # Shop system tests
        self.test_get_shop_items()
        self.test_purchase_item()
        
        # Print results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = RPGFitnessAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
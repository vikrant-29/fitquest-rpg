import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import shadcn components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';

// Icons
import { Sword, Shield, Heart, Zap, Star, Crown, ShoppingBag, User, LogOut, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/login`, { email, password });
      const { access_token } = response.data;
      
      setToken(access_token);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      await fetchUser();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, username, password) => {
    try {
      const response = await axios.post(`${API}/register`, { email, username, password });
      const { access_token } = response.data;
      
      setToken(access_token);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      await fetchUser();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Component
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = isLogin 
        ? await login(email, password)
        : await register(email, username, password);

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Ccircle cx="7" cy="7" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
              <Sword className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">FitQuest RPG</CardTitle>
          <CardDescription className="text-slate-300">
            {isLogin ? 'Welcome back, Hunter!' : 'Begin your fitness journey!'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-200">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              disabled={loading}
            >
              {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-purple-400 hover:text-purple-300 text-sm"
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Component  
const Dashboard = () => {
  const { user, logout, fetchUser } = useAuth();
  const { toast } = useToast();
  const [quests, setQuests] = useState([]);
  const [userQuests, setUserQuests] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [statDistribution, setStatDistribution] = useState({
    strength: 0,
    stamina: 0, 
    vitality: 0,
    agility: 0
  });
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    fetchQuests();
    fetchUserQuests(); 
    fetchShopItems();
  }, []);

  const fetchQuests = async () => {
    try {
      const response = await axios.get(`${API}/quests`);
      setQuests(response.data);
    } catch (error) {
      console.error('Failed to fetch quests:', error);
    }
  };

  const fetchUserQuests = async () => {
    try {
      const response = await axios.get(`${API}/user-quests`);
      setUserQuests(response.data);
    } catch (error) {
      console.error('Failed to fetch user quests:', error);
    }
  };

  const fetchShopItems = async () => {
    try {
      const response = await axios.get(`${API}/shop`);
      setShopItems(response.data);
    } catch (error) {
      console.error('Failed to fetch shop items:', error);
    }
  };

  const completeQuest = async (questId) => {
    try {
      const response = await axios.post(`${API}/complete-quest/${questId}`);
      const result = response.data;
      
      toast({
        title: "Quest Completed!",
        description: `+${result.exp_gained} EXP, +${result.gold_gained} Gold`,
      });

      if (result.level_up) {
        toast({
          title: "LEVEL UP!",
          description: `You reached level ${result.new_level}! +${result.stat_points_gained} stat points`,
        });
        setShowLevelUp(true);
      }

      await fetchUser();
      await fetchUserQuests();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to complete quest",
        variant: "destructive"
      });
    }
  };

  const distributeStats = async () => {
    try {
      await axios.post(`${API}/distribute-stats`, statDistribution);
      
      toast({
        title: "Stats Updated!",
        description: "Your stat points have been distributed.",
      });

      setStatDistribution({ strength: 0, stamina: 0, vitality: 0, agility: 0 });
      setShowLevelUp(false);
      await fetchUser();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to distribute stats",
        variant: "destructive"
      });
    }
  };

  const purchaseItem = async (itemId) => {
    try {
      const response = await axios.post(`${API}/purchase/${itemId}`);
      
      toast({
        title: "Purchase Successful!",
        description: response.data.message,
      });

      await fetchUser();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to purchase item",
        variant: "destructive"
      });
    }
  };

  const expForNextLevel = (user.level + 1) * 100;
  const currentLevelExp = user.level * 100;
  const expProgress = ((user.exp - currentLevelExp) / (expForNextLevel - currentLevelExp)) * 100;

  const totalStatPoints = statDistribution.strength + statDistribution.stamina + 
                         statDistribution.vitality + statDistribution.agility;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Ccircle cx="7" cy="7" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      
      {/* Header */}
      <div className="relative z-10 p-6 border-b border-slate-700/50">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Sword className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">FitQuest RPG</h1>
              <p className="text-slate-300">Welcome back, {user.username}!</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-800/50 px-4 py-2 rounded-lg">
              <Crown className="h-5 w-5 text-yellow-400" />
              <span className="text-white font-semibold">{user.gold} Gold</span>
            </div>
            <Button onClick={logout} variant="outline" size="sm" className="border-slate-600 text-slate-300">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="stats" className="data-[state=active]:bg-purple-600">Stats</TabsTrigger>
            <TabsTrigger value="quests" className="data-[state=active]:bg-purple-600">Quests</TabsTrigger>
            <TabsTrigger value="shop" className="data-[state=active]:bg-purple-600">Shop</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            {/* Player Level Card */}
            <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Star className="h-6 w-6 text-yellow-400" />
                      <span>Level {user.level} Hunter</span>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                      {user.exp} / {expForNextLevel} EXP
                    </CardDescription>
                  </div>
                  {user.stat_points > 0 && (
                    <Badge variant="secondary" className="bg-purple-600 text-white">
                      {user.stat_points} Stat Points Available
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={expProgress} className="h-3 bg-slate-700">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" 
                       style={{ width: `${expProgress}%` }} />
                </Progress>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <Sword className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm">Strength</p>
                      <p className="text-2xl font-bold text-white">{user.strength}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Zap className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm">Stamina</p>
                      <p className="text-2xl font-bold text-white">{user.stamina}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-pink-500/20 rounded-lg">
                      <Heart className="h-6 w-6 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm">Vitality</p>
                      <p className="text-2xl font-bold text-white">{user.vitality}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Shield className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm">Agility</p>
                      <p className="text-2xl font-bold text-white">{user.agility}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stat Distribution */}
            {user.stat_points > 0 && (
              <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Distribute Stat Points</CardTitle>
                  <CardDescription className="text-slate-300">
                    You have {user.stat_points} stat points to distribute. Selected: {totalStatPoints}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(statDistribution).map(([stat, value]) => (
                      <div key={stat} className="space-y-2">
                        <Label className="text-slate-200 capitalize">{stat}</Label>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatDistribution(prev => ({ 
                              ...prev, 
                              [stat]: Math.max(0, prev[stat] - 1) 
                            }))}
                            disabled={value === 0}
                            className="h-8 w-8 p-0"
                          >
                            -
                          </Button>
                          <span className="text-white font-semibold w-8 text-center">{value}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatDistribution(prev => ({ 
                              ...prev, 
                              [stat]: totalStatPoints < user.stat_points ? prev[stat] + 1 : prev[stat]
                            }))}
                            disabled={totalStatPoints >= user.stat_points}
                            className="h-8 w-8 p-0"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={distributeStats}
                    disabled={totalStatPoints === 0}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    Distribute Points
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Quests Tab */}
          <TabsContent value="quests" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Daily Quests</h3>
                <div className="space-y-4">
                  {userQuests.filter(q => q.type === 'daily').map((quest) => (
                    <Card key={quest.id} className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{quest.title}</h4>
                            <p className="text-slate-300 text-sm mb-3">{quest.description}</p>
                            <div className="flex items-center space-x-4 text-xs">
                              <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                +{quest.exp_reward} EXP
                              </Badge>
                              <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-300">
                                +{quest.gold_reward} Gold
                              </Badge>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => completeQuest(quest.id)}
                            disabled={quest.completed}
                            className={quest.completed 
                              ? "bg-green-600 hover:bg-green-600" 
                              : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            }
                          >
                            {quest.completed ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              'Complete'
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">Weekly Dungeons</h3>
                <div className="space-y-4">
                  {userQuests.filter(q => q.type === 'weekly').map((quest) => (
                    <Card key={quest.id} className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{quest.title}</h4>
                            <p className="text-slate-300 text-sm mb-3">{quest.description}</p>
                            <div className="flex items-center space-x-4 text-xs">
                              <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                +{quest.exp_reward} EXP
                              </Badge>
                              <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-300">
                                +{quest.gold_reward} Gold
                              </Badge>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => completeQuest(quest.id)}
                            disabled={quest.completed}
                            className={quest.completed 
                              ? "bg-green-600 hover:bg-green-600" 
                              : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            }
                          >
                            {quest.completed ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              'Complete'
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Shop Tab */}
          <TabsContent value="shop" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shopItems.map((item) => (
                <Card key={item.id} className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                        <ShoppingBag className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.name}</h4>
                        <p className="text-yellow-400 font-semibold">{item.price} Gold</p>
                      </div>
                    </div>
                    
                    <p className="text-slate-300 text-sm mb-4">{item.description}</p>
                    
                    <Button
                      onClick={() => purchaseItem(item.id)}
                      disabled={user.gold < item.price}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
                    >
                      Purchase
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Level Up Dialog */}
      <Dialog open={showLevelUp} onOpenChange={setShowLevelUp}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white text-center text-2xl">LEVEL UP!</DialogTitle>
            <DialogDescription className="text-slate-300 text-center">
              Congratulations! You've reached level {user.level}!
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-white">You've earned stat points to distribute!</p>
            <Button 
              onClick={() => setShowLevelUp(false)}
              className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/auth" replace />;
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
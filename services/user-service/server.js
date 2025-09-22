const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

const app = express();
const PORT = 3001;

app.use(express.json());

const db = new JsonDatabase('users');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

serviceRegistry.register('user-service', `http://localhost:${PORT}`);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};


app.post('/auth/register', async (req, res) => {
  try {
    let { email, username, password, firstName, lastName, preferences } = req.body;

    
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    
    email = email.toLowerCase().trim();
    username = username.trim();

    
    const existingUser = db.find(user => user.email === email || user.username === username);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const user = {
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      preferences: preferences || { defaultStore: '', currency: 'BRL' }
    };

    const savedUser = db.insert(user);
    const { password: _, ...userWithoutPassword } = savedUser;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/auth/login', async (req, res) => {
  try {
    let { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({ error: 'Email/username and password required' });
    }

   
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    
    const users = db.find(user =>
      (email && user.email === email) || (username && user.username === username)
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/users/:id', authenticateToken, (req, res) => {
  try {
    const user = db.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = db.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let { email, username, firstName, lastName, preferences, password } = req.body;

    
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    
    if (email && email !== user.email) {
      const existingUser = db.find(u => u.email === email && u.id !== user.id);
      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    if (username && username !== user.username) {
      const existingUser = db.find(u => u.username === username && u.id !== user.id);
      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    }

   
    const updates = {};
    if (email) updates.email = email;
    if (username) updates.username = username;
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (preferences) updates.preferences = { ...user.preferences, ...preferences };
    if (password) updates.password = await bcrypt.hash(password, 10);

    const updatedUser = db.update(user.id, updates);
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/users/me', authenticateToken, (req, res) => {
  try {
    const user = db.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/users/verify', authenticateToken, (req, res) => {
  try {
    const user = db.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json({ valid: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  serviceRegistry.markSuccess('user-service');
  res.json({ status: 'OK', service: 'user-service' });
});

process.on('SIGINT', () => {
  serviceRegistry.unregister('user-service');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`✅ User service running on port ${PORT}`);
});
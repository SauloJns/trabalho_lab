const express = require('express');
const axios = require('axios');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

const app = express();
const PORT = 3003;

app.use(express.json());

const db = new JsonDatabase('lists');

serviceRegistry.register('list-service', `http://localhost:${PORT}`);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const userServiceUrl = serviceRegistry.getService('user-service');
  if (!userServiceUrl) {
    return res.status(503).json({ error: 'User service unavailable' });
  }

  console.log('🔐 Verifying token with:', userServiceUrl);

  axios.get(`${userServiceUrl}/users/verify`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000
  })
  .then(response => {
    console.log('✅ Token verification response:', response.data);
    
    if (response.data.valid && response.data.user) {
      req.user = response.data.user;
      next();
    } else {
      res.status(403).json({ error: 'Invalid token response' });
    }
  })
  .catch(error => {
    console.error('❌ Token verification failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'User service not reachable' });
    } else if (error.response?.status === 403) {
      res.status(403).json({ error: 'Invalid or expired token' });
    } else {
      res.status(503).json({ error: 'Authentication service unavailable' });
    }
  });
};

const getItemFromCatalog = async (itemId) => {
  const itemServiceUrl = serviceRegistry.getService('item-service');
  if (!itemServiceUrl) {
    throw new Error('Item service unavailable');
  }

  try {
    const response = await axios.get(`${itemServiceUrl}/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching item:', error.message);
    throw new Error('Item not found');
  }
};

const calculateSummary = (items) => {
  const totalItems = items.length;
  const purchasedItems = items.filter(item => item.purchased).length;
  const estimatedTotal = items.reduce((total, item) => {
    return total + (item.estimatedPrice || 0) * (item.quantity || 1);
  }, 0);

  return {
    totalItems,
    purchasedItems,
    estimatedTotal: parseFloat(estimatedTotal.toFixed(2))
  };
};


app.post('/lists', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const list = {
      userId: req.user.id,
      name,
      description: description || '',
      status: 'active',
      items: [],
      summary: {
        totalItems: 0,
        purchasedItems: 0,
        estimatedTotal: 0
      }
    };

    const savedList = db.insert(list);
    res.status(201).json(savedList);
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/lists', authenticateToken, (req, res) => {
  try {
    const lists = db.find(list => list.userId === req.user.id);
    res.json(lists);
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/lists/:id', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(list);
  } catch (error) {
    console.error('Get list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/lists/:id', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, status } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;

    const updatedList = db.update(list.id, updates);
    res.json(updatedList);
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/lists/:id', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = db.delete(list.id);
    if (deleted) {
      res.json({ message: 'List deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete list' });
    }
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/lists/:id/items', authenticateToken, async (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { itemId, quantity, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    let itemInfo;
    try {
      itemInfo = await getItemFromCatalog(itemId);
    } catch (error) {
      return res.status(404).json({ error: 'Item not found in catalog' });
    }

    const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex !== -1) {
      list.items[existingItemIndex].quantity += quantity || 1;
      list.items[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
      const newItem = {
        itemId,
        itemName: itemInfo.name,
        quantity: quantity || 1,
        unit: itemInfo.unit,
        estimatedPrice: itemInfo.averagePrice,
        purchased: false,
        notes: notes || '',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      list.items.push(newItem);
    }

    list.summary = calculateSummary(list.items);
    list.updatedAt = new Date().toISOString();

    const updatedList = db.update(list.id, list);
    res.json(updatedList);
  } catch (error) {
    console.error('Add item to list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const itemIndex = list.items.findIndex(item => item.itemId === req.params.itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in list' });
    }

    const { quantity, purchased, notes } = req.body;
    
    if (quantity !== undefined) list.items[itemIndex].quantity = quantity;
    if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
    if (notes !== undefined) list.items[itemIndex].notes = notes;
    
    list.items[itemIndex].updatedAt = new Date().toISOString();

    list.summary = calculateSummary(list.items);
    list.updatedAt = new Date().toISOString();

    const updatedList = db.update(list.id, list);
    res.json(updatedList);
  } catch (error) {
    console.error('Update item in list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const itemIndex = list.items.findIndex(item => item.itemId === req.params.itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in list' });
    }

    list.items.splice(itemIndex, 1);

    list.summary = calculateSummary(list.items);
    list.updatedAt = new Date().toISOString();

    const updatedList = db.update(list.id, list);
    res.json(updatedList);
  } catch (error) {
    console.error('Remove item from list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/lists/:id/summary', authenticateToken, (req, res) => {
  try {
    const list = db.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(list.summary);
  } catch (error) {
    console.error('Get list summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  serviceRegistry.markSuccess('list-service');
  res.json({ status: 'OK', service: 'list-service' });
});

app.listen(PORT, () => {
  console.log(`List service running on port ${PORT}`);
  serviceRegistry.register('list-service', `http://localhost:${PORT}`); 
});

process.on('SIGINT', () => {
  serviceRegistry.unregister('list-service');
  process.exit(0);
});
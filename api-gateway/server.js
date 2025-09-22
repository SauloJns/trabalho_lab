const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
const axios = require('axios');
const serviceRegistry = require('../shared/serviceRegistry');

const app = express();
const PORT = 3000;

app.use(morgan('combined'));
app.use(express.json());


setInterval(() => {
  const services = serviceRegistry.getAllServices();

  Object.keys(services).forEach(async (serviceName) => {
    const service = services[serviceName];
    if (!service) return;

    try {
      await axios.get(`${service.url}/health`, { timeout: 2000 });
      serviceRegistry.markSuccess(serviceName);
    } catch (error) {
      serviceRegistry.markFailure(serviceName);
    }
  });
}, 30000);


const circuitBreaker = (req, res, next) => {
  const serviceName = getServiceNameFromPath(req.path);
  const service = serviceRegistry.getAllServices()[serviceName];

  if (service && !service.healthy) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      service: serviceName
    });
  }

  next();
};


const getServiceNameFromPath = (path) => {
  if (path.startsWith('/api/auth') || path.startsWith('/api/users')) {
    return 'user-service';
  } else if (path.startsWith('/api/items')) {
    return 'item-service';
  } else if (path.startsWith('/api/lists')) {
    return 'list-service';
  }
  return null;
};

const createDynamicProxy = (serviceName, fallbackUrl, pathRewrite) =>
  createProxyMiddleware({
    target: fallbackUrl,
    changeOrigin: true,
    router: () => serviceRegistry.getService(serviceName) || fallbackUrl,
    pathRewrite: pathRewrite || {},
    onError: (err, req, res) => {
      console.error(`Proxy error for ${serviceName}:`, err.message);
      serviceRegistry.markFailure(serviceName);
      res.status(503).json({ error: `${serviceName} unavailable` });
    }
  });


app.use('/api/auth', circuitBreaker, createDynamicProxy('user-service', 'http://localhost:3001'));
app.use('/api/users', circuitBreaker, createDynamicProxy('user-service', 'http://localhost:3001'));
app.use('/api/items', circuitBreaker, createDynamicProxy('item-service', 'http://localhost:3002', { '^/api/items': '/items' }));
app.use('/api/lists', circuitBreaker, createDynamicProxy('list-service', 'http://localhost:3003', { '^/api/lists': '/lists' }));


app.get('/api/dashboard', circuitBreaker, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Authorization header required' });

    const userServiceUrl = serviceRegistry.getService('user-service');
    const listServiceUrl = serviceRegistry.getService('list-service');

    if (!userServiceUrl || !listServiceUrl)
      return res.status(503).json({ error: 'Required service unavailable' });

    const [userResponse, listsResponse] = await Promise.all([
      axios.get(`${userServiceUrl}/users/me`, { headers: { Authorization: authHeader } }),
      axios.get(`${listServiceUrl}/lists`, { headers: { Authorization: authHeader } })
    ]);

    const user = userResponse.data;
    const lists = listsResponse.data;

    const activeLists = lists.filter(list => list.status === 'active');
    const completedLists = lists.filter(list => list.status === 'completed');
    const totalItems = lists.reduce((sum, list) => sum + list.summary.totalItems, 0);
    const purchasedItems = lists.reduce((sum, list) => sum + list.summary.purchasedItems, 0);
    const totalEstimated = lists.reduce((sum, list) => sum + list.summary.estimatedTotal, 0);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      },
      statistics: {
        totalLists: lists.length,
        activeLists: activeLists.length,
        completedLists: completedLists.length,
        totalItems,
        purchasedItems,
        totalEstimated: parseFloat(totalEstimated.toFixed(2))
      },
      recentLists: lists
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
    });

  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/search', circuitBreaker, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required' });

    const authHeader = req.headers['authorization'];
    const results = {};

    const itemServiceUrl = serviceRegistry.getService('item-service');
    if (itemServiceUrl) {
      try {
        const itemsResponse = await axios.get(`${itemServiceUrl}/search?q=${encodeURIComponent(q)}`);
        results.items = itemsResponse.data;
      } catch (error) {
        results.items = [];
      }
    }

    if (authHeader) {
      const listServiceUrl = serviceRegistry.getService('list-service');
      if (listServiceUrl) {
        try {
          const listsResponse = await axios.get(`${listServiceUrl}/lists`, {
            headers: { Authorization: authHeader }
          });
          const lists = listsResponse.data;
          results.lists = lists.filter(list =>
            list.name.toLowerCase().includes(q.toLowerCase()) ||
            list.description.toLowerCase().includes(q.toLowerCase())
          );
        } catch {
          results.lists = [];
        }
      } else {
        results.lists = [];
      }
    } else {
      results.lists = [];
    }

    res.json(results);
  } catch (error) {
    console.error('Global search error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/health', (req, res) => {
  const services = serviceRegistry.getAllServices();
  const status = {};
  Object.keys(services).forEach(s => status[s] = services[s].healthy ? 'healthy' : 'unhealthy');
  res.json({ gateway: 'healthy', services: status, timestamp: new Date().toISOString() });
});

app.get('/registry', (req, res) => {
  res.json(serviceRegistry.getAllServices());
});


app.get('/', (req, res) => {
  res.json({
    message: 'Shopping List Microservices API Gateway',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      items: '/api/items',
      lists: '/api/lists',
      dashboard: '/api/dashboard',
      search: '/api/search',
      health: '/health',
      registry: '/registry'
    }
  });
});


app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

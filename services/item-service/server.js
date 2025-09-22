// services/item-service/server.js
const express = require('express');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

const app = express();
const PORT = 3002;

app.use(express.json());

const db = new JsonDatabase('items');

serviceRegistry.register('item-service', `http://localhost:${PORT}`);

const initializeItems = () => {
  const items = db.find();
  if (items.length === 0) {
    const sampleItems = [
      {
        name: "Arroz",
        category: "Alimentos",
        brand: "Tio João",
        unit: "kg",
        averagePrice: 5.99,
        barcode: "1234567890123",
        description: "Arroz branco tipo 1",
        active: true
      },
      {
        name: "Feijão",
        category: "Alimentos",
        brand: "Camil",
        unit: "kg",
        averagePrice: 8.49,
        barcode: "1234567890124",
        description: "Feijão carioca",
        active: true
      },
      {
        name: "Açúcar",
        category: "Alimentos",
        brand: "União",
        unit: "kg",
        averagePrice: 4.29,
        barcode: "1234567890125",
        description: "Açúcar refinado",
        active: true
      },
      {
        name: "Café",
        category: "Alimentos",
        brand: "Melitta",
        unit: "g",
        averagePrice: 12.90,
        barcode: "1234567890126",
        description: "Café torrado e moído",
        active: true
      },
      {
        name: "Óleo de Soja",
        category: "Alimentos",
        brand: "Liza",
        unit: "litro",
        averagePrice: 7.99,
        barcode: "1234567890127",
        description: "Óleo de soja refinado",
        active: true
      },
      {
        name: "Sabão em Pó",
        category: "Limpeza",
        brand: "Omo",
        unit: "kg",
        averagePrice: 18.90,
        barcode: "1234567890128",
        description: "Sabão em pó para roupas",
        active: true
      },
      {
        name: "Detergente",
        category: "Limpeza",
        brand: "Ypê",
        unit: "ml",
        averagePrice: 2.49,
        barcode: "1234567890129",
        description: "Detergente líquido",
        active: true
      },
      {
        name: "Desinfetante",
        category: "Limpeza",
        brand: "Veja",
        unit: "litro",
        averagePrice: 9.90,
        barcode: "1234567890130",
        description: "Desinfetante para limpeza",
        active: true
      },
      {
        name: "Água Sanitária",
        category: "Limpeza",
        brand: "Qboa",
        unit: "litro",
        averagePrice: 5.49,
        barcode: "1234567890131",
        description: "Água sanitária para limpeza",
        active: true
      },
      {
        name: "Esponja de Aço",
        category: "Limpeza",
        brand: "Bombril",
        unit: "un",
        averagePrice: 3.99,
        barcode: "1234567890132",
        description: "Esponja de aço para limpeza",
        active: true
      },
      {
        name: "Sabonete",
        category: "Higiene",
        brand: "Dove",
        unit: "un",
        averagePrice: 2.99,
        barcode: "1234567890133",
        description: "Sabonete para higiene pessoal",
        active: true
      },
      {
        name: "Shampoo",
        category: "Higiene",
        brand: "Head & Shoulders",
        unit: "ml",
        averagePrice: 19.90,
        barcode: "1234567890134",
        description: "Shampoo anticaspa",
        active: true
      },
      {
        name: "Creme Dental",
        category: "Higiene",
        brand: "Colgate",
        unit: "g",
        averagePrice: 4.79,
        barcode: "1234567890135",
        description: "Creme dental para higiene bucal",
        active: true
      },
      {
        name: "Papel Higiênico",
        category: "Higiene",
        brand: "Neve",
        unit: "un",
        averagePrice: 12.50,
        barcode: "1234567890136",
        description: "Rolo de papel higiênico",
        active: true
      },
      {
        name: "Desodorante",
        category: "Higiene",
        brand: "Rexona",
        unit: "ml",
        averagePrice: 14.90,
        barcode: "1234567890137",
        description: "Desodorante antitranspirante",
        active: true
      },
      {
        name: "Refrigerante",
        category: "Bebidas",
        brand: "Coca-Cola",
        unit: "litro",
        averagePrice: 8.99,
        barcode: "1234567890138",
        description: "Refrigerante de cola",
        active: true
      },
      {
        name: "Suco de Laranja",
        category: "Bebidas",
        brand: "Del Valle",
        unit: "litro",
        averagePrice: 9.90,
        barcode: "1234567890139",
        description: "Suco integral de laranja",
        active: true
      },
      {
        name: "Água Mineral",
        category: "Bebidas",
        brand: "Crystal",
        unit: "litro",
        averagePrice: 2.99,
        barcode: "1234567890140",
        description: "Água mineral sem gás",
        active: true
      },
      {
        name: "Pão de Forma",
        category: "Padaria",
        brand: "Pullman",
        unit: "un",
        averagePrice: 10.90,
        barcode: "1234567890141",
        description: "Pão de forma integral",
        active: true
      },
      {
        name: "Biscoito Recheado",
        category: "Padaria",
        brand: "Bono",
        unit: "g",
        averagePrice: 3.49,
        barcode: "1234567890142",
        description: "Biscoito recheado com chocolate",
        active: true
      }
    ];

    sampleItems.forEach(item => db.insert(item));
    console.log("Sample items inserted");
  }
};

initializeItems();

const authenticate = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }
  }
  next();
};

app.get('/items', (req, res) => {
  try {
    const { category, name, brand } = req.query;
    let items = db.find();

    if (category) {
      items = items.filter(item =>
        item.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (name) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(name.toLowerCase())
      );
    }

    if (brand) {
      items = items.filter(item =>
        item.brand.toLowerCase().includes(brand.toLowerCase())
      );
    }

    res.json(items);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/items/:id', (req, res) => {
  try {
    const item = db.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/items', authenticate, (req, res) => {
  try {
    const { name, category, brand, unit, averagePrice, barcode, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const item = {
      name,
      category,
      brand: brand || '',
      unit: unit || 'un',
      averagePrice: averagePrice || 0,
      barcode: barcode || '',
      description: description || '',
      active: true
    };

    const savedItem = db.insert(item);
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/items/:id', authenticate, (req, res) => {
  try {
    const item = db.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates = { ...req.body };
    const updatedItem = db.update(item.id, updates);

    res.json(updatedItem);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/categories', (req, res) => {
  try {
    const items = db.find();
    const categories = [...new Set(items.map(item => item.category))];
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const items = db.find(item =>
      item.name.toLowerCase().includes(q.toLowerCase()) ||
      item.category.toLowerCase().includes(q.toLowerCase()) ||
      item.brand.toLowerCase().includes(q.toLowerCase()) ||
      item.description.toLowerCase().includes(q.toLowerCase())
    );

    res.json(items);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  serviceRegistry.markSuccess('item-service');
  res.json({ status: 'OK', service: 'item-service' });
});

app.listen(PORT, () => {
  console.log(`Item service running on port ${PORT}`);
});

process.on('SIGINT', () => {
  serviceRegistry.unregister('item-service');
  process.exit(0);
});
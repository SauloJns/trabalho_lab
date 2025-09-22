const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const jwt = require('jsonwebtoken');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ItemService {
    constructor() {
        this.app = express();
        this.port = 3002;
        this.serviceName = 'item-service';
        this.serviceUrl = `http://localhost:${this.port}`;
        this.jwtSecret = process.env.JWT_SECRET || 'item-service-secret';

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.seedInitialData();
    }

    setupDatabase() {
        this.itemsDb = new JsonDatabase(__dirname, 'items');
        this.categoriesDb = new JsonDatabase(__dirname, 'categories');
    }

    setupMiddleware() {
        this.app.use(express.json());
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({ 
                service: this.serviceName, 
                status: 'healthy',
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/items', this.getItems.bind(this));
    this.app.get('/items/search', this.searchItems.bind(this)); // agora vem antes
    this.app.get('/items/:id', this.getItem.bind(this)); // rota dinâmica vem depois
    this.app.post('/items', this.authMiddleware.bind(this), this.createItem.bind(this));
    this.app.put('/items/:id', this.authMiddleware.bind(this), this.updateItem.bind(this));
    this.app.get('/categories', this.getCategories.bind(this));

        // 🔧 Ajustado: rota de busca agora é /items/search
        this.app.get('/items/search', this.searchItems.bind(this));
    }

    authMiddleware(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token necessário' });
        }

        const token = authHeader.substring(7);

        try {
            jwt.verify(token, this.jwtSecret);
            next();
        } catch (error) {
            res.status(401).json({ success: false, message: 'Token inválido' });
        }
    }

    async seedInitialData() {
        setTimeout(async () => {
            const existingItems = await this.itemsDb.count();
            if (existingItems === 0) {
                console.log('🌱 Populando dados iniciais...');

                const categories = ['Alimentos', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria'];
                for (const category of categories) {
                    await this.categoriesDb.create({
                        id: uuidv4(),
                        name: category,
                        description: `Produtos de ${category}`
                    });
                }

                const items = [
                    { name: 'Arroz', category: 'Alimentos', brand: 'Tio João', unit: 'kg', averagePrice: 5.99 },
                    { name: 'Feijão', category: 'Alimentos', brand: 'Camil', unit: 'kg', averagePrice: 8.49 },
                    { name: 'Açúcar', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 4.29 },
                    { name: 'Óleo', category: 'Alimentos', brand: 'Liza', unit: 'litro', averagePrice: 7.99 },
                    { name: 'Macarrão', category: 'Alimentos', brand: 'Renata', unit: 'un', averagePrice: 3.29 },
                    { name: 'Detergente', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.49 },
                    { name: 'Sabão em Pó', category: 'Limpeza', brand: 'Omo', unit: 'kg', averagePrice: 12.99 },
                    { name: 'Desinfetante', category: 'Limpeza', brand: 'Veja', unit: 'litro', averagePrice: 6.99 },
                    { name: 'Sabonete', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 2.99 },
                    { name: 'Shampoo', category: 'Higiene', brand: 'Head & Shoulders', unit: 'un', averagePrice: 15.99 },
                    { name: 'Creme Dental', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 4.49 },
                    { name: 'Refrigerante', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 7.99 },
                    { name: 'Suco', category: 'Bebidas', brand: 'Del Valle', unit: 'litro', averagePrice: 6.49 },
                    { name: 'Água', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 2.99 },
                    { name: 'Café', category: 'Bebidas', brand: 'Melitta', unit: 'kg', averagePrice: 14.99 },
                    { name: 'Pão', category: 'Padaria', brand: 'Padaria', unit: 'un', averagePrice: 0.50 },
                    { name: 'Bolo', category: 'Padaria', brand: 'Padaria', unit: 'kg', averagePrice: 19.99 },
                    { name: 'Biscoito', category: 'Padaria', brand: 'Marilan', unit: 'un', averagePrice: 3.99 }
                ];

                for (const item of items) {
                    await this.itemsDb.create({
                        id: uuidv4(),
                        ...item,
                        active: true,
                        createdAt: new Date().toISOString()
                    });
                }

                console.log('✅ Dados iniciais populados!');
            }
        }, 1000);
    }

    async getItems(req, res) {
        try {
            const { category, page = 1, limit = 10 } = req.query;
            const filter = { active: true };
            
            if (category) filter.category = category;

            const items = await this.itemsDb.find(filter, {
                skip: (page - 1) * limit,
                limit: parseInt(limit)
            });

            const total = await this.itemsDb.count(filter);

            res.json({
                success: true,
                data: items,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) }
            });

        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async getItem(req, res) {
        try {
            const { id } = req.params;
            const item = await this.itemsDb.findById(id);

            if (!item) {
                return res.status(404).json({ success: false, message: 'Item não encontrado' });
            }

            res.json({ success: true, data: item });

        } catch (error) {
            console.error('Erro ao buscar item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async createItem(req, res) {
        try {
            const { name, category, brand, unit, averagePrice } = req.body;

            if (!name || !category || !unit || !averagePrice) {
                return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando' });
            }

            const item = await this.itemsDb.create({
                id: uuidv4(),
                name,
                category,
                brand,
                unit,
                averagePrice,
                active: true,
                createdAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso',
                data: item
            });

        } catch (error) {
            console.error('Erro ao criar item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async updateItem(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const item = await this.itemsDb.update(id, updates);

            if (!item) {
                return res.status(404).json({ success: false, message: 'Item não encontrado' });
            }

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: item
            });

        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async getCategories(req, res) {
        try {
            const categories = await this.categoriesDb.find();
            res.json({ success: true, data: categories });
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async searchItems(req, res) {
        try {
            const { q } = req.query;

            if (!q) {
                return res.status(400).json({ success: false, message: 'Termo de busca obrigatório' });
            }

            const items = await this.itemsDb.search(q, ['name', 'category', 'brand']);
            const activeItems = items.filter(item => item.active);

            res.json({
                success: true,
                data: {
                    query: q,
                    results: activeItems,
                    total: activeItems.length
                }
            });

        } catch (error) {
            console.error('Erro na busca:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 Item Service rodando na porta ${this.port}`);
            
            serviceRegistry.register(this.serviceName, {
                url: this.serviceUrl,
                version: '1.0.0',
                endpoints: ['/items', '/items/:id', '/categories', '/items/search']
            });
        });
    }
}

const itemService = new ItemService();
itemService.start();

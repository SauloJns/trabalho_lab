const express = require('express');
const { v4: uuidv4 } = require('uuid');
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
        this.app.use(express.urlencoded({ extended: true }));
        
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
        });
    }

    setupRoutes() {
       this.app.get('/health', async (req, res) => {
    try {
        const itemCount = await this.itemsDb.count();
        const categoryCount = await this.categoriesDb.count();
        
        res.json({ 
            service: this.serviceName, 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                items: itemCount,
                categories: categoryCount
            }
        });
    } catch (error) {
        res.json({ 
            service: this.serviceName, 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                items: 0,
                categories: 0
            }
        });
    }
});
this.app.get('/categories', this.getCategories.bind(this));
        
        this.app.get('/items', this.getItems.bind(this));
        this.app.get('/items/search', this.searchItems.bind(this));
        this.app.get('/items/:id', this.getItem.bind(this));
        this.app.post('/items', this.authMiddleware.bind(this), this.createItem.bind(this));
        this.app.put('/items/:id', this.authMiddleware.bind(this), this.updateItem.bind(this));

        this.app.get('/', (req, res) => {
            res.json({
                service: 'Item Service',
                version: '1.0.0',
                description: 'Microsserviço para gerenciamento de catálogo de produtos',
                endpoints: [
                    'GET /items - Listar itens',
                    'GET /items/:id - Buscar item específico',
                    'GET /items/search?q=termo - Buscar itens',
                    'GET /categories - Listar categorias',
                    'POST /items - Criar item (auth)',
                    'PUT /items/:id - Atualizar item (auth)'
                ]
            });
        });

        this.app.options('*', (req, res) => {
            res.sendStatus(200);
        });
    }

    authMiddleware(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'Token de autenticação necessário' });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Token mal formatado' });
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            next();
        } catch (error) {
            console.error('❌ Erro na validação do token:', error.message);
            res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
        }
    }

    async seedInitialData() {
        setTimeout(async () => {
            try {
                const existingItems = await this.itemsDb.count();
                if (existingItems === 0) {
                    console.log('🌱 Populando dados iniciais do Item Service...');

                    const categories = [
                        { name: 'Alimentos', description: 'Produtos alimentícios em geral' },
                        { name: 'Limpeza', description: 'Produtos de limpeza doméstica' },
                        { name: 'Higiene', description: 'Produtos de higiene pessoal' },
                        { name: 'Bebidas', description: 'Bebidas diversas' },
                        { name: 'Padaria', description: 'Produtos de padaria' }
                    ];

                    for (const category of categories) {
                        await this.categoriesDb.create({
                            id: uuidv4(),
                            ...category,
                            createdAt: new Date().toISOString()
                        });
                    }

                    const items = [
                        { name: 'Arroz', category: 'Alimentos', brand: 'Tio João', unit: 'kg', averagePrice: 5.99, barcode: '1234567890123' },
                        { name: 'Feijão', category: 'Alimentos', brand: 'Camil', unit: 'kg', averagePrice: 8.49, barcode: '1234567890124' },
                        { name: 'Açúcar', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 4.29, barcode: '1234567890125' },
                        { name: 'Óleo de Soja', category: 'Alimentos', brand: 'Liza', unit: 'litro', averagePrice: 7.99, barcode: '1234567890126' },
                        { name: 'Macarrão', category: 'Alimentos', brand: 'Renata', unit: 'un', averagePrice: 3.29, barcode: '1234567890127' },
                        { name: 'Detergente', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.49, barcode: '1234567890128' },
                        { name: 'Sabão em Pó', category: 'Limpeza', brand: 'Omo', unit: 'kg', averagePrice: 12.99, barcode: '1234567890129' },
                        { name: 'Desinfetante', category: 'Limpeza', brand: 'Veja', unit: 'litro', averagePrice: 6.99, barcode: '1234567890130' },
                        { name: 'Sabonete', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 2.99, barcode: '1234567890131' },
                        { name: 'Shampoo', category: 'Higiene', brand: 'Head & Shoulders', unit: 'un', averagePrice: 15.99, barcode: '1234567890132' },
                        { name: 'Creme Dental', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 4.49, barcode: '1234567890133' },
                        { name: 'Refrigerante', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 7.99, barcode: '1234567890134' },
                        { name: 'Suco de Laranja', category: 'Bebidas', brand: 'Del Valle', unit: 'litro', averagePrice: 6.49, barcode: '1234567890135' },
                        { name: 'Água Mineral', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 2.99, barcode: '1234567890136' },
                        { name: 'Café', category: 'Bebidas', brand: 'Melitta', unit: 'kg', averagePrice: 14.99, barcode: '1234567890137' },
                        { name: 'Pão Francês', category: 'Padaria', brand: 'Padaria', unit: 'un', averagePrice: 0.50, barcode: '1234567890138' },
                        { name: 'Bolo', category: 'Padaria', brand: 'Padaria', unit: 'kg', averagePrice: 19.99, barcode: '1234567890139' },
                        { name: 'Biscoito', category: 'Padaria', brand: 'Marilan', unit: 'un', averagePrice: 3.99, barcode: '1234567890140' }
                    ];

                    for (const item of items) {
                        await this.itemsDb.create({
                            id: uuidv4(),
                            ...item,
                            active: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }

                    console.log('✅ Dados iniciais populados!');
                    console.log(`   📦 ${items.length} itens criados`);
                    console.log(`   📁 ${categories.length} categorias criadas`);
                }
            } catch (error) {
                console.error('❌ Erro ao popular dados iniciais:', error);
            }
        }, 2000);
    }

    async getItems(req, res) {
        try {
            const { category, page = 1, limit = 10, search } = req.query;
            let filter = { active: true };
            
            if (category) filter.category = category;
            if (search) {
                const items = await this.itemsDb.search(search, ['name', 'category', 'brand']);
                const activeItems = items.filter(item => item.active);
                
                return res.json({
                    success: true,
                    data: activeItems,
                    items: activeItems,
                    total: activeItems.length,
                    message: 'Busca realizada com sucesso'
                });
            }

            const items = await this.itemsDb.find(filter, {
                skip: (page - 1) * limit,
                limit: parseInt(limit),
                sort: { name: 1 }
            });

            const total = await this.itemsDb.count(filter);

            res.json({
                success: true,
                data: items,
                items: items,
                pagination: { 
                    page: parseInt(page), 
                    limit: parseInt(limit), 
                    total, 
                    pages: Math.ceil(total / limit) 
                },
                message: 'Itens recuperados com sucesso'
            });

        } catch (error) {
            console.error('❌ Erro ao buscar itens:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor',
                error: error.message 
            });
        }
    }

    async getItem(req, res) {
        try {
            const { id } = req.params;
            const item = await this.itemsDb.findById(id);

            if (!item) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não encontrado' 
                });
            }

            if (!item.active) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não está disponível' 
                });
            }

            res.json({ 
                success: true, 
                data: item,
                message: 'Item encontrado com sucesso'
            });

        } catch (error) {
            console.error('❌ Erro ao buscar item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async createItem(req, res) {
        try {
            const { name, category, brand, unit, averagePrice, barcode, description } = req.body;

            if (!name || !category || !unit || !averagePrice) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Campos obrigatórios: name, category, unit, averagePrice' 
                });
            }

            const existingItem = await this.itemsDb.findOne({ name: new RegExp(name, 'i') });
            if (existingItem) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Item com este nome já existe' 
                });
            }

            const item = await this.itemsDb.create({
                id: uuidv4(),
                name,
                category,
                brand: brand || 'Genérico',
                unit,
                averagePrice: parseFloat(averagePrice),
                barcode: barcode || '',
                description: description || '',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Novo item criado:', item.name);

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso',
                data: item
            });

        } catch (error) {
            console.error('❌ Erro ao criar item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async updateItem(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const existingItem = await this.itemsDb.findById(id);
            if (!existingItem) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não encontrado' 
                });
            }

            const item = await this.itemsDb.update(id, {
                ...updates,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: item
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async getCategories(req, res) {
    try {
        const categories = await this.categoriesDb.find({}, { sort: { name: 1 } });
        
        res.json({ 
            success: true, 
            data: categories,
            categories: categories,
            total: categories.length,
            message: 'Categorias recuperadas com sucesso'
        });

    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor',
            error: error.message 
        });
    }
}

    async searchItems(req, res) {
        try {
            const { q } = req.query;

            if (!q || q.trim() === '') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Parâmetro de busca "q" é obrigatório' 
                });
            }

            console.log('🔍 Buscando itens por:', q);

            const items = await this.itemsDb.search(q, ['name', 'category', 'brand', 'description']);
            const activeItems = items.filter(item => item.active);

            res.json({
                success: true,
                data: {
                    query: q,
                    results: activeItems,
                    total: activeItems.length
                },
                results: activeItems,
                total: activeItems.length,
                message: `Busca realizada: ${activeItems.length} resultados encontrados`
            });

        } catch (error) {
            console.error('❌ Erro na busca:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`🚀 Item Service rodando na porta ${this.port}`);
            console.log(`📍 URL: ${this.serviceUrl}`);
            console.log(`❤️ Health: ${this.serviceUrl}/health`);
            console.log('=====================================');
            
            setTimeout(() => {
                serviceRegistry.register(this.serviceName, {
                    url: this.serviceUrl,
                    version: '1.0.0',
                    endpoints: [
                        '/items', 
                        '/items/:id', 
                        '/items/search',
                        '/categories',
                        '/health'
                    ]
                });
            }, 2000);
        });
    }
}

process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando Item Service...');
    serviceRegistry.unregister('item-service');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando Item Service...');
    serviceRegistry.unregister('item-service');
    process.exit(0);
});

const itemService = new ItemService();
itemService.start();
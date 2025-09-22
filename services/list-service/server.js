const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ListService {
    constructor() {
        this.app = express();
        this.port = 3003;
        this.serviceName = 'list-service';
        this.serviceUrl = `http://localhost:${this.port}`;
        this.jwtSecret = 'microservices-secret-key-2024'; 

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDatabase() {
        this.listsDb = new JsonDatabase(__dirname, 'lists');
        console.log('📁 List Service: Banco NoSQL inicializado');
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
                const listCount = await this.listsDb.count();
                res.json({ 
                    service: this.serviceName, 
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    database: { 
                        type: 'JSON-NoSQL', 
                        listCount: listCount 
                    }
                });
            } catch (error) {
                res.status(503).json({ 
                    service: this.serviceName, 
                    status: 'unhealthy', 
                    error: error.message 
                });
            }
        });

        this.app.get('/', (req, res) => {
            res.json({
                service: 'List Service',
                version: '1.0.0',
                description: 'Microsserviço para gerenciamento de listas de compras',
                endpoints: [
                    'POST /lists',
                    'GET /lists',
                    'GET /lists/:id',
                    'PUT /lists/:id',
                    'DELETE /lists/:id',
                    'POST /lists/:id/items',
                    'PUT /lists/:id/items/:itemId',
                    'DELETE /lists/:id/items/:itemId',
                    'GET /lists/:id/summary',
                    'GET /search'
                ]
            });
        });

        this.app.options('*', (req, res) => {
            res.sendStatus(200);
        });

        this.app.use(this.authMiddleware.bind(this));

        this.app.post('/lists', this.createList.bind(this));
        this.app.get('/lists', this.getLists.bind(this));
        this.app.get('/lists/:id', this.getList.bind(this));
        this.app.put('/lists/:id', this.updateList.bind(this));
        this.app.delete('/lists/:id', this.deleteList.bind(this));
        this.app.get('/search', this.searchLists.bind(this));

        this.app.post('/lists/:id/items', this.addItem.bind(this));
        this.app.put('/lists/:id/items/:itemId', this.updateItem.bind(this));
        this.app.delete('/lists/:id/items/:itemId', this.removeItem.bind(this));
        this.app.get('/lists/:id/summary', this.getSummary.bind(this));
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({ 
                success: false, 
                message: 'Endpoint não encontrado',
                service: this.serviceName 
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('❌ List Service Error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do serviço',
                service: this.serviceName 
            });
        });
    }

    authMiddleware(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token de autenticação necessário' 
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token mal formatado' 
            });
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            console.log('🔐 Usuário autenticado:', decoded.email);
            next();
        } catch (error) {
            console.error('❌ Erro na validação do token:', error.message);
            res.status(401).json({ 
                success: false, 
                message: 'Token inválido ou expirado' 
            });
        }
    }

    async createList(req, res) {
        try {
            const { name, description } = req.body;

            console.log('🛒 Criando lista para usuário:', req.user.id);

            if (!name) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nome da lista é obrigatório' 
                });
            }

            const list = await this.listsDb.create({
                id: uuidv4(),
                userId: req.user.id,
                name,
                description: description || '',
                status: 'active',
                items: [],
                summary: { 
                    totalItems: 0, 
                    purchasedItems: 0, 
                    estimatedTotal: 0 
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Lista criada:', list.id);

            res.status(201).json({
                success: true,
                message: 'Lista criada com sucesso',
                data: list
            });

        } catch (error) {
            console.error('❌ Erro ao criar lista:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async getLists(req, res) {
        try {
            console.log('📋 Buscando listas do usuário:', req.user.id);
            
            const lists = await this.listsDb.find({ 
                userId: req.user.id 
            }, {
                sort: { updatedAt: -1 }
            });

            res.json({ 
                success: true, 
                data: lists 
            });

        } catch (error) {
            console.error('❌ Erro ao buscar listas:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async getList(req, res) {
        try {
            const { id } = req.params;
            
            console.log('👀 Buscando lista:', id, 'para usuário:', req.user.id);

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado a esta lista' 
                });
            }

            res.json({ 
                success: true, 
                data: list 
            });

        } catch (error) {
            console.error('❌ Erro ao buscar lista:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async updateList(req, res) {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;

            console.log('✏️ Atualizando lista:', id);

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            const updates = {
                updatedAt: new Date().toISOString()
            };
            if (name) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (status) updates.status = status;

            const updatedList = await this.listsDb.update(id, updates);

            res.json({
                success: true,
                message: 'Lista atualizada com sucesso',
                data: updatedList
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar lista:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async deleteList(req, res) {
        try {
            const { id } = req.params;

            console.log('🗑️ Deletando lista:', id);

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            await this.listsDb.delete(id);

            res.json({ 
                success: true, 
                message: 'Lista deletada com sucesso' 
            });

        } catch (error) {
            console.error('❌ Erro ao deletar lista:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async searchLists(req, res) {
        try {
            const { q } = req.query;

            console.log('🔍 Buscando listas por:', q);

            if (!q) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Parâmetro de busca "q" é obrigatório' 
                });
            }

            const lists = await this.listsDb.find({ 
                userId: req.user.id 
            });

            const searchTerm = q.toLowerCase();
            const results = lists.filter(list => 
                list.name.toLowerCase().includes(searchTerm) ||
                (list.description && list.description.toLowerCase().includes(searchTerm)) ||
                list.items.some(item => 
                    item.itemName && item.itemName.toLowerCase().includes(searchTerm)
                )
            );

            res.json({
                success: true,
                data: {
                    query: q,
                    results: results,
                    total: results.length
                }
            });

        } catch (error) {
            console.error('❌ Erro na busca de listas:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async addItem(req, res) {
        try {
            const { id } = req.params;
            const { itemId, quantity, notes } = req.body;

            console.log('📦 Adicionando item à lista:', { listId: id, itemId, quantity });

            if (!itemId || !quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'itemId e quantity são obrigatórios' 
                });
            }

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            let itemInfo;
            try {
                const itemService = serviceRegistry.discover('item-service');
                const response = await axios.get(`${itemService.url}/items/${itemId}`, {
                    timeout: 5000
                });
                
                if (response.data.success) {
                    itemInfo = response.data.data;
                } else {
                    throw new Error('Item não encontrado');
                }
            } catch (error) {
                console.error('❌ Erro ao buscar item:', error.message);
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não encontrado no catálogo' 
                });
            }

            const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);

            if (existingItemIndex !== -1) {
                list.items[existingItemIndex].quantity += parseFloat(quantity);
                list.items[existingItemIndex].updatedAt = new Date().toISOString();
                if (notes) list.items[existingItemIndex].notes = notes;
            } else {
                list.items.push({
                    itemId,
                    itemName: itemInfo.name,
                    quantity: parseFloat(quantity),
                    unit: itemInfo.unit,
                    estimatedPrice: itemInfo.averagePrice,
                    purchased: false,
                    notes: notes || '',
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            this.calculateSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Item adicionado/atualizado na lista');

            res.json({
                success: true,
                message: 'Item adicionado à lista com sucesso',
                data: updatedList
            });

        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async updateItem(req, res) {
        try {
            const { id, itemId } = req.params;
            const { quantity, purchased, notes } = req.body;

            console.log('✏️ Atualizando item na lista:', { listId: id, itemId });

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            const itemIndex = list.items.findIndex(item => item.itemId === itemId);
            if (itemIndex === -1) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não encontrado na lista' 
                });
            }

            if (quantity !== undefined) list.items[itemIndex].quantity = parseFloat(quantity);
            if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
            if (notes !== undefined) list.items[itemIndex].notes = notes;
            list.items[itemIndex].updatedAt = new Date().toISOString();

            this.calculateSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: updatedList
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async removeItem(req, res) {
        try {
            const { id, itemId } = req.params;

            console.log('🗑️ Removendo item da lista:', { listId: id, itemId });

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            const filteredItems = list.items.filter(item => item.itemId !== itemId);

            if (filteredItems.length === list.items.length) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Item não encontrado na lista' 
                });
            }

            list.items = filteredItems;
            this.calculateSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item removido da lista com sucesso',
                data: updatedList
            });

        } catch (error) {
            console.error('❌ Erro ao remover item:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async getSummary(req, res) {
        try {
            const { id } = req.params;

            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Lista não encontrada' 
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            res.json({ 
                success: true, 
                data: list.summary 
            });

        } catch (error) {
            console.error('❌ Erro ao buscar resumo:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    calculateSummary(list) {
        const summary = {
            totalItems: 0,
            purchasedItems: 0,
            estimatedTotal: 0
        };

        list.items.forEach(item => {
            summary.totalItems += item.quantity;
            if (item.purchased) {
                summary.purchasedItems += item.quantity;
            }
            summary.estimatedTotal += item.quantity * item.estimatedPrice;
        });

        list.summary = summary;
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`🚀 List Service rodando na porta ${this.port}`);
            console.log(`📍 URL: ${this.serviceUrl}`);
            console.log(`❤️ Health: ${this.serviceUrl}/health`);
            console.log('=====================================');
            
            setTimeout(() => {
                serviceRegistry.register(this.serviceName, {
                    url: this.serviceUrl,
                    version: '1.0.0',
                    endpoints: [
                        '/lists', 
                        '/lists/:id', 
                        '/lists/:id/items', 
                        '/lists/:id/summary',
                        '/search'
                    ]
                });
            }, 1000);
        });
    }
}

const listService = new ListService();
listService.start();

 
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando List Service...');
    serviceRegistry.unregister('list-service');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando List Service...');
    serviceRegistry.unregister('list-service');
    process.exit(0);
});
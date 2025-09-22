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
this.jwtSecret = 'microservices-secret-key-2024'
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupDatabase() {
        this.listsDb = new JsonDatabase(__dirname, 'lists');
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

        this.app.use(this.authMiddleware.bind(this));

        this.app.post('/lists', this.createList.bind(this));
        this.app.get('/lists', this.getLists.bind(this));
        this.app.get('/lists/:id', this.getList.bind(this));
        this.app.put('/lists/:id', this.updateList.bind(this));
        this.app.delete('/lists/:id', this.deleteList.bind(this));
        this.app.post('/lists/:id/items', this.addItem.bind(this));
        this.app.put('/lists/:id/items/:itemId', this.updateItem.bind(this));
        this.app.delete('/lists/:id/items/:itemId', this.removeItem.bind(this));
        this.app.get('/lists/:id/summary', this.getSummary.bind(this));
        this.app.get('/search', this.searchLists.bind(this));
    }

    authMiddleware(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token necessário' });
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ success: false, message: 'Token inválido' });
        }
    }

    async createList(req, res) {
        try {
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: 'Nome da lista é obrigatório' });
            }

            const list = await this.listsDb.create({
                id: uuidv4(),
                userId: req.user.id,
                name,
                description: description || '',
                status: 'active',
                items: [],
                summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Lista criada com sucesso',
                data: list
            });

        } catch (error) {
            console.error('Erro ao criar lista:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async getLists(req, res) {
        try {
            const lists = await this.listsDb.find({ userId: req.user.id });
            res.json({ success: true, data: lists });
        } catch (error) {
            console.error('Erro ao buscar listas:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async getList(req, res) {
        try {
            const { id } = req.params;
            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            res.json({ success: true, data: list });
        } catch (error) {
            console.error('Erro ao buscar lista:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async updateList(req, res) {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;

            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            const updates = {};
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
            console.error('Erro ao atualizar lista:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async deleteList(req, res) {
        try {
            const { id } = req.params;
            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            await this.listsDb.delete(id);

            res.json({ success: true, message: 'Lista deletada com sucesso' });

        } catch (error) {
            console.error('Erro ao deletar lista:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async addItem(req, res) {
        try {
            const { id } = req.params;
            const { itemId, quantity, notes } = req.body;

            if (!itemId || !quantity) {
                return res.status(400).json({ success: false, message: 'itemId e quantity são obrigatórios' });
            }

            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            let itemInfo;
            try {
                const itemService = serviceRegistry.discover('item-service');
                const response = await axios.get(`${itemService.url}/items/${itemId}`);
                itemInfo = response.data.data;
            } catch (error) {
                return res.status(404).json({ success: false, message: 'Item não encontrado no catálogo' });
            }

            const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);

            if (existingItemIndex !== -1) {
                list.items[existingItemIndex].quantity += parseFloat(quantity);
            } else {
                list.items.push({
                    itemId,
                    itemName: itemInfo.name,
                    quantity: parseFloat(quantity),
                    unit: itemInfo.unit,
                    estimatedPrice: itemInfo.averagePrice,
                    purchased: false,
                    notes: notes || '',
                    addedAt: new Date().toISOString()
                });
            }

            this.calculateSummary(list);
            const updatedList = await this.listsDb.update(id, list);

            res.json({
                success: true,
                message: 'Item adicionado à lista',
                data: updatedList
            });

        } catch (error) {
            console.error('Erro ao adicionar item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async updateItem(req, res) {
        try {
            const { id, itemId } = req.params;
            const { quantity, purchased, notes } = req.body;

            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            const itemIndex = list.items.findIndex(item => item.itemId === itemId);

            if (itemIndex === -1) {
                return res.status(404).json({ success: false, message: 'Item não encontrado na lista' });
            }

            if (quantity !== undefined) list.items[itemIndex].quantity = quantity;
            if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
            if (notes !== undefined) list.items[itemIndex].notes = notes;

            this.calculateSummary(list);
            const updatedList = await this.listsDb.update(id, list);

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: updatedList
            });

        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async removeItem(req, res) {
        try {
            const { id, itemId } = req.params;
            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            list.items = list.items.filter(item => item.itemId !== itemId);
            this.calculateSummary(list);
            const updatedList = await this.listsDb.update(id, list);

            res.json({
                success: true,
                message: 'Item removido da lista',
                data: updatedList
            });

        } catch (error) {
            console.error('Erro ao remover item:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async getSummary(req, res) {
        try {
            const { id } = req.params;
            const list = await this.listsDb.findById(id);

            if (!list || list.userId !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Lista não encontrada' });
            }

            res.json({ success: true, data: list.summary });

        } catch (error) {
            console.error('Erro ao buscar resumo:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
        }
    }

    async searchLists(req, res) {
        try {
            const { q } = req.query;
            const lists = await this.listsDb.find({ userId: req.user.id });

            const results = lists.filter(list => 
                list.name.toLowerCase().includes(q.toLowerCase()) ||
                list.description.toLowerCase().includes(q.toLowerCase()) ||
                list.items.some(item => item.itemName.toLowerCase().includes(q.toLowerCase()))
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
            console.error('Erro na busca:', error);
            res.status(500).json({ success: false, message: 'Erro interno' });
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
        list.updatedAt = new Date().toISOString();
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 List Service rodando na porta ${this.port}`);
            
            serviceRegistry.register(this.serviceName, {
                url: this.serviceUrl,
                version: '1.0.0',
                endpoints: ['/lists', '/lists/:id', '/lists/:id/items', '/lists/:id/summary', '/search']
            });
        });
    }
}

const listService = new ListService();
listService.start();
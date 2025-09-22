const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const serviceRegistry = require('../shared/serviceRegistry');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = 3000;
        this.circuitBreakers = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                service: 'api-gateway',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: services
            });
        });

        this.app.get('/registry', (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({ success: true, services });
        });

        this.app.use('/api/auth', this.proxyToService('user-service'));
        this.app.use('/api/users', this.proxyToService('user-service'));
        this.app.use('/api/items', this.proxyToService('item-service'));
        this.app.use('/api/lists', this.proxyToService('list-service'));

        this.app.get('/api/dashboard', this.getDashboard.bind(this));
        this.app.get('/api/search', this.globalSearch.bind(this));
    }

    proxyToService(serviceName) {
        return async (req, res) => {
            try {
                if (this.isCircuitOpen(serviceName)) {
                    return res.status(503).json({
                        success: false,
                        message: `Serviço ${serviceName} temporariamente indisponível`
                    });
                }

                const service = serviceRegistry.discover(serviceName);
                let targetPath = req.originalUrl;

                if (serviceName === 'user-service') {
                    targetPath = targetPath.replace('/api/auth', '/auth').replace('/api/users', '/users');
                } else if (serviceName === 'item-service') {
                    targetPath = targetPath.replace('/api/items', '/items');
                } else if (serviceName === 'list-service') {
                    targetPath = targetPath.replace('/api/lists', '/lists');
                }

                const url = `${service.url}${targetPath}`;
                const config = {
                    method: req.method,
                    url: url,
                    headers: { ...req.headers },
                    data: req.body,
                    timeout: 10000
                };

                delete config.headers.host;

                const response = await axios(config);
                this.resetCircuitBreaker(serviceName);

                res.status(response.status).json(response.data);

            } catch (error) {
                this.recordFailure(serviceName);

                if (error.response) {
                    res.status(error.response.status).json(error.response.data);
                } else {
                    res.status(503).json({
                        success: false,
                        message: `Serviço ${serviceName} indisponível`,
                        error: error.message
                    });
                }
            }
        };
    }

    async getDashboard(req, res) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                return res.status(401).json({ success: false, message: 'Token necessário' });
            }

            const [userResponse, itemsResponse, listsResponse] = await Promise.allSettled([
                this.callService('user-service', '/auth/validate', 'POST', authHeader, { token: authHeader.split(' ')[1] }),
                this.callService('item-service', '/items?limit=5', 'GET'),
                this.callService('list-service', '/lists', 'GET', authHeader)
            ]);

            const dashboard = {
                user: userResponse.status === 'fulfilled' ? userResponse.value.data : null,
                recentItems: itemsResponse.status === 'fulfilled' ? itemsResponse.value.data : null,
                userLists: listsResponse.status === 'fulfilled' ? listsResponse.value.data : null,
                timestamp: new Date().toISOString()
            };

            res.json({ success: true, data: dashboard });

        } catch (error) {
            console.error('Erro no dashboard:', error);
            res.status(500).json({ success: false, message: 'Erro ao carregar dashboard' });
        }
    }

    async globalSearch(req, res) {
        try {
            const { q } = req.query;
            const authHeader = req.headers.authorization;

            if (!q) {
                return res.status(400).json({ success: false, message: 'Parâmetro "q" obrigatório' });
            }

            const [itemsResponse, listsResponse] = await Promise.allSettled([
                this.callService('item-service', `/search?q=${encodeURIComponent(q)}`, 'GET'),
                authHeader ? this.callService('list-service', `/search?q=${encodeURIComponent(q)}`, 'GET', authHeader) : Promise.resolve({ data: [] })
            ]);

            const results = {
                items: itemsResponse.status === 'fulfilled' ? itemsResponse.value.data : { results: [], total: 0 },
                lists: listsResponse.status === 'fulfilled' ? listsResponse.value.data : { results: [], total: 0 }
            };

            res.json({ success: true, data: results });

        } catch (error) {
            console.error('Erro na busca global:', error);
            res.status(500).json({ success: false, message: 'Erro na busca' });
        }
    }

    async callService(serviceName, path, method, authHeader = null, data = null) {
        const service = serviceRegistry.discover(serviceName);
        const config = {
            method,
            url: `${service.url}${path}`,
            timeout: 5000
        };

        if (authHeader) {
            config.headers = { Authorization: authHeader };
        }

        if (data && method !== 'GET') {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    }

    isCircuitOpen(serviceName) {
        const breaker = this.circuitBreakers.get(serviceName);
        if (!breaker) return false;

        if (breaker.isOpen && (Date.now() - breaker.lastFailure) > 30000) {
            breaker.isOpen = false;
            breaker.failures = 0;
            return false;
        }

        return breaker.isOpen;
    }

    recordFailure(serviceName) {
        let breaker = this.circuitBreakers.get(serviceName) || { failures: 0, isOpen: false, lastFailure: null };
        
        breaker.failures++;
        breaker.lastFailure = Date.now();

        if (breaker.failures >= 3) {
            breaker.isOpen = true;
        }

        this.circuitBreakers.set(serviceName, breaker);
    }

    resetCircuitBreaker(serviceName) {
        const breaker = this.circuitBreakers.get(serviceName);
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
        }
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({ success: false, message: 'Endpoint não encontrado' });
        });

        this.app.use((error, req, res, next) => {
            console.error('Gateway Error:', error);
            res.status(500).json({ success: false, message: 'Erro interno do gateway' });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`🚀 API Gateway rodando na porta ${this.port}`);
            console.log(`📍 Health: http://localhost:${this.port}/health`);
            console.log(`📋 Registry: http://localhost:${this.port}/registry`);
            console.log('=====================================');
        });
    }
}

const gateway = new APIGateway();
gateway.start();
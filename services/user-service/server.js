const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class UserService {
    constructor() {
        this.app = express();
        this.port = 3001;
        this.serviceName = 'user-service';
        this.serviceUrl = `http://localhost:${this.port}`;
        this.jwtSecret = 'microservices-secret-key-2024'; 

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.seedInitialData();
    }

    setupDatabase() {
        this.usersDb = new JsonDatabase(__dirname, 'users');
        console.log('📁 User Service: Banco NoSQL inicializado');
    }

    async seedInitialData() {
        setTimeout(async () => {
            try {
                const existingUsers = await this.usersDb.find();
                if (existingUsers.length === 0) {
                    const adminPassword = await bcrypt.hash('admin123', 12);
                    await this.usersDb.create({
                        id: uuidv4(),
                        email: 'admin@compras.com',
                        username: 'admin',
                        password: adminPassword,
                        firstName: 'Administrador',
                        lastName: 'Sistema',
                        preferences: { defaultStore: 'Mercado Central', currency: 'BRL' },
                        role: 'admin',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    console.log('👤 Usuário administrador criado (admin@compras.com / admin123)');
                }
            } catch (error) {
                console.error('❌ Erro ao criar dados iniciais:', error);
            }
        }, 2000);
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
                const userCount = await this.usersDb.count();
                res.json({ 
                    service: this.serviceName, 
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    database: { 
                        type: 'JSON-NoSQL', 
                        userCount: userCount 
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
                service: 'User Service',
                version: '1.0.0',
                description: 'Microsserviço para gerenciamento de usuários',
                endpoints: [
                    'POST /auth/register',
                    'POST /auth/login', 
                    'POST /auth/validate',
                    'GET /users/:id',
                    'PUT /users/:id'
                ]
            });
        });

        this.app.options('*', (req, res) => {
            res.sendStatus(200);
        });

        this.app.post('/auth/register', this.register.bind(this));
        this.app.post('/auth/login', this.login.bind(this));
        this.app.post('/auth/validate', this.validateToken.bind(this));
        this.app.get('/users/:id', this.authMiddleware.bind(this), this.getUser.bind(this));
        this.app.put('/users/:id', this.authMiddleware.bind(this), this.updateUser.bind(this));
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
            console.error('❌ User Service Error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do serviço',
                service: this.serviceName 
            });
        });
    }

    async register(req, res) {
        try {
            const { email, username, password, firstName, lastName, preferences } = req.body;

            console.log('📝 Tentativa de registro:', { email, username });

            if (!email || !username || !password || !firstName || !lastName) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Todos os campos obrigatórios: email, username, password, firstName, lastName' 
                });
            }

            const existingUser = await this.usersDb.findOne({ 
                $or: [
                    { email: email.toLowerCase() }, 
                    { username: username.toLowerCase() }
                ] 
            });

            if (existingUser) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Usuário já existe com este email ou username' 
                });
            }

            const hashedPassword = await bcrypt.hash(password, 12);
            const user = await this.usersDb.create({
                id: uuidv4(),
                email: email.toLowerCase(),
                username: username.toLowerCase(),
                password: hashedPassword,
                firstName,
                lastName,
                preferences: preferences || { 
                    defaultStore: 'Mercado Central', 
                    currency: 'BRL' 
                },
                role: 'user',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    username: user.username,
                    role: user.role 
                },
                this.jwtSecret,
                { expiresIn: '24h' }
            );

            const { password: _, ...userWithoutPassword } = user;

            console.log('✅ Usuário registrado com sucesso:', user.email);

            res.status(201).json({
                success: true,
                message: 'Usuário criado com sucesso',
                data: { 
                    user: userWithoutPassword, 
                    token: token 
                }
            });

        } catch (error) {
            console.error('❌ Erro no registro:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async login(req, res) {
        try {
            const { identifier, password } = req.body;

            console.log('🔐 Tentativa de login:', identifier);

            if (!identifier || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email/username e senha são obrigatórios' 
                });
            }

            const user = await this.usersDb.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() }
                ]
            });

            if (!user) {
                console.log('❌ Usuário não encontrado:', identifier);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Credenciais inválidas' 
                });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                console.log('❌ Senha inválida para:', identifier);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Credenciais inválidas' 
                });
            }

            if (user.status !== 'active') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Conta desativada' 
                });
            }

            await this.usersDb.update(user.id, { 
                updatedAt: new Date().toISOString() 
            });

            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    username: user.username,
                    role: user.role 
                },
                this.jwtSecret,
                { expiresIn: '24h' }
            );

            const { password: _, ...userWithoutPassword } = user;

            console.log('✅ Login realizado com sucesso:', user.email);

            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: { 
                    user: userWithoutPassword, 
                    token: token 
                }
            });

        } catch (error) {
            console.error('❌ Erro no login:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async validateToken(req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Token é obrigatório' 
                });
            }

            console.log('🔍 Validando token...');

            const decoded = jwt.verify(token, this.jwtSecret);
            const user = await this.usersDb.findById(decoded.id);

            if (!user || user.status !== 'active') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Usuário não encontrado ou inativo' 
                });
            }

            const { password: _, ...userWithoutPassword } = user;

            console.log('✅ Token válido para:', user.email);

            res.json({ 
                success: true, 
                message: 'Token válido', 
                data: { user: userWithoutPassword } 
            });

        } catch (error) {
            console.error('❌ Token inválido:', error.message);
            res.status(401).json({ 
                success: false, 
                message: 'Token inválido ou expirado' 
            });
        }
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
            next();
        } catch (error) {
            console.error('❌ Erro na validação do token:', error.message);
            res.status(401).json({ 
                success: false, 
                message: 'Token inválido ou expirado' 
            });
        }
    }

    async getUser(req, res) {
        try {
            const { id } = req.params;

            console.log('👤 Buscando usuário:', id);

            if (req.user.id !== id && req.user.role !== 'admin') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            const user = await this.usersDb.findById(id);

            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }

            const { password: _, ...userWithoutPassword } = user;

            res.json({ 
                success: true, 
                data: userWithoutPassword 
            });

        } catch (error) {
            console.error('❌ Erro ao buscar usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { firstName, lastName, email, preferences } = req.body;

            console.log('✏️ Atualizando usuário:', id);

            if (req.user.id !== id && req.user.role !== 'admin') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acesso negado' 
                });
            }

            const user = await this.usersDb.findById(id);

            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuário não encontrado' 
                });
            }

            if (email && email !== user.email) {
                const existingUser = await this.usersDb.findOne({ 
                    email: email.toLowerCase() 
                });
                if (existingUser) {
                    return res.status(409).json({ 
                        success: false, 
                        message: 'Email já está em uso' 
                    });
                }
            }

            const updates = { 
                updatedAt: new Date().toISOString() 
            };
            if (firstName) updates.firstName = firstName;
            if (lastName) updates.lastName = lastName;
            if (email) updates.email = email.toLowerCase();
            if (preferences) updates.preferences = { 
                ...user.preferences, 
                ...preferences 
            };

            const updatedUser = await this.usersDb.update(id, updates);
            const { password: _, ...userWithoutPassword } = updatedUser;

            res.json({
                success: true,
                message: 'Usuário atualizado com sucesso',
                data: userWithoutPassword
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar usuário:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor' 
            });
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`🚀 User Service rodando na porta ${this.port}`);
            console.log(`📍 URL: ${this.serviceUrl}`);
            console.log(`❤️ Health: ${this.serviceUrl}/health`);
            console.log('=====================================');
            
            setTimeout(() => {
                serviceRegistry.register(this.serviceName, {
                    url: this.serviceUrl,
                    version: '1.0.0',
                    endpoints: [
                        '/auth/register', 
                        '/auth/login', 
                        '/auth/validate', 
                        '/users/:id'
                    ]
                });
            }, 1000);
        });
    }
}

const userService = new UserService();
userService.start();

process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando User Service...');
    serviceRegistry.unregister('user-service');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando User Service...');
    serviceRegistry.unregister('user-service');
    process.exit(0);
});
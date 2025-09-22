const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

class ClientDemo {
    constructor() {
        this.token = null;
        this.userId = null;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForServices() {
        console.log('⏳ Aguardando serviços ficarem disponíveis...');
        
        let attempts = 0;
        while (attempts < 30) {
            try {
                const response = await axios.get('http://localhost:3000/health');
                const services = response.data.services;
                
                if (Object.keys(services).length >= 3) {
                    console.log('✅ Todos os serviços estão disponíveis!');
                    return true;
                }
            } catch (error) {
                // Serviços ainda não estão prontos
            }
            
            attempts++;
            await this.delay(2000);
        }
        
        throw new Error('Timeout aguardando serviços');
    }

    async registerUser() {
        try {
            console.log('\n📝 Registrando novo usuário...');
            
            const userData = {
                email: 'demo@usuario.com',
                username: 'demouser',
                password: 'senha123',
                firstName: 'Demo',
                lastName: 'Usuário',
                preferences: {
                    defaultStore: 'Mercado Central',
                    currency: 'BRL'
                }
            };

            const response = await axios.post(`${API_BASE}/auth/register`, userData);
            
            this.token = response.data.data.token;
            this.userId = response.data.data.user.id;
            
            console.log('✅ Usuário registrado com sucesso!');
            console.log(`🔑 Token: ${this.token.substring(0, 50)}...`);
            
        } catch (error) {
            if (error.response?.data?.message?.includes('já existe')) {
                console.log('⚠️  Usuário já existe, fazendo login...');
                await this.login();
            } else {
                throw error;
            }
        }
    }

    async login() {
        console.log('\n🔐 Fazendo login...');
        
        const loginData = {
            identifier: 'demouser',
            password: 'senha123'
        };

        const response = await axios.post(`${API_BASE}/auth/login`, loginData);
        
        this.token = response.data.data.token;
        this.userId = response.data.data.user.id;
        
        console.log('✅ Login realizado com sucesso!');
    }

    async getAuthHeader() {
        return { Authorization: `Bearer ${this.token}` };
    }

    async browseItems() {
        console.log('\n🛍️  Navegando pelos itens...');
        
        const response = await axios.get(`${API_BASE}/items`);
        const items = response.data.data;
        
        console.log(`📦 Encontrados ${items.length} itens:`);
        items.forEach(item => {
            console.log(`   • ${item.name} - R$ ${item.averagePrice} (${item.category})`);
        });
        
        return items;
    }

    async searchItems() {
        console.log('\n🔍 Buscando itens...');
        
        const response = await axios.get(`${API_BASE}/items/search?q=arroz`);
        const results = response.data.data.results;
        
        console.log(`🔎 Resultados da busca por "arroz":`);
        results.forEach(item => {
            console.log(`   • ${item.name} - ${item.brand} - R$ ${item.averagePrice}`);
        });
        
        return results;
    }

    async createShoppingList() {
        console.log('\n🛒 Criando lista de compras...');
        
        const listData = {
            name: 'Minha Primeira Lista',
            description: 'Lista de compras de demonstração'
        };

        const response = await axios.post(`${API_BASE}/lists`, listData, {
            headers: await this.getAuthHeader()
        });

        const list = response.data.data;
        console.log(`✅ Lista criada: ${list.name} (ID: ${list.id})`);
        
        return list;
    }

    async addItemsToList(listId, items) {
        console.log('\n📋 Adicionando itens à lista...');
        
        for (const item of items.slice(0, 3)) {
            try {
                const itemData = {
                    itemId: item.id,
                    quantity: Math.floor(Math.random() * 3) + 1,
                    notes: 'Item de demonstração'
                };

                await axios.post(`${API_BASE}/lists/${listId}/items`, itemData, {
                    headers: await this.getAuthHeader()
                });
                
                console.log(`   ✅ ${item.name} adicionado à lista`);
            } catch (error) {
                console.log(`   ❌ Erro ao adicionar ${item.name}: ${error.response?.data?.message}`);
            }
        }
    }

    async viewList(listId) {
        console.log('\n👀 Visualizando lista...');
        
        const response = await axios.get(`${API_BASE}/lists/${listId}`, {
            headers: await this.getAuthHeader()
        });

        const list = response.data.data;
        
        console.log(`📋 Lista: ${list.name}`);
        console.log(`📊 Resumo: ${list.summary.totalItems} itens, Total estimado: R$ ${list.summary.estimatedTotal.toFixed(2)}`);
        
        console.log('\n🛍️  Itens na lista:');
        list.items.forEach(item => {
            const status = item.purchased ? '✅' : '⏳';
            console.log(`   ${status} ${item.quantity}x ${item.itemName} - R$ ${(item.quantity * item.estimatedPrice).toFixed(2)}`);
        });
        
        return list;
    }

    async getDashboard() {
        console.log('\n📊 Acessando dashboard...');
        
        const response = await axios.get(`${API_BASE}/dashboard`, {
            headers: await this.getAuthHeader()
        });

        const dashboard = response.data.data;
        console.log('✅ Dashboard carregado com sucesso!');
        console.log(`   👤 Usuário: ${dashboard.user?.user?.firstName}`);
        console.log(`   📦 Itens recentes: ${dashboard.recentItems?.length}`);
        console.log(`   🛒 Listas do usuário: ${dashboard.userLists?.length}`);
        
        return dashboard;
    }

    async runDemo() {
        try {
            console.log('🚀 Iniciando demonstração do sistema...\n');
            
            await this.waitForServices();
            await this.registerUser();
            await this.delay(1000);
            
            const items = await this.browseItems();
            await this.delay(1000);
            
            await this.searchItems();
            await this.delay(1000);
            
            const list = await this.createShoppingList();
            await this.delay(1000);
            
            await this.addItemsToList(list.id, items);
            await this.delay(1000);
            
            await this.viewList(list.id);
            await this.delay(1000);
            
            await this.getDashboard();
            
            console.log('\n🎉 Demonstração concluída com sucesso!');
            console.log('\n📍 Endpoints disponíveis:');
            console.log('   • Health: http://localhost:3000/health');
            console.log('   • Registry: http://localhost:3000/registry');
            console.log('   • API Docs: http://localhost:3000/');
            
        } catch (error) {
            console.error('❌ Erro na demonstração:', error.message);
            if (error.response) {
                console.error('   Detalhes:', error.response.data);
            }
        }
    }
}

const demo = new ClientDemo();
demo.runDemo();
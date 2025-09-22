// client-demo.js
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Funções auxiliares
const makeRequest = async (method, endpoint, data = null, token = null) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {}
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data && (method === 'post' || method === 'put')) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error ${method.toUpperCase()} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// Demonstração do fluxo completo
const demo = async () => {
  console.log('=== DEMONSTRAÇÃO DO SISTEMA DE LISTAS DE COMPRAS ===\n');

  let authToken = null;
  let userId = null;
  let listId = null;
  let itemId = null;

  try {
    // 1. Registrar um novo usuário
    console.log('1. Registrando um novo usuário...');
    const userData = {
      email: 'joao.silva@email.com',
      username: 'joaosilva',
      password: 'senha123',
      firstName: 'João',
      lastName: 'Silva',
      preferences: {
        defaultStore: 'Mercado Central',
        currency: 'BRL'
      }
    };

    const registeredUser = await makeRequest('post', '/api/auth/register', userData);
    console.log('✅ Usuário registrado:', registeredUser.username);
    userId = registeredUser.id;

    // 2. Fazer login
    console.log('\n2. Fazendo login...');
    const loginData = {
      username: 'joaosilva',
      password: 'senha123'
    };

    const loginResponse = await makeRequest('post', '/api/auth/login', loginData);
    authToken = loginResponse.token;
    console.log('✅ Login realizado com sucesso. Token:', authToken.substring(0, 20) + '...');

    // 3. Buscar itens disponíveis
    console.log('\n3. Buscando itens disponíveis...');
    const items = await makeRequest('get', '/api/items');
    console.log(`✅ ${items.length} itens encontrados.`);
    
    // Selecionar alguns itens para a lista
    const selectedItems = items.slice(0, 5);
    itemId = selectedItems[0].id;
    console.log('Itens selecionados:', selectedItems.map(item => item.name).join(', '));

    // 4. Criar uma nova lista de compras
    console.log('\n4. Criando uma nova lista de compras...');
    const listData = {
      name: 'Minha Primeira Lista',
      description: 'Lista de compras da semana'
    };

    const newList = await makeRequest('post', '/api/lists', listData, authToken);
    listId = newList.id;
    console.log('✅ Lista criada:', newList.name);

    // 5. Adicionar itens à lista
    console.log('\n5. Adicionando itens à lista...');
    for (const item of selectedItems) {
      const itemData = {
        itemId: item.id,
        quantity: Math.floor(Math.random() * 3) + 1, // Quantidade aleatória entre 1-3
        notes: `Preferência: ${item.brand}`
      };

      const updatedList = await makeRequest('post', `/api/lists/${listId}/items`, itemData, authToken);
      console.log(`✅ ${item.name} adicionado à lista`);
    }

    // 6. Visualizar a lista
    console.log('\n6. Visualizando a lista...');
    const list = await makeRequest('get', `/api/lists/${listId}`, null, authToken);
    console.log('📋 Lista:', list.name);
    console.log('Itens na lista:');
    list.items.forEach(item => {
      console.log(`   - ${item.quantity}x ${item.itemName} (R$ ${(item.estimatedPrice * item.quantity).toFixed(2)})`);
    });
    console.log(`💰 Total estimado: R$ ${list.summary.estimatedTotal.toFixed(2)}`);

    // 7. Marcar alguns itens como comprados
    console.log('\n7. Marcando itens como comprados...');
    const itemsToMark = list.items.slice(0, 2);
    for (const item of itemsToMark) {
      await makeRequest('put', `/api/lists/${listId}/items/${item.itemId}`, { purchased: true }, authToken);
      console.log(`✅ ${item.itemName} marcado como comprado`);
    }

    // 8. Visualizar resumo da lista
    console.log('\n8. Visualizando resumo da lista...');
    const summary = await makeRequest('get', `/api/lists/${listId}/summary`, null, authToken);
    console.log(`📊 Resumo: ${summary.purchasedItems}/${summary.totalItems} itens comprados`);
    console.log(`💰 Total: R$ ${summary.estimatedTotal.toFixed(2)}`);

    // 9. Buscar itens por termo
    console.log('\n9. Buscando itens por termo "arroz"...');
    const searchResults = await makeRequest('get', '/api/search?q=arroz', null, authToken);
    console.log(`🔍 ${searchResults.items.length} itens encontrados na busca:`);
    searchResults.items.forEach(item => {
      console.log(`   - ${item.name} (${item.category})`);
    });

    // 10. Visualizar dashboard
    console.log('\n10. Visualizando dashboard...');
    const dashboard = await makeRequest('get', '/api/dashboard', null, authToken);
    console.log(`👤 Usuário: ${dashboard.user.firstName} ${dashboard.user.lastName}`);
    console.log(`📊 Estatísticas: ${dashboard.statistics.totalLists} listas, ${dashboard.statistics.totalItems} itens`);
    console.log(`💰 Total estimado em todas as listas: R$ ${dashboard.statistics.totalEstimated.toFixed(2)}`);

    console.log('\n=== DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO! ===');

  } catch (error) {
    console.error('❌ Erro durante a demonstração:', error.message);
  }
};

// Executar a demonstração
demo();
Guia de Instalação e Uso do Sistema
1. Instalação de Dependências
# Instalar dependências de todos os serviços
npm run install:all

2. Execução dos Serviços
Opção 1: Executar todos os serviços simultaneamente
npm start

Opção 2: Executar serviços individualmente (em terminais separados)
# Terminal 1 - User Service
cd services/user-service && npm start

# Terminal 2 - Item Service  
cd services/item-service && npm start

# Terminal 3 - List Service
cd services/list-service && npm start

# Terminal 4 - API Gateway
cd api-gateway && npm start

Opção 3: Modo desenvolvimento (com nodemon)
npm run dev

3. Executar Demonstração
# Executar cliente de demonstração após os serviços estarem rodando
npm run demo

4. Verificar Status dos Serviços
# Health check de todos os serviços
npm run health

# Verificar serviços registrados
npm run registry

📊 Endpoints Disponíveis
API Gateway (Porta 3000)

1️⃣ Dashboard Agregado
GET http://localhost:3000/api/dashboard
Authorization: Bearer TOKEN
Retorna estatísticas do usuário e suas listas.

2️⃣ Busca Global
GET http://localhost:3000/api/search?q=arroz
Authorization: Bearer TOKEN
Busca itens e listas que contenham o termo pesquisado.

3️⃣ Health Check
GET http://localhost:3000/health
Verifica o status de todos os serviços.

4️⃣ Service Registry
GET http://localhost:3000/registry
Lista todos os serviços registrados e seu status.

User Service (Porta 3001)

1️⃣ Registrar Usuário
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "email": "teste@email.com",
  "username": "testuser",
  "password": "senha123",
  "firstName": "João",
  "lastName": "Silva",
  "preferences": {
    "defaultStore": "Mercado Central",
    "currency": "BRL"
  }
}


2️⃣ Login
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "senha123"
}


3️⃣ Buscar Usuário por ID
GET http://localhost:3001/users/{USER_ID}
Authorization: Bearer TOKEN

4️⃣ Atualizar Usuário
PUT http://localhost:3001/users/{USER_ID}
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "firstName": "Nome Atualizado",
  "lastName": "Sobrenome Atualizado",
  "preferences": {
    "defaultStore": "Supermercado Novo",
    "currency": "USD"
  }
}

Item Service (Porta 3002)

1️⃣ Listar Todos os Itens
GET http://localhost:3002/items

2️⃣ Buscar Item por Termo
GET http://localhost:3002/search?q=arroz

3️⃣ Buscar Item por ID
GET http://localhost:3002/items/{ITEM_ID}

4️⃣ Criar Novo Item (Autenticado)
POST http://localhost:3002/items
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Leite",
  "category": "Bebidas",
  "brand": "Italac",
  "unit": "litro",
  "averagePrice": 6.99,
  "barcode": "1234567890143",
  "description": "Leite integral",
  "active": true
}


5️⃣ Atualizar Item (Autenticado)
PUT http://localhost:3002/items/{ITEM_ID}
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "averagePrice": 5.49,
  "active": false
}


6️⃣ Listar Categorias
GET http://localhost:3002/categories

List Service (Porta 3003)

1️⃣ Criar Lista
POST http://localhost:3003/lists
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Lista Semanal",
  "description": "Compras para a semana"
}


2️⃣ Listar Todas as Listas do Usuário
GET http://localhost:3003/lists
Authorization: Bearer TOKEN

3️⃣ Buscar Lista Específica
GET http://localhost:3003/lists/{LIST_ID}
Authorization: Bearer TOKEN

4️⃣ Atualizar Lista
PUT http://localhost:3003/lists/{LIST_ID}
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Lista Atualizada",
  "status": "completed"
}


5️⃣ Deletar Lista
DELETE http://localhost:3003/lists/{LIST_ID}
Authorization: Bearer TOKEN

6️⃣ Adicionar Item à Lista
POST http://localhost:3003/lists/{LIST_ID}/items
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "itemId": "{ITEM_ID}",
  "quantity": 2,
  "notes": "Comprar marca boa"
}


7️⃣ Atualizar Item da Lista
PUT http://localhost:3003/lists/{LIST_ID}/items/{ITEM_ID}
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "quantity": 3,
  "purchased": true,
  "notes": "Atualizado"
}


8️⃣ Remover Item da Lista
DELETE http://localhost:3003/lists/{LIST_ID}/items/{ITEM_ID}
Authorization: Bearer TOKEN

9️⃣ Resumo da Lista
GET http://localhost:3003/lists/{LIST_ID}/summary
Authorization: Bearer TOKEN

🔧 Funcionalidades Técnicas Implementadas

✅ Service Discovery

Registro automático de serviços na inicialização

Health checks periódicos a cada 30 segundos

Descoberta de serviços por nome

✅ Circuit Breaker
O Circuit Breaker protege seu sistema contra falhas consecutivas em serviços dependentes.

Estados do Circuit Breaker:

FECHADO: Tudo normal. Todas as requisições passam para o serviço. Se houver falhas consecutivas, muda para ABERTO.

ABERTO: O serviço está com problemas. Todas as requisições são bloqueadas imediatamente sem tentar chamar o serviço. Após um tempo de timeout, passa para MEIO-ABERTO.

MEIO-ABERTO: Permite uma ou poucas requisições de teste. Se forem bem-sucedidas, volta para FECHADO; se falharem, volta para ABERTO.

Configuração no projeto:

Número de falhas consecutivas para abrir o circuito: 3

Timeout antes de tentar recuperação (meio-aberto): 30 segundos

✅ Autenticação JWT

Tokens com validade de 24 horas

Hash de senhas com bcrypt

Validação de email e username únicos

✅ Bancos de Dados NoSQL

Armazenamento em arquivos JSON

Índices para busca eficiente

Schemas validados conforme especificação

🗂️ Estrutura de Dados

Usuário

{
  "id": "uuid",
  "email": "string",
  "username": "string", 
  "password": "string (hash)",
  "firstName": "string",
  "lastName": "string",
  "preferences": {
    "defaultStore": "string",
    "currency": "string"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}


Item

{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "brand": "string",
  "unit": "string",
  "averagePrice": "number",
  "barcode": "string",
  "description": "string",
  "active": "boolean",
  "createdAt": "timestamp"
}


Lista

{
  "id": "uuid",
  "userId": "string",
  "name": "string",
  "description": "string",
  "status": "active|completed|archived",
  "items": [
    {
      "itemId": "string",
      "itemName": "string",
      "quantity": "number",
      "unit": "string",
      "estimatedPrice": "number",
      "purchased": "boolean",
      "notes": "string",
      "addedAt": "timestamp"
    }
  ],
  "summary": {
    "totalItems": "number",
    "purchasedItems": "number", 
    "estimatedTotal": "number"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

🐛 Solução de Problemas
Serviços não iniciam
# Verificar se as portas estão livres
netstat -an | grep 3000
netstat -an | grep 3001
netstat -an | grep 3002
netstat -an | grep 3003

# Limpar e reinstalar dependências
npm run clean
npm run install:all

Erro de conexão entre serviços
# Verificar registry
curl http://localhost:3000/registry

# Verificar health individual
curl http://localhost:3001/health
curl http://localhost:3002/health  
curl http://localhost:3003/health
Guia de Instalação e Uso – Sistema de Listas de Compras Microservices
1️⃣ Instalação de Dependências

Para instalar todas as dependências de todos os serviços:

npm run install:all

2️⃣ Execução dos Serviços
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

3️⃣ Executar Demonstração

Após os serviços estarem rodando:

npm run demo

4️⃣ Verificar Status dos Serviços
Health check de todos os serviços
npm run health

Verificar serviços registrados
npm run registry

5️⃣ Endpoints Disponíveis
API Gateway (Porta 3000)
Funcionalidade	Método	Endpoint	Descrição
Dashboard Agregado	GET	/api/dashboard	Retorna estatísticas do usuário e suas listas. Authorization: Bearer TOKEN
Busca Global	GET	/api/search?q=termo	Busca itens e listas que contenham o termo pesquisado. Authorization: Bearer TOKEN
Health Check	GET	/health	Verifica status de todos os serviços.
Service Registry	GET	/registry	Lista serviços registrados e status.
User Service (Porta 3001)
Funcionalidade	Método	Endpoint	Body / Headers
Registrar Usuário	POST	/auth/register	JSON (email, username, password, firstName, lastName, preferences)
Login	POST	/auth/login	JSON (username/email + password)
Buscar Usuário por ID	GET	/users/{USER_ID}	Authorization: Bearer TOKEN
Atualizar Usuário	PUT	/users/{USER_ID}	Authorization: Bearer TOKEN, JSON (firstName, lastName, preferences)

Exemplo Body Registro:

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

Item Service (Porta 3002)
Funcionalidade	Método	Endpoint	Body / Headers
Listar Todos os Itens	GET	/items	-
Buscar Item por Termo	GET	/search?q=termo	-
Buscar Item por ID	GET	/items/{ITEM_ID}	-
Criar Novo Item	POST	/items	Authorization: Bearer TOKEN, JSON com dados do item
Atualizar Item	PUT	/items/{ITEM_ID}	Authorization: Bearer TOKEN, JSON com campos atualizados
Listar Categorias	GET	/categories	-

Exemplo Body Criação de Item:

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

List Service (Porta 3003)
Funcionalidade	Método	Endpoint	Body / Headers
Criar Lista	POST	/lists	Authorization: Bearer TOKEN, JSON (name, description)
Listar Todas as Listas	GET	/lists	Authorization: Bearer TOKEN
Buscar Lista Específica	GET	/lists/{LIST_ID}	Authorization: Bearer TOKEN
Atualizar Lista	PUT	/lists/{LIST_ID}	Authorization: Bearer TOKEN, JSON (name, status)
Deletar Lista	DELETE	/lists/{LIST_ID}	Authorization: Bearer TOKEN
Adicionar Item à Lista	POST	/lists/{LIST_ID}/items	Authorization: Bearer TOKEN, JSON (itemId, quantity, notes)
Atualizar Item da Lista	PUT	/lists/{LIST_ID}/items/{ITEM_ID}	Authorization: Bearer TOKEN, JSON (quantity, purchased, notes)
Remover Item da Lista	DELETE	/lists/{LIST_ID}/items/{ITEM_ID}	Authorization: Bearer TOKEN
Resumo da Lista	GET	/lists/{LIST_ID}/summary	Authorization: Bearer TOKEN

Exemplo Body Adicionar Item:

{
  "itemId": "{ITEM_ID}",
  "quantity": 2,
  "notes": "Comprar marca boa"
}

6️⃣ Funcionalidades Técnicas Implementadas

Service Discovery

Registro automático na inicialização

Health checks periódicos a cada 30 segundos

Descoberta de serviços por nome

Circuit Breaker

Protege contra falhas consecutivas

3 falhas consecutivas → abre circuito

Timeout de 30 segundos para estado meio-aberto

Autenticação JWT

Validade de 24 horas

Hash de senhas com bcrypt

Validação de email/username únicos

Banco NoSQL

Armazenamento em arquivos JSON

Índices para busca eficiente

Schemas validados conforme especificação

7️⃣ Estrutura de Dados
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

8️⃣ Solução de Problemas Comuns
Serviços não iniciam

Verificar se as portas estão livres:

netstat -an | grep 3000
netstat -an | grep 3001
netstat -an | grep 3002
netstat -an | grep 3003


Limpar e reinstalar dependências:

npm run clean
npm run install:all

Erro de conexão entre serviços

Verificar Service Registry:

curl http://localhost:3000/registry


Verificar health individual:

curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
// shared/JsonDatabase.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
  constructor(dbName) {
    this.dbPath = path.join(__dirname, '..', 'data', `${dbName}.json`);
    this.ensureDbFile();
  }

  ensureDbFile() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Diretório criado: ${dir}`);
    }

    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([]));
      console.log(`Arquivo de DB criado: ${this.dbPath}`);
    }
  }

  read() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`DB lido (${this.dbPath}):`, parsed.map(u => u.id));
      return parsed;
    } catch (error) {
      console.error('Error reading database:', error);
      return [];
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
      console.log(`DB escrito (${this.dbPath}) com ${data.length} registros`);
      return true;
    } catch (error) {
      console.error('Error writing to database:', error);
      return false;
    }
  }

  insert(item) {
    const data = this.read();
    item.id = uuidv4();
    item.createdAt = new Date().toISOString();
    item.updatedAt = item.createdAt;
    data.push(item);
    this.write(data);
    console.log(`Item inserido:`, item);
    return item;
  }

 findById(id) {
  const data = this.read();
  console.log('Procurando ID:', id, 'em:', data.map(item => item.id));
  const item = data.find(item => item.id === id);
  return item || null;
}

  find(filterFn = () => true) {
    const data = this.read();
    const results = data.filter(filterFn);
    console.log(`Busca realizada. Resultados encontrados: ${results.length}`);
    return results;
  }

  update(id, updates) {
    const data = this.read();
    const index = data.findIndex(item => item.id === id);

    if (index === -1) {
      console.log(`Update falhou: ID não encontrado -> ${id}`);
      return null;
    }

    updates.updatedAt = new Date().toISOString();
    data[index] = { ...data[index], ...updates };
    this.write(data);
    console.log(`Item atualizado:`, data[index]);
    return data[index];
  }

  delete(id) {
    const data = this.read();
    const index = data.findIndex(item => item.id === id);

    if (index === -1) {
      console.log(`Delete falhou: ID não encontrado -> ${id}`);
      return false;
    }

    const removed = data.splice(index, 1);
    this.write(data);
    console.log(`Item deletado:`, removed[0]);
    return true;
  }
}

module.exports = JsonDatabase;

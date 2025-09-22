const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
    constructor(servicePath, collectionName) {
        this.dbPath = path.join(servicePath, 'database');
        this.collectionName = collectionName;
        this.filePath = path.join(this.dbPath, `${collectionName}.json`);
        this.ensureDatabase();
    }

    async ensureDatabase() {
        try {
            await fs.ensureDir(this.dbPath);
            if (!await fs.pathExists(this.filePath)) {
                await fs.writeJson(this.filePath, []);
            }
        } catch (error) {
            console.error('Erro ao inicializar banco:', error);
            throw error;
        }
    }

    async create(data) {
        try {
            const documents = await this.readAll();
            const document = {
                id: data.id || uuidv4(),
                ...data,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            documents.push(document);
            await this.writeAll(documents);
            return document;
        } catch (error) {
            console.error('Erro ao criar documento:', error);
            throw error;
        }
    }

    async findById(id) {
        const documents = await this.readAll();
        return documents.find(doc => doc.id === id) || null;
    }

    async findOne(filter) {
        const documents = await this.readAll();
        return documents.find(doc => this.matchesFilter(doc, filter)) || null;
    }

    async find(filter = {}, options = {}) {
        let documents = await this.readAll();
        
        if (Object.keys(filter).length > 0) {
            documents = documents.filter(doc => this.matchesFilter(doc, filter));
        }

        if (options.sort) {
            documents = this.sortDocuments(documents, options.sort);
        }

        const skip = options.skip || 0;
        const limit = options.limit || documents.length;
        return documents.slice(skip, skip + limit);
    }

    async count(filter = {}) {
        const documents = await this.readAll();
        if (Object.keys(filter).length === 0) {
            return documents.length;
        }
        return documents.filter(doc => this.matchesFilter(doc, filter)).length;
    }

    async update(id, updates) {
        const documents = await this.readAll();
        const index = documents.findIndex(doc => doc.id === id);
        if (index === -1) return null;

        documents[index] = {
            ...documents[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.writeAll(documents);
        return documents[index];
    }

    async delete(id) {
        const documents = await this.readAll();
        const index = documents.findIndex(doc => doc.id === id);
        if (index === -1) return false;

        documents.splice(index, 1);
        await this.writeAll(documents);
        return true;
    }

    async search(query, fields = []) {
        const documents = await this.readAll();
        const searchTerm = query.toLowerCase();
        
        return documents.filter(doc => {
            if (fields.length === 0) {
                return JSON.stringify(doc).toLowerCase().includes(searchTerm);
            }
            return fields.some(field => {
                const value = this.getNestedValue(doc, field);
                return value && value.toString().toLowerCase().includes(searchTerm);
            });
        });
    }

    async readAll() {
        try {
            return await fs.readJson(this.filePath);
        } catch (error) {
            return [];
        }
    }

    async writeAll(documents) {
        await fs.writeJson(this.filePath, documents, { spaces: 2 });
    }

    matchesFilter(doc, filter) {
        return Object.entries(filter).every(([key, value]) => {
            const docValue = this.getNestedValue(doc, key);
            
            if (typeof value === 'object' && value.$regex) {
                const regex = new RegExp(value.$regex, value.$options || 'i');
                return regex.test(docValue);
            }
            
            return docValue === value;
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    sortDocuments(documents, sort) {
        return documents.sort((a, b) => {
            for (const [field, direction] of Object.entries(sort)) {
                const aVal = this.getNestedValue(a, field);
                const bVal = this.getNestedValue(b, field);
                
                if (aVal < bVal) return direction === 1 ? -1 : 1;
                if (aVal > bVal) return direction === 1 ? 1 : -1;
            }
            return 0;
        });
    }
}

module.exports = JsonDatabase;
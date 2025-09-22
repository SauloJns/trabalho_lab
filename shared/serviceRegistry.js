const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class ServiceRegistry {
    constructor() {
        this.registryFile = path.join(__dirname, 'services-registry.json');
        this.ensureRegistryFile();
    }

    ensureRegistryFile() {
        if (!fs.existsSync(this.registryFile)) {
            fs.writeJsonSync(this.registryFile, {});
        }
    }

    readRegistry() {
        try {
            return fs.readJsonSync(this.registryFile);
        } catch (error) {
            return {};
        }
    }

    writeRegistry(services) {
        fs.writeJsonSync(this.registryFile, services, { spaces: 2 });
    }

    register(serviceName, serviceInfo) {
        const services = this.readRegistry();
        
        services[serviceName] = {
            ...serviceInfo,
            registeredAt: Date.now(),
            lastHealthCheck: Date.now(),
            healthy: true,
            pid: process.pid
        };

        this.writeRegistry(services);
        console.log(`✅ Serviço registrado: ${serviceName} - ${serviceInfo.url}`);
    }

    discover(serviceName) {
        const services = this.readRegistry();
        const service = services[serviceName];
        
        if (!service) {
            console.log(`❌ Serviço não encontrado: ${serviceName}`);
            console.log(`📋 Serviços disponíveis:`, Object.keys(services));
            throw new Error(`Serviço não encontrado: ${serviceName}`);
        }
        
        if (!service.healthy) {
            console.log(`⚠️ Serviço indisponível: ${serviceName}`);
            throw new Error(`Serviço indisponível: ${serviceName}`);
        }
        
        console.log(`🔍 Serviço encontrado: ${serviceName} - ${service.url}`);
        return service;
    }

    listServices() {
        const services = this.readRegistry();
        const result = {};
        
        Object.entries(services).forEach(([name, service]) => {
            result[name] = {
                url: service.url,
                healthy: service.healthy,
                registeredAt: new Date(service.registeredAt).toISOString(),
                uptime: Date.now() - service.registeredAt
            };
        });
        
        return result;
    }

    unregister(serviceName) {
        const services = this.readRegistry();
        if (services[serviceName]) {
            delete services[serviceName];
            this.writeRegistry(services);
            console.log(`🗑️ Serviço removido: ${serviceName}`);
        }
    }

    updateHealth(serviceName, healthy) {
        const services = this.readRegistry();
        if (services[serviceName]) {
            services[serviceName].healthy = healthy;
            services[serviceName].lastHealthCheck = Date.now();
            this.writeRegistry(services);
        }
    }

    async performHealthChecks() {
        const services = this.readRegistry();
        
        console.log(`🔍 Executando health checks para ${Object.keys(services).length} serviços...`);
        
        for (const [serviceName, service] of Object.entries(services)) {
            try {
                const response = await axios.get(`${service.url}/health`, { 
                    timeout: 5000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
                if (response.status === 200) {
                    this.updateHealth(serviceName, true);
                    console.log(`✅ ${serviceName}: HEALTHY`);
                } else {
                    this.updateHealth(serviceName, false);
                    console.log(`❌ ${serviceName}: UNHEALTHY - Status ${response.status}`);
                }
            } catch (error) {
                console.error(`❌ Health check falhou para ${serviceName}:`, error.message);
                this.updateHealth(serviceName, false);
            }
        }
    }

    getServiceCount() {
        const services = this.readRegistry();
        return Object.keys(services).length;
    }
}

const serviceRegistry = new ServiceRegistry();

setTimeout(() => {
    serviceRegistry.performHealthChecks();
}, 5000);

setInterval(() => {
    serviceRegistry.performHealthChecks();
}, 30000);

module.exports = serviceRegistry;
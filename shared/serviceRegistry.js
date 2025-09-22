// shared/serviceRegistry.js
const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, 'serviceRegistry.json');

class ServiceRegistry {
  constructor() {
    this.services = {};
    this.ensureRegistryFile();
    this.loadRegistry();
    setInterval(() => this.cleanup(), 30000); // Cleanup a cada 30 segundos
  }

  ensureRegistryFile() {
    try {
      if (!fs.existsSync(REGISTRY_FILE)) {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify({}));
      }
    } catch (error) {
      console.error('Error ensuring registry file exists:', error);
    }
  }

  loadRegistry() {
    try {
      const data = fs.readFileSync(REGISTRY_FILE, 'utf8');
      this.services = data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading service registry:', error);
      this.services = {};
    }
  }

  saveRegistry() {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this.services, null, 2));
    } catch (error) {
      console.error('Error saving service registry:', error);
    }
  }

  register(serviceName, serviceUrl) {
    const timestamp = Date.now();
    this.services[serviceName] = {
      url: serviceUrl,
      timestamp,
      healthy: true,
      failures: 0
    };
    this.saveRegistry();
    console.log(`Service registered: ${serviceName} at ${serviceUrl}`);
  }

  unregister(serviceName) {
    if (this.services[serviceName]) {
      delete this.services[serviceName];
      this.saveRegistry();
      console.log(`Service unregistered: ${serviceName}`);
    }
  }

  getService(serviceName) {
    const service = this.services[serviceName];
    if (service && service.healthy) {
      return service.url;
    }
    return null;
  }

  markFailure(serviceName) {
    const service = this.services[serviceName];
    if (!service) return;
    service.failures += 1;
    if (service.failures >= 3) {
      service.healthy = false; // Circuit breaker
      console.log(`Circuit opened for service: ${serviceName}`);
    }
    this.saveRegistry();
  }

  markSuccess(serviceName) {
    const service = this.services[serviceName];
    if (!service) return;
    service.failures = 0;
    service.healthy = true;
    service.timestamp = Date.now();
    this.saveRegistry();
    console.log(`Circuit closed for service: ${serviceName}`);
  }

  updateHealth(serviceName, isHealthy) {
    const service = this.services[serviceName];
    if (!service) return;
    service.healthy = isHealthy;
    service.timestamp = Date.now();
    this.saveRegistry();
  }

  cleanup() {
    const now = Date.now();
    let changed = false;

    Object.keys(this.services).forEach(serviceName => {
      const service = this.services[serviceName];
      if (now - service.timestamp > 90000) { // 90s
        delete this.services[serviceName];
        changed = true;
        console.log(`Service cleaned up: ${serviceName}`);
      }
    });

    if (changed) this.saveRegistry();
  }

  getAllServices() {
    return this.services;
  }
}

module.exports = new ServiceRegistry();

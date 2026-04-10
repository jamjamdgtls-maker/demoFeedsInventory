/**
 * db.js — Shared localStorage database utilities
 * All modules import this for consistent data access.
 */

const DB = {
  getData(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(`[DB] Failed to parse key "${key}":`, e);
      return [];
    }
  },

  saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`[DB] Failed to save key "${key}":`, e);
    }
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  },

  findById(key, id) {
    return this.getData(key).find(item => item.id === id) || null;
  },

  insert(key, record) {
    const data = this.getData(key);
    if (!record.id) record.id = this.generateId();
    data.push(record);
    this.saveData(key, data);
    return record;
  },

  update(key, id, changes) {
    const data = this.getData(key);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...changes };
    this.saveData(key, data);
    return true;
  },

  delete(key, id) {
    const data = this.getData(key);
    const filtered = data.filter(item => item.id !== id);
    if (filtered.length === data.length) return false;
    this.saveData(key, filtered);
    return true;
  },

  /**
   * Log a price change to the price_history collection.
   */
  logPriceChange(productId, oldPrice, newPrice) {
    this.insert('price_history', {
      productId,
      oldPrice,
      newPrice,
      changedAt: new Date().toISOString(),
    });
  },

  seedIfEmpty() {
    const products = this.getData('products');
    if (products.length > 0) return;

    const suppliers = [
      { id: 'sup1', name: 'AgroFeed Co.' },
      { id: 'sup2', name: 'NutriGrain Supply' },
    ];
    this.saveData('suppliers', suppliers);

    const demoProducts = [
      { id: 'prod1', name: 'Broiler Starter Mash', price: 75 },
      { id: 'prod2', name: 'Broiler Finisher Mash', price: 68 },
      { id: 'prod3', name: 'Layer Pellets',         price: 72 },
      { id: 'prod4', name: 'Hog Grower Mix',        price: 65 },
      { id: 'prod5', name: 'Cattle Concentrate',    price: 95 },
    ];
    this.saveData('products', demoProducts);

    const now = new Date();
    const daysAgo = d => new Date(now - d * 86400000).toISOString();
    const inventory = [
      { id: 'inv1', productId: 'prod1', supplierId: 'sup1', quantity: 50, costPrice: 60, dateReceived: daysAgo(10) },
      { id: 'inv2', productId: 'prod1', supplierId: 'sup1', quantity: 30, costPrice: 62, dateReceived: daysAgo(3) },
      { id: 'inv3', productId: 'prod1', supplierId: 'sup2', quantity: 40, costPrice: 58, dateReceived: daysAgo(7) },
      { id: 'inv4', productId: 'prod2', supplierId: 'sup1', quantity: 60, costPrice: 54, dateReceived: daysAgo(5) },
      { id: 'inv5', productId: 'prod2', supplierId: 'sup2', quantity: 25, costPrice: 52, dateReceived: daysAgo(2) },
      { id: 'inv6', productId: 'prod3', supplierId: 'sup1', quantity: 80, costPrice: 58, dateReceived: daysAgo(8) },
      { id: 'inv7', productId: 'prod3', supplierId: 'sup2', quantity: 20, costPrice: 55, dateReceived: daysAgo(1) },
      { id: 'inv8', productId: 'prod4', supplierId: 'sup2', quantity: 45, costPrice: 50, dateReceived: daysAgo(6) },
      { id: 'inv9', productId: 'prod5', supplierId: 'sup1', quantity: 15, costPrice: 80, dateReceived: daysAgo(4) },
    ];
    this.saveData('inventory', inventory);
    this.saveData('sales', []);
    this.saveData('price_history', []);
  },

  exportBackup() {
    const keys = ['products', 'suppliers', 'inventory', 'sales', 'price_history'];
    const backup = {};
    keys.forEach(k => (backup[k] = this.getData(k)));
    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonString) {
    const backup = JSON.parse(jsonString);
    const keys = ['products', 'suppliers', 'inventory', 'sales', 'price_history'];
    keys.forEach(k => {
      if (Array.isArray(backup[k])) this.saveData(k, backup[k]);
    });
  },
};

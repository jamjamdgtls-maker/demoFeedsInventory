/**
 * db.js — Shared localStorage database layer for AgroFeed POS
 *
 * CAPACITOR SQLITE MIGRATION NOTES (for future mobile app):
 * ─────────────────────────────────────────────────────────
 * Replace each method body with the Capacitor SQLite equivalent:
 *   - getData(key)         → SELECT * FROM `key`
 *   - saveData(key, data)  → DELETE + bulk INSERT into `key`
 *   - insert(key, record)  → INSERT INTO `key`
 *   - update(key, id, ...) → UPDATE `key` SET ... WHERE id=?
 *   - delete(key, id)      → DELETE FROM `key` WHERE id=?
 * Tables: products, suppliers, inventory, sales, price_history
 * Use @capacitor-community/sqlite with async/await wrappers.
 * ─────────────────────────────────────────────────────────
 */

const DB = {
  getData(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(`[DB] parse error for "${key}":`, e);
      return [];
    }
  },

  saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`[DB] save error for "${key}":`, e);
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
    const idx  = data.findIndex(item => item.id === id);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...changes };
    this.saveData(key, data);
    return true;
  },

  delete(key, id) {
    const data     = this.getData(key);
    const filtered = data.filter(item => item.id !== id);
    if (filtered.length === data.length) return false;
    this.saveData(key, filtered);
    return true;
  },

  logPriceChange(productId, oldPrice, newPrice) {
    this.insert('price_history', {
      productId,
      oldPrice,
      newPrice,
      changedAt: new Date().toISOString(),
    });
  },

  /**
   * Weighted-average cost per sack for a product.
   * Computed across ALL received batches (using original receivedQty × costPrice).
   */
  getAvgCost(productId) {
    const batches = this.getData('inventory').filter(i => i.productId === productId);
    if (batches.length === 0) return 0;
    const totalOrigQty  = batches.reduce((s, b) => s + (b.receivedQty  || b.quantity || 0), 0);
    const totalCostVal  = batches.reduce((s, b) => s + (b.receivedQty  || b.quantity || 0) * (b.costPrice || 0), 0);
    return totalOrigQty > 0 ? totalCostVal / totalOrigQty : 0;
  },

  /**
   * Cost per sack from the most recently received batch for a product.
   */
  getLatestCost(productId) {
    const batches = this.getData('inventory')
      .filter(i => i.productId === productId)
      .sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));
    return batches.length > 0 ? batches[0].costPrice : 0;
  },

  /**
   * Latest selling price from price_history (or current product price).
   */
  getLatestSellingPrice(productId) {
    const product = this.findById('products', productId);
    return product ? product.price : 0;
  },

  exportBackup() {
    const keys   = ['products', 'suppliers', 'inventory', 'sales', 'price_history'];
    const backup = {};
    keys.forEach(k => (backup[k] = this.getData(k)));
    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonString) {
    const backup = JSON.parse(jsonString);
    const keys   = ['products', 'suppliers', 'inventory', 'sales', 'price_history'];
    keys.forEach(k => {
      if (Array.isArray(backup[k])) this.saveData(k, backup[k]);
    });
  },

  /** Initialize empty collections if they don't exist yet (no demo data). */
  initEmpty() {
    ['products', 'suppliers', 'inventory', 'sales', 'price_history'].forEach(k => {
      if (localStorage.getItem(k) === null) this.saveData(k, []);
    });
  },
};

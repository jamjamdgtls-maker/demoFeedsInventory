/**
 * pos.js — Point of Sale logic
 *
 * Flow:
 *  1. User selects a supplier tab
 *  2. Products for that supplier (with stock) are shown
 *  3. User clicks product → added to cart (productId + supplierId)
 *  4. Cart qty controls: + / − / remove
 *  5. Checkout: FIFO deduction, save sale, clear cart
 */

DB.seedIfEmpty();

// ── State ────────────────────────────────────────────────────
let activeSupplier = null; // currently selected supplier id
let cart = [];             // [{ productId, supplierId, quantity, price, productName, supplierName }]
let searchQuery = '';

// ── DOM refs ─────────────────────────────────────────────────
const supplierTabsEl = document.getElementById('supplier-tabs');
const productGridEl  = document.getElementById('product-grid');
const cartItemsEl    = document.getElementById('cart-items');
const cartEmptyEl    = document.getElementById('cart-empty');
const cartTotalEl    = document.getElementById('cart-total');
const cartCountEl    = document.getElementById('cart-item-count');
const btnCheckout    = document.getElementById('btn-checkout');
const btnClearCart   = document.getElementById('btn-clear-cart');
const searchInput    = document.getElementById('product-search');
const modalCheckout  = document.getElementById('modal-checkout');
const checkoutSummaryEl = document.getElementById('checkout-summary');

// ── Init ─────────────────────────────────────────────────────
function init() {
  renderSupplierTabs();

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderProducts();
  });

  // Clear cart
  btnClearCart.addEventListener('click', () => {
    if (cart.length === 0) return;
    if (!Utils.confirm('Clear the cart?')) return;
    cart = [];
    renderCart();
    renderProducts(); // refresh in-cart badges
  });

  // Checkout button → open confirm modal
  btnCheckout.addEventListener('click', () => {
    if (cart.length === 0) return;
    renderCheckoutSummary();
    openModal('modal-checkout');
  });

  // Confirm checkout
  document.getElementById('btn-confirm-checkout').addEventListener('click', () => {
    processCheckout();
    closeModal('modal-checkout');
  });

  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ── Supplier Tabs ─────────────────────────────────────────────
function renderSupplierTabs() {
  const suppliers = DB.getData('suppliers');
  supplierTabsEl.innerHTML = '';

  if (suppliers.length === 0) {
    supplierTabsEl.innerHTML = '<span class="text-muted text-small">No suppliers found. <a href="../suppliers/suppliers.html">Add one</a></span>';
    return;
  }

  suppliers.forEach((sup, i) => {
    const btn = document.createElement('button');
    btn.className = 'supplier-tab' + (i === 0 ? ' active' : '');
    btn.textContent = sup.name;
    btn.dataset.id = sup.id;
    btn.addEventListener('click', () => selectSupplier(sup.id));
    supplierTabsEl.appendChild(btn);
  });

  // Select first supplier by default
  if (suppliers.length > 0) {
    selectSupplier(suppliers[0].id);
  }
}

function selectSupplier(supplierId) {
  activeSupplier = supplierId;
  document.querySelectorAll('.supplier-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === supplierId);
  });
  renderProducts();
}

// ── Products ──────────────────────────────────────────────────
function getProductEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('broiler') || n.includes('chicken')) return '🐔';
  if (n.includes('layer'))   return '🥚';
  if (n.includes('hog') || n.includes('pig') || n.includes('swine')) return '🐷';
  if (n.includes('cattle') || n.includes('cow')) return '🐄';
  if (n.includes('duck'))    return '🦆';
  if (n.includes('goat'))    return '🐐';
  if (n.includes('rabbit'))  return '🐰';
  if (n.includes('fish'))    return '🐟';
  return '🌾';
}

function renderProducts() {
  if (!activeSupplier) {
    productGridEl.innerHTML = '<div class="no-products-msg"><span>🏭</span><span>Select a supplier to view products</span></div>';
    return;
  }

  const products  = DB.getData('products');
  const inventory = DB.getData('inventory');

  // Get products that have at least one inventory record for this supplier
  // (even if stock is 0 — show as out of stock)
  const supplierInventory = inventory.filter(i => i.supplierId === activeSupplier);
  const productIdsForSupplier = [...new Set(supplierInventory.map(i => i.productId))];

  let filtered = products.filter(p => productIdsForSupplier.includes(p.id));

  // Apply search
  if (searchQuery) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    productGridEl.innerHTML = `
      <div class="no-products-msg">
        <span>📭</span>
        <span>${searchQuery ? 'No products match your search.' : 'No products for this supplier. <a href="../stock-in/stock-in.html">Add stock</a>'}</span>
      </div>`;
    return;
  }

  productGridEl.innerHTML = '';

  filtered.forEach(product => {
    const stock = Utils.getStockByProductSupplier(product.id, activeSupplier);
    const cartItem = cart.find(c => c.productId === product.id && c.supplierId === activeSupplier);
    const cartQty  = cartItem ? cartItem.quantity : 0;
    const isOut    = stock === 0;
    const isLow    = stock > 0 && stock <= 10;

    let stockClass = 'ok', stockLabel = `${stock} in stock`;
    if (isOut) { stockClass = 'out'; stockLabel = 'Out of stock'; }
    else if (isLow) { stockClass = 'low'; stockLabel = `Low: ${stock} left`; }

    const card = document.createElement('div');
    card.className = `product-card ${isOut ? 'product-card--disabled' : ''} ${isLow ? 'product-card--low-stock' : ''}`;
    card.dataset.productId = product.id;
    card.innerHTML = `
      ${cartQty > 0 ? `<div class="product-card__in-cart">${cartQty}</div>` : ''}
      <div class="product-card__emoji">${getProductEmoji(product.name)}</div>
      <div class="product-card__name">${Utils.escape(product.name)}</div>
      <div class="product-card__price">${Utils.formatCurrency(product.price)}</div>
      <div class="product-card__stock">
        <span class="stock-dot stock-dot--${stockClass}"></span>
        <span class="stock-text--${stockClass}">${stockLabel}</span>
      </div>
    `;

    if (!isOut) {
      card.addEventListener('click', () => addToCart(product, activeSupplier, stock));
    }

    productGridEl.appendChild(card);
  });
}

// ── Cart Logic ────────────────────────────────────────────────
function addToCart(product, supplierId, maxStock) {
  const existing = cart.find(c => c.productId === product.id && c.supplierId === supplierId);

  if (existing) {
    if (existing.quantity >= maxStock) {
      Utils.showToast(`Only ${maxStock} units available.`, 'warning');
      return;
    }
    existing.quantity++;
  } else {
    const supplierName = Utils.getSupplierName(supplierId);
    cart.push({
      productId:    product.id,
      supplierId:   supplierId,
      productName:  product.name,
      supplierName: supplierName,
      quantity:     1,
      price:        product.price,
    });
  }

  renderCart();
  renderProducts(); // refresh cart badge
}

function changeQty(productId, supplierId, delta) {
  const idx = cart.findIndex(c => c.productId === productId && c.supplierId === supplierId);
  if (idx === -1) return;

  const stock = Utils.getStockByProductSupplier(productId, supplierId);
  const newQty = cart[idx].quantity + delta;

  if (newQty <= 0) {
    removeFromCart(productId, supplierId);
    return;
  }
  if (newQty > stock) {
    Utils.showToast(`Max available: ${stock}`, 'warning');
    return;
  }

  cart[idx].quantity = newQty;
  renderCart();
  renderProducts();
}

function removeFromCart(productId, supplierId) {
  cart = cart.filter(c => !(c.productId === productId && c.supplierId === supplierId));
  renderCart();
  renderProducts();
}

function renderCart() {
  // Show/hide empty state
  cartEmptyEl.style.display = cart.length === 0 ? 'flex' : 'none';

  // Remove existing item elements (keep empty-state div)
  Array.from(cartItemsEl.querySelectorAll('.cart-item')).forEach(el => el.remove());

  let total = 0;
  let totalItems = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    totalItems += item.quantity;

    const stock = Utils.getStockByProductSupplier(item.productId, item.supplierId);

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item__top">
        <div>
          <div class="cart-item__name">${Utils.escape(item.productName)}</div>
          <div class="cart-item__supplier">📦 ${Utils.escape(item.supplierName)}</div>
        </div>
        <button class="cart-item__remove" title="Remove">✕</button>
      </div>
      <div class="cart-item__bottom">
        <div class="qty-controls">
          <button class="qty-btn qty-btn--minus" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-btn--plus" ${item.quantity >= stock ? 'disabled' : ''}>+</button>
        </div>
        <div class="cart-item__subtotal">${Utils.formatCurrency(subtotal)}</div>
      </div>
    `;

    div.querySelector('.cart-item__remove').addEventListener('click', () =>
      removeFromCart(item.productId, item.supplierId)
    );
    div.querySelector('.qty-btn--minus').addEventListener('click', () =>
      changeQty(item.productId, item.supplierId, -1)
    );
    div.querySelector('.qty-btn--plus').addEventListener('click', () =>
      changeQty(item.productId, item.supplierId, +1)
    );

    cartItemsEl.appendChild(div);
  });

  cartTotalEl.textContent = Utils.formatCurrency(total);
  cartCountEl.textContent = totalItems;
  btnCheckout.disabled = cart.length === 0;
}

// ── Checkout ──────────────────────────────────────────────────
function renderCheckoutSummary() {
  let html = '';
  let grandTotal = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    grandTotal += subtotal;
    html += `
      <div class="checkout-item">
        <div class="checkout-item__info">
          <div class="checkout-item__name">${Utils.escape(item.productName)}</div>
          <div class="checkout-item__meta">
            Supplier: ${Utils.escape(item.supplierName)} · Qty: ${item.quantity} × ${Utils.formatCurrency(item.price)}
          </div>
        </div>
        <div class="checkout-item__price">${Utils.formatCurrency(subtotal)}</div>
      </div>
    `;
  });

  html += `<div class="checkout-total"><span>Total</span><span>${Utils.formatCurrency(grandTotal)}</span></div>`;
  checkoutSummaryEl.innerHTML = html;
}

function processCheckout() {
  // Validate stock before committing
  for (const item of cart) {
    const stock = Utils.getStockByProductSupplier(item.productId, item.supplierId);
    if (item.quantity > stock) {
      Utils.showToast(`Not enough stock for "${item.productName}". Available: ${stock}`, 'error');
      return;
    }
  }

  // Build sale record
  const saleItems = cart.map(item => {
    // Get average cost price for this product/supplier (weighted by FIFO batches)
    const inventory = DB.getData('inventory')
      .filter(i => i.productId === item.productId && i.supplierId === item.supplierId && i.quantity > 0)
      .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    const avgCost = inventory.length > 0 ? inventory[0].costPrice : 0; // use oldest batch cost

    return {
      productId:   item.productId,
      supplierId:  item.supplierId,
      quantity:    item.quantity,
      price:       item.price,
      costPrice:   avgCost,
    };
  });

  const grandTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const sale = {
    id:    DB.generateId(),
    date:  new Date().toISOString(),
    items: saleItems,
    total: grandTotal,
  };

  // Deduct inventory (FIFO)
  for (const item of cart) {
    const success = Utils.deductInventoryFIFO(item.productId, item.supplierId, item.quantity);
    if (!success) {
      Utils.showToast(`Stock deduction failed for "${item.productName}". Sale cancelled.`, 'error');
      return;
    }
  }

  // Save sale
  DB.insert('sales', sale);

  // Clear cart
  cart = [];
  renderCart();
  renderProducts();

  Utils.showToast(`✅ Sale #${sale.id.substring(0, 6).toUpperCase()} completed! Total: ${Utils.formatCurrency(grandTotal)}`);
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── Start ─────────────────────────────────────────────────────
init();

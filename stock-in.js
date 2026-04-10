<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgroFeed POS — Point of Sale</title>
  <link rel="stylesheet" href="../../shared/styles.css" />
  <link rel="stylesheet" href="pos.css" />
  <style>
    .payment-section { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; }
    .payment-section label { font-weight: 600; font-size: .85rem; display:block; margin-bottom:6px; }
    .payment-status-btns { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
    .payment-status-btn { flex:1; padding:8px 4px; border:2px solid var(--border); border-radius:var(--radius);
      background:var(--surface); cursor:pointer; font-size:.8rem; font-weight:600; text-align:center;
      transition:all .15s; }
    .payment-status-btn.active-paid   { border-color:var(--green-600); background:var(--green-100); color:var(--green-800); }
    .payment-status-btn.active-partial{ border-color:#d97706; background:#fef3c7; color:#92400e; }
    .payment-status-btn.active-unpaid { border-color:var(--red-600); background:var(--red-50,#fef2f2); color:var(--red-700,#b91c1c); }
    .tendered-row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .tendered-row input { flex:1; }
    .change-display { background:var(--bg); border-radius:var(--radius); padding:10px 14px;
      display:flex; justify-content:space-between; font-size:.9rem; }
    .balance-label { color:var(--red-600); font-weight:700; }
    .change-label  { color:var(--green-700); font-weight:700; }
  </style>
</head>
<body>

<nav class="sidebar" id="sidebar">
  <div class="sidebar__brand">
    <div class="sidebar__brand-icon">🌾</div>
    <div class="sidebar__brand-name">AgroFeed POS</div>
    <div class="sidebar__brand-sub">Feeds Store System</div>
  </div>
  <div class="sidebar__nav">
    <div class="sidebar__section-label">Main</div>
    <a href="../../index.html"><span class="nav-icon">🏠</span> Dashboard</a>
    <a href="pos.html" class="active"><span class="nav-icon">🛒</span> Point of Sale</a>
    <div class="sidebar__section-label">Management</div>
    <a href="../products/products.html"><span class="nav-icon">📦</span> Products</a>
    <a href="../suppliers/suppliers.html"><span class="nav-icon">🏭</span> Suppliers</a>
    <a href="../stock-in/stock-in.html"><span class="nav-icon">📥</span> Stock In</a>
    <a href="../inventory/inventory.html"><span class="nav-icon">🗂️</span> Inventory</a>
    <div class="sidebar__section-label">Reports</div>
    <a href="../sales/sales.html"><span class="nav-icon">📊</span> Sales</a>
  </div>
  <div class="sidebar__footer">v1.0 · AgroFeed POS</div>
</nav>

<div class="main">
  <header class="page-header">
    <button class="hamburger" id="hamburger" aria-label="Toggle menu">
      <span></span><span></span><span></span>
    </button>
    <div>
      <div class="page-header__title">🛒 Point of Sale</div>
      <div class="page-header__sub">Select a supplier, then add products to cart</div>
    </div>
  </header>

  <div class="pos-layout">
    <!-- LEFT: Product Panel -->
    <div class="pos-products-panel">
      <div class="supplier-tabs-bar">
        <div class="supplier-tabs" id="supplier-tabs"></div>
      </div>
      <div class="pos-toolbar">
        <div class="search-bar flex-1">
          <span class="search-bar__icon">🔍</span>
          <input type="text" class="form-input" id="product-search" placeholder="Search products..." />
        </div>
      </div>
      <div class="product-grid" id="product-grid"></div>
    </div>

    <!-- RIGHT: Cart Panel -->
    <div class="pos-cart-panel">
      <div class="cart-header">
        <span class="cart-title">🛒 Cart</span>
        <button class="btn btn--ghost btn--sm" id="btn-clear-cart">Clear</button>
      </div>
      <div class="cart-items" id="cart-items">
        <div class="cart-empty" id="cart-empty">
          <div style="font-size:2.5rem; opacity:.4;">🛒</div>
          <div>Cart is empty</div>
          <div class="text-small text-muted">Click products to add</div>
        </div>
      </div>
      <div class="cart-summary">
        <div class="cart-summary-row">
          <span>Sacks</span>
          <span id="cart-item-count">0</span>
        </div>
        <div class="cart-summary-row cart-total-row">
          <span>TOTAL</span>
          <span id="cart-total">₱0.00</span>
        </div>
        <button class="btn btn--primary btn--full btn--lg" id="btn-checkout" disabled>
          ✅ Checkout
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Checkout Confirm Modal -->
<div class="modal-overlay" id="modal-checkout">
  <div class="modal" style="max-width:500px;">
    <div class="modal__header">
      <div class="modal__title">Confirm Sale</div>
      <button class="modal__close" data-close-modal="modal-checkout">✕</button>
    </div>
    <div class="modal__body">
      <div id="checkout-summary"></div>

      <!-- Payment Section -->
      <div class="payment-section">
        <label>Payment Status</label>
        <div class="payment-status-btns">
          <button class="payment-status-btn active-paid" id="psbtn-paid"   data-status="paid">✅ Paid</button>
          <button class="payment-status-btn"             id="psbtn-partial" data-status="partial">⚠️ Partial</button>
          <button class="payment-status-btn"             id="psbtn-unpaid"  data-status="unpaid">❌ Unpaid</button>
        </div>

        <div id="tendered-section">
          <div class="tendered-row">
            <label style="margin-bottom:0;white-space:nowrap;">Cash Tendered (₱)</label>
            <input type="number" class="form-input" id="field-tendered" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="change-display" id="change-display">
            <span class="text-muted">Change</span>
            <span id="change-amount">₱0.00</span>
          </div>
        </div>
      </div>

      <div class="form-actions" style="margin-top:16px; padding-top:16px;">
        <button class="btn btn--secondary" data-close-modal="modal-checkout">Cancel</button>
        <button class="btn btn--primary" id="btn-confirm-checkout">✅ Confirm &amp; Complete Sale</button>
      </div>
    </div>
  </div>
</div>

<script src="../../shared/db.js"></script>
<script src="../../shared/utils.js"></script>
<script src="pos.js"></script>
</body>
</html>

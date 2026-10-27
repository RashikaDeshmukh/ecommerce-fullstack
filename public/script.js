// ---------- Helpers ----------
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

async function api(url, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = "Bearer " + user.token;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { user = null; save("user", null); renderAuth(); }
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

// ---------- State ----------
let products = [];
let cart = load("cart", []);
let user = load("user", null);

const $ = (id) => document.getElementById(id);
const grid = $("productGrid");
const nav = $("nav");

// ---------- Products ----------
async function loadProducts() {
  try {
    products = await api("/api/products");
    renderProducts();
    updateCart();
  } catch (e) {
    grid.innerHTML = '<p class="empty">Could not load products. Is the server running?</p>';
  }
}

function renderProducts() {
  const text = $("search").value.trim().toLowerCase();
  const cat = $("category").value;
  const list = products.filter(
    (p) => p.name.toLowerCase().includes(text) && (cat === "all" || p.category === cat)
  );
  grid.innerHTML = list.length
    ? list.map((p) => `
      <div class="card">
        <div class="emoji">${p.emoji}</div>
        <div class="cat">${p.category}</div>
        <h3>${p.name}</h3>
        <p class="price">₹${p.price}</p>
        <button onclick="addToCart(${p.id})">Add to Cart</button>
      </div>`).join("")
    : '<p class="empty">No products found.</p>';
}

// ---------- Cart ----------
function addToCart(id) {
  const item = cart.find((i) => i.id === id);
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  updateCart();
  openCart();
}
function changeQty(id, change) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += change;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  updateCart();
}
function removeItem(id) {
  cart = cart.filter((i) => i.id !== id);
  updateCart();
}
function updateCart() {
  save("cart", cart);
  let total = 0, count = 0;
  const rows = cart.map((i) => {
    const p = products.find((x) => x.id === i.id);
    if (!p) return "";
    total += p.price * i.qty;
    count += i.qty;
    return `
      <div class="item">
        <span class="emoji">${p.emoji}</span>
        <div class="info">${p.name}<br>₹${p.price}</div>
        <div class="qty">
          <button onclick="changeQty(${p.id}, -1)">−</button>
          <span>${i.qty}</span>
          <button onclick="changeQty(${p.id}, 1)">+</button>
        </div>
        <button class="remove" onclick="removeItem(${p.id})">🗑</button>
      </div>`;
  });
  $("cartItems").innerHTML = count ? rows.join("") : '<p class="empty">Your cart is empty.</p>';
  $("cartTotal").textContent = "₹" + total;
  $("cartCount").textContent = count;
}
function openCart() { $("cart").classList.add("open"); $("overlay").classList.add("show"); }
function closeCart() { $("cart").classList.remove("open"); $("overlay").classList.remove("show"); }

async function checkout() {
  if (cart.length === 0) return alert("Your cart is empty!");
  if (!user) { closeCart(); return showAuth("login", "Please login to place your order."); }
  try {
    const order = await api("/api/orders", "POST", { items: cart });
    cart = [];
    updateCart();
    closeCart();
    showModal(`<h3>✅ Order placed!</h3><p>Order #${order.id}</p><p>Total paid: <strong>₹${order.total}</strong></p>`);
  } catch (e) {
    alert(e.message);
  }
}

// ---------- Auth ----------
function renderAuth() {
  $("authArea").innerHTML = user
    ? `<span class="hello">Hi, ${esc(user.name)}</span>
       <button class="link-btn" onclick="showOrders()">Orders</button>
       <button class="link-btn" onclick="logout()">Logout</button>`
    : `<button class="link-btn" onclick="showAuth('login')">Login</button>`;
}

function showAuth(mode, message = "") {
  const isLogin = mode === "login";
  showModal(`
    <h3>${isLogin ? "Login" : "Create Account"}</h3>
    ${message ? `<p class="note">${esc(message)}</p>` : ""}
    <p id="authError" class="error"></p>
    ${isLogin ? "" : '<input id="aName" placeholder="Full name">'}
    <input id="aEmail" type="email" placeholder="Email">
    <input id="aPass" type="password" placeholder="Password (min 6 characters)">
    <button class="btn full" id="authSubmit">${isLogin ? "Login" : "Sign Up"}</button>
    <p class="switch">${isLogin ? "New here?" : "Already have an account?"}
      <a href="#" id="authSwitch">${isLogin ? "Sign up" : "Login"}</a></p>`);

  $("authSwitch").onclick = (e) => { e.preventDefault(); showAuth(isLogin ? "register" : "login"); };
  $("authSubmit").onclick = async () => {
    const body = { email: $("aEmail").value, password: $("aPass").value };
    if (!isLogin) body.name = $("aName").value;
    try {
      user = await api(isLogin ? "/api/login" : "/api/register", "POST", body);
      save("user", user);
      renderAuth();
      hideModal();
    } catch (e) {
      $("authError").textContent = e.message;
    }
  };
}

function logout() {
  user = null;
  save("user", null);
  renderAuth();
}

async function showOrders() {
  try {
    const orders = await api("/api/orders");
    const html = orders.length
      ? orders.map((o) => `
          <div class="order">
            <strong>Order #${o.id}</strong> <small>${new Date(o.date).toLocaleString()}</small>
            <ul>${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
            <strong>Total: ₹${o.total}</strong>
          </div>`).join("")
      : "<p>No orders yet.</p>";
    showModal(`<h3>My Orders</h3>${html}`);
  } catch (e) {
    showAuth("login", "Please login to see your orders.");
  }
}

// ---------- Modal ----------
function showModal(html) { $("modalBody").innerHTML = html; $("modal").classList.add("show"); }
function hideModal() { $("modal").classList.remove("show"); }

// ---------- Events ----------
$("search").addEventListener("input", renderProducts);
$("category").addEventListener("change", renderProducts);
$("cartBtn").addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeCart);
$("overlay").addEventListener("click", closeCart);
$("checkoutBtn").addEventListener("click", checkout);
$("modalClose").addEventListener("click", hideModal);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") hideModal(); });
$("menuBtn").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", () => nav.classList.remove("open"));

// ---------- Init ----------
renderAuth();
loadProducts();

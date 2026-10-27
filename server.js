const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/shopeasy";

// ---------- Models ----------
const Product = mongoose.model(
  "Product",
  new mongoose.Schema({
    id: { type: Number, unique: true },
    name: String,
    price: Number,
    category: String,
    emoji: String,
  })
);

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
  })
);

const orderItemSchema = new mongoose.Schema(
  { id: Number, name: String, price: Number, qty: Number },
  { _id: false }
);
const Order = mongoose.model(
  "Order",
  new mongoose.Schema({
    id: Number,
    userId: String,
    items: [orderItemSchema],
    total: Number,
    date: { type: Date, default: Date.now },
  })
);

const seedProducts = [
  { id: 1, name: "Wireless Headphones", price: 1999, category: "Electronics", emoji: "🎧" },
  { id: 2, name: "Smart Watch", price: 2999, category: "Electronics", emoji: "⌚" },
  { id: 3, name: "Bluetooth Speaker", price: 1499, category: "Electronics", emoji: "🔊" },
  { id: 4, name: "Cotton T-Shirt", price: 499, category: "Fashion", emoji: "👕" },
  { id: 5, name: "Running Shoes", price: 2499, category: "Fashion", emoji: "👟" },
  { id: 6, name: "Backpack", price: 999, category: "Fashion", emoji: "🎒" },
  { id: 7, name: "Table Lamp", price: 799, category: "Home", emoji: "💡" },
  { id: 8, name: "Coffee Mug", price: 299, category: "Home", emoji: "☕" },
];

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: "Please login first" });
  }
}

function authResponse(user) {
  const token = jwt.sign({ id: user._id.toString(), name: user.name }, SECRET, { expiresIn: "7d" });
  return { token, name: user.name };
}

// ---------- Products ----------
app.get("/api/products", wrap(async (req, res) => {
  res.json(await Product.find({}, { _id: 0, __v: 0 }).sort({ id: 1 }).lean());
}));

// ---------- Auth ----------
app.post("/api/register", wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email and password (min 6 characters) are required" });
  }
  const mail = email.toLowerCase().trim();
  if (await User.findOne({ email: mail })) {
    return res.status(400).json({ error: "Email already registered" });
  }
  const user = await User.create({
    name: name.trim(),
    email: mail,
    password: await bcrypt.hash(password, 10),
  });
  res.json(authResponse(user));
}));

app.post("/api/login", wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password || "", user.password))) {
    return res.status(400).json({ error: "Invalid email or password" });
  }
  res.json(authResponse(user));
}));

// ---------- Orders (login required) ----------
app.post("/api/orders", auth, wrap(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }
  const found = await Product.find({ id: { $in: items.map((i) => Number(i.id)) } }).lean();
  const orderItems = [];
  let total = 0;

  for (const it of items) {
    const p = found.find((x) => x.id === Number(it.id));
    const qty = parseInt(it.qty, 10);
    if (!p || !qty || qty < 1) continue;
    orderItems.push({ id: p.id, name: p.name, price: p.price, qty });
    total += p.price * qty; // price comes from database, not from the client
  }
  if (orderItems.length === 0) return res.status(400).json({ error: "Invalid items" });

  const order = await Order.create({ id: Date.now(), userId: req.user.id, items: orderItems, total });
  res.json(order);
}));

app.get("/api/orders", auth, wrap(async (req, res) => {
  res.json(await Order.find({ userId: req.user.id }).sort({ date: -1 }).lean());
}));

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ---------- Start ----------
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
    if ((await Product.countDocuments()) === 0) {
      await Product.insertMany(seedProducts);
      console.log("Sample products added");
    }
    app.listen(PORT, () => console.log(`ShopEasy running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    console.error("Make sure MongoDB is running (check: mongosh).");
    process.exit(1);
  }
}
start();

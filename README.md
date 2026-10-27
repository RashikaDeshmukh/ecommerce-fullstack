# ShopEasy - Full Stack E-commerce Website

Responsive e-commerce website built with Node.js, Express and vanilla JavaScript.

## Features
- Responsive design (mobile, tablet, desktop)
- Product listing with search and category filter
- Shopping cart (quantity, remove, total)
- User signup and login (JWT + bcrypt password hashing)
- Place orders and view order history
- REST API backend with MongoDB (Mongoose)

## Tech Stack
HTML, CSS, JavaScript, Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs

## How to Run
Make sure MongoDB is running locally (mongodb://127.0.0.1:27017).

```
npm install
npm start
```
Open http://localhost:3000

## API Endpoints
| Method | Route | Description |
|---|---|---|
| GET | /api/products | List products |
| POST | /api/register | Create account |
| POST | /api/login | Login |
| POST | /api/orders | Place order (login required) |
| GET | /api/orders | My orders (login required) |

## Future Work
Payment gateway, admin panel, deployment.

## Screenshot
![ShopEasy Homepage](screenshot.png)


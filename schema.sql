-- ============================================================
--  SAVEUR RESTAURANT BILLING SYSTEM — MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS saveur_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saveur_db;

-- ─── STAFF / AUTH ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('admin','cashier','manager') DEFAULT 'cashier',
  active      TINYINT(1)    DEFAULT 1,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- Default admin  (password: admin@123)
INSERT IGNORE INTO staff (name, email, password, role) VALUES
  ('Admin', 'admin@saveur.com',
   '$2a$10$Kx8K1VpH9VpNQtMBjD6SduBGKQ/Kz.Fx0U3gVkC2Fz3.5HReqBlIC',
   'admin');

-- ─── CATEGORIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
);

INSERT IGNORE INTO categories (name) VALUES
  ('Starters'),('Main Course'),('Rice'),('Breads'),('Beverages'),('Desserts');

-- ─── MENU ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150)  NOT NULL,
  description VARCHAR(255),
  category_id INT           NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  emoji       VARCHAR(10)   DEFAULT '🍽️',
  tags        JSON,                        -- e.g. ["veg","spicy"]
  available   TINYINT(1)    DEFAULT 1,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Seed menu
INSERT IGNORE INTO menu_items (name, description, category_id, price, emoji, tags) VALUES
  ('Paneer Butter Masala','Rich creamy tomato gravy',2,280,'🍛','["veg"]'),
  ('Dal Makhani','Slow-cooked black lentils',2,220,'🫕','["veg"]'),
  ('Chicken Tikka Masala','Tandoor chicken in spiced sauce',2,340,'🍗','["nonveg","spicy"]'),
  ('Mutton Rogan Josh','Aromatic Kashmiri curry',2,420,'🥘','["nonveg","spicy"]'),
  ('Fish Curry','Coastal coconut curry',2,380,'🐟','["nonveg","spicy"]'),
  ('Veg Biryani','Fragrant basmati with veggies',3,240,'🍚','["veg"]'),
  ('Chicken Biryani','Dum-cooked with whole spices',3,320,'🍚','["nonveg"]'),
  ('Butter Naan','Soft leavened flatbread',4,60,'🫓','["veg"]'),
  ('Garlic Roti','Whole wheat with garlic',4,50,'🫓','["veg"]'),
  ('Veg Spring Roll','Crispy with mixed veggies',1,160,'🥟','["veg"]'),
  ('Chicken Seekh Kebab','Minced chicken on skewer',1,260,'🍢','["nonveg","spicy"]'),
  ('Paneer Tikka','Grilled cottage cheese skewer',1,240,'🍡','["veg"]'),
  ('Lassi (Sweet)','Chilled yoghurt drink',5,80,'🥛','["veg"]'),
  ('Mango Juice','Fresh seasonal mango',5,100,'🥭','["veg"]'),
  ('Cold Coffee','Blended with ice cream',5,120,'☕','["veg"]'),
  ('Gulab Jamun','Soft dumplings in sugar syrup',6,100,'🍮','["veg"]'),
  ('Rasgulla','Chenna balls in rose syrup',6,90,'🍡','["veg"]'),
  ('Ice Cream (2 scoops)','Choose from 6 flavours',6,110,'🍦','["veg"]');

-- ─── ORDERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  bill_no       VARCHAR(20)   NOT NULL UNIQUE,
  customer_name VARCHAR(100)  DEFAULT 'Guest',
  customer_phone VARCHAR(15),
  order_type    ENUM('Dine In','Takeaway','Delivery') DEFAULT 'Dine In',
  table_no      TINYINT,
  subtotal      DECIMAL(10,2) DEFAULT 0,
  discount      DECIMAL(10,2) DEFAULT 0,
  gst           DECIMAL(10,2) DEFAULT 0,
  grand_total   DECIMAL(10,2) DEFAULT 0,
  payment_mode  ENUM('Cash','Card','UPI') DEFAULT 'Cash',
  payment_status ENUM('pending','paid') DEFAULT 'paid',
  staff_id      INT,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- ─── ORDER ITEMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT           NOT NULL,
  menu_item_id INT          NOT NULL,
  name        VARCHAR(150),
  price       DECIMAL(10,2),
  qty         INT           DEFAULT 1,
  total       DECIMAL(10,2),
  FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

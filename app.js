// app.js
const express = require('express');
const bcrypt  = require('bcrypt');
const con     = require('./db'); // <- ดูไฟล์ db.js ด้านล่าง
const app     = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- util ----------
const http500 = (res, msg='Server error') => res.status(500).send(msg);

// ---------- hash preview (สำหรับเทส) ----------
app.get('/password/:raw', (req, res) => {
  bcrypt.hash(req.params.raw, 10, (err, hash) => {
    if (err) return http500(res, 'Hashing error');
    res.send(hash);
  });
});

// ---------- register ----------
app.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).send('Missing username or password');

  con.query('SELECT id FROM users WHERE username = ?', [username], (err, rows) => {
    if (err) return http500(res, 'DB error');
    if (rows.length > 0) return res.status(409).send('Username already exists');

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return http500(res, 'Hashing error');
      con.query('INSERT INTO users(username, password) VALUES (?, ?)', [username, hash], (err) => {
        if (err) return http500(res, 'DB error');
        res.send('Insert done');
      });
    });
  });
});

// ---------- login (return JSON {message,userId,username}) ----------
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).send('Missing username or password');

  con.query('SELECT id, password FROM users WHERE username = ?', [username], (err, rows) => {
    if (err) return http500(res, 'Database server error');
    if (rows.length !== 1) return res.status(401).send('Wrong username');

    bcrypt.compare(password, rows[0].password, (err, same) => {
      if (err) return http500(res, 'Password checking error');
      if (!same) return res.status(401).send('Wrong password');
      res.json({ message: 'Login OK', userId: rows[0].id, username });
    });
  });
});

// ---------- get all expenses (optional filter by user_id) ----------
app.get('/expenses', (req, res) => {
  const userId = req.query.user_id || null;
  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE (? IS NULL OR user_id = ?)
    ORDER BY id
  `;
  con.query(sql, [userId, userId], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- get today's expenses (require user_id) ----------
app.get('/expenses/today', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).send('Missing user_id');

  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE user_id = ? AND DATE(date) = CURDATE()
    ORDER BY id
  `;
  con.query(sql, [user_id], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- search expenses by keyword (require user_id & q) ----------
app.get('/expenses/search', (req, res) => {
  const { user_id, q } = req.query;
  if (!user_id || !q) return res.status(400).send('Missing user_id or q');

  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE user_id = ? AND item LIKE CONCAT('%', ?, '%')
    ORDER BY id
  `;
  con.query(sql, [user_id, q], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- add expense ----------
app.post('/expenses', (req, res) => {
  const { user_id, item, paid } = req.body || {};
  if (!user_id || !item || !paid) return res.status(400).send('Missing field');

  const sql = 'INSERT INTO expense(user_id, item, paid, date) VALUES (?, ?, ?, NOW())';
  con.query(sql, [user_id, item, paid], (err) => {
    if (err) return http500(res, 'DB Server Error');
    res.send('Insert expense done');
  });
});

// ---------- delete expense (protect by user_id) ----------
app.delete('/expenses/:id', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).send('Missing user_id');

  con.query('DELETE FROM expense WHERE id = ? AND user_id = ?', [id, user_id], (err, r) => {
    if (err) return http500(res, 'DB Server Error');
    if (r.affectedRows === 0) return res.status(404).send('Not found');
    res.send('Delete done');
  });
});

// ---------- start ----------
const PORT = 3000;
app.listen(PORT, () => console.log('Server is running at ' + PORT));

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

// ---------- get all expenses (path param userId) ----------
app.get('/expenses/:userId', (req, res) => {
  const { userId } = req.params;
  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE user_id = ?
    ORDER BY id
  `;
  con.query(sql, [userId], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- get today's expenses (path param userId) ----------
app.get('/expenses/:userId/today', (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).send('Missing userId');

  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE user_id = ? AND DATE(date) = CURDATE()
    ORDER BY id
  `;
  con.query(sql, [userId], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- search expenses by keyword ----------
app.get('/expenses/:userId/search/:q', (req, res) => {
  const { userId, q } = req.params;
  if (!userId || !q) return res.status(400).send('Missing userId or keyword');

  const sql = `
    SELECT id, item, paid, date
    FROM expense
    WHERE user_id = ? AND item LIKE CONCAT('%', ?, '%')
    ORDER BY id
  `;
  con.query(sql, [userId, q], (err, rows) => {
    if (err) return http500(res, 'DB Server Error');
    res.json(rows);
  });
});

// ---------- add expense ----------
app.post('/expenses/:userId', (req, res) => {
  const { userId } = req.params;
  const { item, paid } = req.body || {};
  if (!userId || !item || !paid) return res.status(400).send('Missing field');

  const sql = 'INSERT INTO expense(user_id, item, paid, date) VALUES (?, ?, ?, NOW())';
  con.query(sql, [userId, item, paid], (err) => {
    if (err) return http500(res, 'DB Server Error');
    res.send('Insert expense done');
  });
});

// ---------- delete expense ----------
app.delete('/expenses/:userId/:id', (req, res) => {
  const { userId, id } = req.params;
  if (!userId) return res.status(400).send('Missing userId');

  con.query('DELETE FROM expense WHERE id = ? AND user_id = ?', [id, userId], (err, r) => {
    if (err) return http500(res, 'DB Server Error');
    if (r.affectedRows === 0) return res.status(404).send('Not found');
    res.send('Delete done');
  });
});

// ---------- start ----------
const PORT = 3000;
app.listen(PORT, () => console.log('Server is running at ' + PORT));

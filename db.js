// db.js
const mysql = require('mysql');

const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',     
  password: '',        
  database: 'expenses',  
});

con.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err.message);
    process.exit(1); 
  }
});

module.exports = con;

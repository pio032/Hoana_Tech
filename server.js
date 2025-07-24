//---------------------------------------------------------------INIZIALIZZAZIONE SERVER---------------------------------------------------------------
const express = require('express');
const app = express();
require('dotenv').config();
const path = require('path');


const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurazione MySQL
const mysql = require('mysql2');
const conn = mysql.createConnection({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName
});

// Test connessione database
conn.connect((err) => {
  if (err) {
    console.error('Errore connessione database:', err);
    return;
  }
  console.log('Connesso al database MySQL');
});

//-----------------------------------------------------------------LOGIN----------------------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log("Username:", username);
  console.log("Password:", password);
  const query = 'SELECT * FROM user WHERE username = ? AND passsword = ?';
  conn.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Errore query:', err);
      res.status(500).send('Errore del server');
      return;
    }

    if (results.length > 0) {
      //LOGIN SUCCESS
      console.log("result", results[0].id);
      conn.query("select tipo from user where id = ?", [results[0].id], (err, results) => {
        if (err) {
          console.error('Errore query:', err);
          res.status(500).send('Errore del server');
          return;
        }
        if(results.length>0){
          switch(results[0].tipo){
                  case "admin":
                      res.sendFile(path.join(__dirname, 'secure/admin/admin.html'));
                      break;
                  case "cucina":
                      res.sendFile(path.join(__dirname, 'secure/cucina.html'));
                      break;
                  case "bancone":
                      res.sendFile(path.join(__dirname, 'secure/bancone.html'));
                      break;
                  case "cassa":
                      res.sendFile(path.join(__dirname, 'secure/cassa.html'));
                      break;
                      
          }
        }
      })
    } else {
      console.log("login fallito");
    }
  });
 
});
//------------------------------------------------------------------ROUTE----------------------------------------------------------------
app.get("/admin", (req, res)=>{
  res.sendFile(path.join(__dirname, 'secure/admin/admin.html'));
})

//------------------------------------------------------------------ADMIN------------------------------------------------------------------

app.get("/admin/user", (req, res)=>{
 const query = 'SELECT * FROM user';
  
  conn.query(query, (err, results) => {
    if (err) {
      console.error('Errore query utenti:', err);
      res.status(500).send('Errore del server');
      return;
    }
    
    res.json(results);
  })
})
app.get("/admin/select", (req, res)=>{
  res.sendFile(path.join(__dirname, 'secure/admin/user.html'));
})
// Aggiorna utente
app.post('/admin/users/update', (req, res) => {
  const { id, username, password, tipo } = req.body;
  
  let query = 'UPDATE user SET username = ?, tipo = ?';
  let params = [username, tipo];
  
  if (password && password.trim() !== '') {
    query += ', password = ?';
    params.push(password);
  }
  
  query += ' WHERE id = ?';
  params.push(id);
  
  conn.query(query, params, (err, result) => {
    if (err) {
      console.error('Errore aggiornamento utente:', err);
      res.json({ success: false, message: 'Errore del server' });
      return;
    }
    res.json({ success: true, message: 'Utente aggiornato con successo' });
  });
});

// Elimina utente
app.post('/admin/users/delete', (req, res) => {
  const { id } = req.body;
  
  const query = 'DELETE FROM user WHERE id = ?';
  conn.query(query, [id], (err, result) => {
    if (err) {
      console.error('Errore eliminazione utente:', err);
      res.json({ success: false, message: 'Errore del server' });
      return;
    }
    
    if (result.affectedRows === 0) {
      res.json({ success: false, message: 'Utente non trovato' });
      return;
    }
    
    res.json({ success: true, message: 'Utente eliminato con successo' });
  });
});

//-----------------------------------------------------------------LISTEN----------------------------------------------------------------
app.listen(3000, () => {
  console.log('Server su http://localhost:3000');
});
//---------------------------------------------------------------INIZIALIZZAZIONE SERVER---------------------------------------------------------------
const express = require('express');
const app = express();
require('dotenv').config();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors')
app.use(cors({
  origin: 'http://localhost:3000', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
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
                  case "cameriere":
                      res.sendFile(path.join(__dirname, 'secure/cam/cam.html'));
                      
          }
        }
      })
    } else {
    
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
    query += ', passsword = ?';
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


// Endpoint per mostrare la pagina di creazione
app.get('/admin/users/create', (req, res) => {
  res.sendFile(path.join(__dirname, '/secure/admin/create.html')); 
});

// Endpoint per creare l'utente
app.post('/admin/users/create', (req, res) => {
  const { username, password, tipo } = req.body;

  // Validazioni server-side
  if (!username || !password || !tipo) {
    res.json({ success: false, message: 'Tutti i campi sono obbligatori' });
    return;
  }
  
  if (password.length < 6) {
    res.json({ success: false, message: 'La password deve essere di almeno 6 caratteri' });
    return;
  }
  
  // Verifica se l'username esiste già
  const checkQuery = 'SELECT id FROM user WHERE username = ?';
  conn.query(checkQuery, [username], (err, results) => {
    if (err) {
      console.error('Errore verifica username:', err);
      res.json({ success: false, message: 'Errore del server' });
      return;
    }
    
    if (results.length > 0) {
      res.json({ success: false, message: 'Username già esistente' });
      return;
    }
    
  
    const insertQuery = 'INSERT INTO user (username, passsword, tipo) VALUES (?, ?, ?)';
    conn.query(insertQuery, [username, password, tipo], (err, result) => {
      if (err) {
        console.error('Errore creazione utente:', err);
        res.json({ success: false, message: 'Errore nella creazione dell\'utente' });
        return;
      }
      
      res.json({ 
        success: true, 
        message: 'Utente creato con successo',
        userId: result.insertId 
      });
    });
  });
});

app.get('/api/admin/stats', async (req, res) => {
  const stats = {};

  conn.query('SELECT COUNT(*) AS totale FROM user', (err, resultUtenti) => {
    if (err) {
      console.error('Errore nel conteggio utenti:', err);
      return res.status(500).json({ success: false, message: 'Errore nel conteggio utenti' });
    }

    stats.utenti = resultUtenti[0].totale;

    conn.query('SELECT COUNT(*) AS totale FROM prodotti', (err2, resultProdotti) => {
      if (err2) {
        console.error('Errore nel conteggio prodotti:', err2);
        return res.status(500).json({ success: false, message: 'Errore nel conteggio prodotti' });
      }

      stats.prodotti = resultProdotti[0].totale;
      res.json(stats);
    });
  });
});


app.get("/admin/products/create", (req, res)=>{
    res.sendFile(path.join(__dirname, 'secure/admin/addProduct.html'));
})

// Configurazione multer per l'upload delle immagini
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    // Crea la cartella uploads se non esiste
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Genera un nome univoco per il file
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + extension);
  }
});

// Filtro per accettare solo immagini
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo file immagine sono permessi!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite 5MB
  }
});

// Endpoint per aggiungere un prodotto
app.post('/addProduct', upload.single('foto'), (req, res) => {
  try {
    const { nome, descrizione, prezzo, tipo } = req.body;
    
    // Validazione dei dati
    if (!nome || !descrizione || !prezzo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome, descrizione e prezzo sono obbligatori' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'La foto del prodotto è obbligatoria' 
      });
    }

    // Path relativo della foto da salvare nel database
    const fotoPath = 'uploads/' + req.file.filename;
    
    // Query per inserire il prodotto nel database
    const query = 'INSERT INTO prodotti (nome, descrizione, prezzo, fotoPath, tipo) VALUES (?, ?, ?, ?, ?)';
    const values = [nome, descrizione, parseFloat(prezzo), fotoPath, tipo];

    conn.query(query, values, (err, result) => {
      if (err) {
        console.error('Errore nell\'inserimento del prodotto:', err);
        
        // Rimuovi il file caricato se c'è un errore nel database
        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Errore nella rimozione del file:', unlinkErr);
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          message: 'Errore nell\'inserimento del prodotto nel database' 
        });
      }

      console.log('Prodotto inserito con ID:', result.insertId);
      
      // Risposta di successo - reindirizza alla pagina admin
      res.redirect('/admin?success=1&message=Prodotto aggiunto con successo');
    });

  } catch (error) {
    console.error('Errore generale:', error);
    
    // Rimuovi il file caricato se c'è un errore
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Errore nella rimozione del file:', unlinkErr);
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Errore interno del server' 
    });
  }
});

// Middleware per servire file statici dalla cartella uploads
app.use('/uploads', express.static('uploads'));


app.get("/admin/prod", (req, res)=>{
  res.sendFile(path.join(__dirname, 'secure/admin/product.html'))
})


// Ottieni tutti i prodotti
app.get('/api/products', (req, res) => {
  const query = 'SELECT id, nome, descrizione, prezzo, fotoPath as foto, tipo FROM prodotti';
  
  conn.query(query, (err, results) => {
    if (err) {
      console.error('Errore query:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Errore nel recupero dei prodotti' 
      });
    }

    res.json({ 
      success: true, 
      products: results 
    });
  });
});



app.delete('/api/products/:id', (req, res) => {
  console.log("Richiesta DELETE di eliminazione ricevuta per ID:", req.params.id);

  const productId = req.params.id;
  if (!productId) {
    return res.status(400).json({ success: false, message: "ID prodotto mancante" });
  }

  // Recupera il prodotto
  conn.query('SELECT fotoPath FROM prodotti WHERE id = ?', [productId], (err, rows) => {
    if (err) {
      console.error("Errore query SELECT:", err);
      return res.status(500).json({ success: false, message: "Errore server durante la ricerca" });
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prodotto non trovato" });
    }

    const product = rows[0];

    // Elimina l'immagine se esiste
    if (product.fotoPath) {
      const fullPath = path.join(__dirname, product.fotoPath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (fileError) {
          console.error("Errore eliminazione file:", fileError);
          // Continua comunque con l'eliminazione dal DB
        }
      }
    }

    // Elimina il prodotto dal database
    conn.query('DELETE FROM prodotti WHERE id = ?', [productId], (deleteErr, deleteResult) => {
      if (deleteErr) {
        console.error("Errore eliminazione prodotto:", deleteErr);
        return res.status(500).json({ success: false, message: "Errore server durante l'eliminazione" });
      }

      res.json({ success: true, message: "Prodotto eliminato con successo" });
    });
  });
});


//----------------------------------------------------------------CAMERIERE--------------------------------------------------------------


app.get("/doComanda", (req, res)=>{
    res.sendFile(path.join(__dirname, 'secure/cam/comanda.html'));
})


app.post("/api/orders", (req, res)=>{

 const { tavolo, items } = req.body;

  if (!tavolo || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Dati mancanti o invalidi" });
  }

  conn.beginTransaction(err => {
    if (err) return res.status(500).json({ error: "Errore transazione" });

    // Inserisci comanda
    conn.query(
      "INSERT INTO comanda (tavolo) VALUES (?)",
      [tavolo],
      (err, result) => {
        if (err) {
          return conn.rollback(() => {
            res.status(500).json({ error: "Errore inserimento comanda" });
          });
        }

        const comandaId = result.insertId;

        // Funzione per inserire ordini uno alla volta espandendo quantità
        const insertOrders = (index) => {
          if (index >= items.length) {
            // Fine inserimenti, commit transazione
            return conn.commit(err => {
              if (err) {
                return conn.rollback(() => {
                  res.status(500).json({ error: "Errore commit" });
                });
              }
              res.status(200).send("OK");
            });
          }

          const item = items[index];

          // Per ogni unità di quantità crea una riga distinta
          let count = 0;

          const insertSingleOrder = () => {
            if (count >= item.quantity) {
              // Passa all'item successivo
              return insertOrders(index + 1);
            }
            console.log("item", item)

            conn.query(
              `INSERT INTO ordini (comanda_id, nome_prodotto, prezzo, note, path_foto, pagato)
   VALUES (?, ?, ?, ?, ?, FALSE)`,
  [comandaId, item.name, item.price, item.note || '', item.foto],
              (err) => {
                if (err) {
                  return conn.rollback(() => {
                    res.status(500).json({ error: "Errore inserimento ordine" });
                  });
                }
                count++;
                insertSingleOrder();
              }
            );
          };

          insertSingleOrder();
        };

        insertOrders(0);
      }
    );
  });
  
})


//-----------------------------------------------------------------LISTEN----------------------------------------------------------------
app.listen(3000, () => {
  console.log('Server su http://localhost:3000');
});
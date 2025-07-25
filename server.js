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

      conn.query("select tipo from user where id = ?", [results[0].id], (err, results) => {
        if (err) {
          console.error('Errore query:', err);
          res.status(500).send('Errore del server');
          return;
        }
        if (results.length > 0) {
          switch (results[0].tipo) {
            case "admin":
              res.sendFile(path.join(__dirname, 'secure/admin/admin.html'));
              break;
            case "cucina":
              res.sendFile(path.join(__dirname, 'secure/cucina/cucina.html'));
              break;
            case "bancone":
              res.sendFile(path.join(__dirname, 'secure/bancone/bancone.html'));
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
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/admin.html'));
})
app.get("/cameriere", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/cam.html'));
})

//------------------------------------------------------------------ADMIN------------------------------------------------------------------

app.get("/admin/user", (req, res) => {
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
app.get("/admin/select", (req, res) => {
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


app.get("/admin/products/create", (req, res) => {
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


app.get("/admin/prod", (req, res) => {
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


app.get("/doComanda", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/comanda.html'));
})


app.post("/api/orders", (req, res) => {
  const { tavolo, items } = req.body;

  // Validazione input
  if (!tavolo || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Dati mancanti o invalidi" });
  }

  // Estrai tutti i nomi dei prodotti per la query
  const nomiProdotti = items.map(item => item.name);

  // Recupera tipo (food/drink) da prodotti.nome
  const placeholders = nomiProdotti.map(() => '?').join(',');
  const query = `SELECT nome, tipo FROM prodotti WHERE nome IN (${placeholders})`;

  conn.query(query, nomiProdotti, (err, risultati) => {
    if (err) {
      console.error("Errore durante il recupero dei tipi:", err);
      return res.status(500).json({ error: "Errore recupero tipi" });
    }

    // Verifica che tutti i prodotti esistano
    if (risultati.length !== nomiProdotti.length) {
      const prodottiTrovati = risultati.map(r => r.nome);
      const prodottiMancanti = nomiProdotti.filter(nome => !prodottiTrovati.includes(nome));
      console.error("Prodotti non trovati:", prodottiMancanti);
      return res.status(400).json({ 
        error: "Prodotti non trovati", 
        prodotti_mancanti: prodottiMancanti 
      });
    }

    // Crea una mappa nome -> tipo
    const tipoMap = {};
    risultati.forEach(r => {
      tipoMap[r.nome] = r.tipo;
    });

    // Determina se ci sono food/drink
    const hasFood = items.some(item => tipoMap[item.name] === 'food');
    const hasDrink = items.some(item => tipoMap[item.name] === 'drink');

    // Logica corretta con 'n' aggiunto all'ENUM:
    // - Se ci sono food: stato='in_corso', altrimenti stato='n' 
    // - Se ci sono drink: stato_drink='in_corso', altrimenti stato_drink='n'
    const stato = hasFood ? 'in_corso' : 'n';
    const stato_drink = hasDrink ? 'in_corso' : 'n';

    // Debug: mostra i valori che stiamo per inserire
    console.log("Valori da inserire:", { 
      tavolo, 
      stato, 
      stato_drink,
      hasFood,
      hasDrink,
      tipoMap 
    });

    // Inizia la transazione
    conn.beginTransaction(err => {
      if (err) {
        console.error("Errore avvio transazione:", err);
        return res.status(500).json({ error: "Errore transazione" });
      }

      // Inserisci comanda con query più esplicita
      const insertComandaQuery = "INSERT INTO comanda (tavolo, stato, stato_drink) VALUES (?, ?, ?)";
      const insertComandaValues = [tavolo, stato, stato_drink];
      
      console.log("Query:", insertComandaQuery);
      console.log("Values:", insertComandaValues);
      
      conn.query(insertComandaQuery, insertComandaValues, (err, result) => {
          if (err) {
            console.error("Errore inserimento comanda:", err);
            return conn.rollback(() => {
              res.status(500).json({ error: "Errore inserimento comanda" });
            });
          }

          const comandaId = result.insertId;
          
          // Prepara tutti gli ordini da inserire
          const ordiniDaInserire = [];
          items.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
              ordiniDaInserire.push([
                comandaId, 
                item.name, 
                item.price, 
                item.note || '', 
                item.fotoPath || item.foto || null, // Gestisci entrambi i nomi
                false // pagato
              ]);
            }
          });

          // Inserisci tutti gli ordini in una volta
          if (ordiniDaInserire.length === 0) {
            return conn.rollback(() => {
              res.status(400).json({ error: "Nessun ordine da inserire" });
            });
          }

          const insertQuery = `INSERT INTO ordini (comanda_id, nome_prodotto, prezzo, note, path_foto, pagato) VALUES ?`;
          
          conn.query(insertQuery, [ordiniDaInserire], (err) => {
            if (err) {
              console.error("Errore inserimento ordini:", err);
              return conn.rollback(() => {
                res.status(500).json({ error: "Errore inserimento ordini" });
              });
            }

            // Commit della transazione
            conn.commit(err => {
              if (err) {
                console.error("Errore commit:", err);
                return conn.rollback(() => {
                  res.status(500).json({ error: "Errore commit" });
                });
              }
              
              res.status(200).json({ 
                success: true, 
                message: "Ordine inserito con successo",
                comanda_id: comandaId 
              });
            });
          });
        }
      );
    });
  });
});

app.get("/viewComanda", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/view.html'));
})

app.get('/api/comande', (req, res) => {
  const queryComande = `
    SELECT 
      c.id AS comanda_id, 
      c.tavolo, 
      c.stato, 
      c.stato_drink,
      o.nome_prodotto, 
      o.path_foto
    FROM comanda c
    JOIN ordini o ON c.id = o.comanda_id
    WHERE c.fine = 0
    ORDER BY c.id DESC
  `;

  conn.query(queryComande, (err, results) => {
    if (err) {
      console.error("Errore nel recupero delle comande:", err);
      return res.status(500).json({ error: "Errore server" });
    }

    const comande = {};

    for (const row of results) {
      if (!comande[row.comanda_id]) {
        comande[row.comanda_id] = {
          tavolo: row.tavolo,
          stato: row.stato,
          stato_drink: row.stato_drink,
          prodotti: []
        };
      }

      comande[row.comanda_id].prodotti.push({
        nome: row.nome_prodotto,
        foto: row.path_foto
      });
    }

    res.json(Object.entries(comande).map(([id, data]) => ({
      id,
      ...data
    })));
  });
});

app.post("/api/cameriere/done", (req, res) => {
  const { comanda_id } = req.body;

  // Validazione input
  if (!comanda_id) {
    return res.status(400).json({ error: "ID comanda mancante" });
  }

  // Verifica che la comanda esista
  conn.query("SELECT id FROM comanda WHERE id = ?", [comanda_id], (err, result) => {
    if (err) {
      console.error("Errore verifica comanda:", err);
      return res.status(500).json({ error: "Errore verifica comanda" });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: "Comanda non trovata" });
    }

    // Aggiorna il campo 'fine' a TRUE (1 in MySQL)
    conn.query(
      "UPDATE comanda SET fine = TRUE WHERE id = ?",
      [comanda_id],
      (err, updateResult) => {
        if (err) {
          console.error("Errore aggiornamento comanda:", err);
          return res.status(500).json({ error: "Errore aggiornamento comanda" });
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ error: "Comanda non trovata per l'aggiornamento" });
        }

        console.log(`Comanda #${comanda_id} completata - campo 'fine' impostato a TRUE`);
        
        res.status(200).json({ 
          success: true, 
          message: "Comanda completata con successo",
          comanda_id: comanda_id
        });
      }
    );
  });
});



//------------------------------------------------------------------CUCINA-------------------------------------------------------------
app.get('/api/cucina', (req, res) => {
  const query = `
    SELECT 
      c.id AS comanda_id,
      c.tavolo,
      c.stato,
      c.orario_creazione,
      o.nome_prodotto,
      o.path_foto,
      p.tipo
    FROM comanda c
    JOIN ordini o ON o.comanda_id = c.id
    JOIN prodotti p ON o.nome_prodotto = p.nome
    WHERE p.tipo = 'food' AND c.stato != 'pronta'
    ORDER BY c.orario_creazione ASC
  `;

  conn.query(query, (err, results) => {
    if (err) {
      console.error('Errore nella query:', err);
      return res.status(500).json({ error: 'Errore nel recupero dei dati cucina' });
    }

    // Raggruppa i risultati per comanda
    const comande = {};
    results.forEach(row => {
      if (!comande[row.comanda_id]) {
        comande[row.comanda_id] = {
          comanda_id: row.comanda_id,
          tavolo: row.tavolo,
          stato: row.stato,
          prodotti: []
        };
      }

      comande[row.comanda_id].prodotti.push({
        nome_prodotto: row.nome_prodotto,
        path_foto: row.path_foto
      });
    });

    res.json(Object.values(comande));
  });
});


app.post('/api/cucina/complete', (req, res) => {
  const { comandaId } = req.body;

  if (!comandaId) {
    return res.status(400).json({ error: "Manca il parametro comandaId" });
  }

  conn.query(
    'UPDATE comanda SET stato = ? WHERE id = ?',
    ['pronta', comandaId],
    (err, results) => {
      if (err) {
        console.error('Errore aggiornando comanda:', err);
        return res.status(500).json({ error: "Errore interno del server" });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Comanda non trovata" });
      }

      res.json({ message: "Comanda completata con successo" });
    }
  );
});

//--------------------------------------------------------------------BANCONE-------------------------------------------------------------
// Mostra solo comande con drink non completate
app.get('/api/bancone', (req, res) => {
  const query = `
    SELECT 
      c.id AS comanda_id,
      c.tavolo,
      c.stato_drink,
      c.orario_creazione,
      o.nome_prodotto,
      o.path_foto,
      p.tipo
    FROM comanda c
    JOIN ordini o ON o.comanda_id = c.id
    JOIN prodotti p ON o.nome_prodotto = p.nome
    WHERE p.tipo = 'drink' AND c.stato_drink != 'pronta'
    ORDER BY c.orario_creazione ASC
  `;

  conn.query(query, (err, results) => {
    if (err) {
      console.error('Errore nella query:', err);
      return res.status(500).json({ error: 'Errore nel recupero dei dati bancone' });
    }

    const comande = {};
    results.forEach(row => {
      if (!comande[row.comanda_id]) {
        comande[row.comanda_id] = {
          comanda_id: row.comanda_id,
          tavolo: row.tavolo,
          stato_drink: row.stato_drink,
          prodotti: []
        };
      }

      comande[row.comanda_id].prodotti.push({
        nome_prodotto: row.nome_prodotto,
        path_foto: row.path_foto
      });
    });

    res.json(Object.values(comande));
  });
});



// API per completare comanda da bancone
app.post('/api/bancone/complete', (req, res) => {
  const { comandaId } = req.body;

  const query = "UPDATE comanda SET stato_drink = 'pronta' WHERE id = ?";
  conn.query(query, [comandaId], (err) => {
    if (err) {
      console.error('Errore aggiornando stato_drink:', err);
      return res.status(500).json({ error: 'Errore aggiornamento stato_drink' });
    }
    res.sendStatus(200);
  });
});





//-----------------------------------------------------------------LISTEN----------------------------------------------------------------
app.listen(3000, () => {
  console.log('Server su http://localhost:3000');
});
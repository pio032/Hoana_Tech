//---------------------------------------------------------------INIZIALIZZAZIONE SERVER---------------------------------------------------------------
const express = require('express');
const app = express();
require('dotenv').config();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('log.txt', logMessage, 'utf8');
}

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

const mysql = require('mysql2');
const conn = mysql.createConnection({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName
});

const sessionStore = new MySQLStore({
  expiration: 86400000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, conn);

app.use(session({
  key: 'restaurant_session',
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-this',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

conn.connect((err) => {
  if (err) {
    writeLog('Errore connessione database: ' + err.message);
    return;
  }
  writeLog('Connesso al database MySQL');
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ error: 'Accesso non autorizzato' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Accesso non autorizzato' });
    }

    if (!roles.includes(req.session.user.tipo)) {
      return res.status(403).json({ error: 'Permessi insufficienti' });
    }

    return next();
  };
}

//-----------------------------------------------------------------LOGIN----------------------------------------------------------------

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(getDashboardPath(req.session.user.tipo));
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

function getDashboardPath(tipo) {
  switch (tipo) {
    case "admin": return '/admin';
    case "cucina": return '/cucina';
    case "bancone": return '/bancone';
    case "cassa": return '/cassa';
    case "cameriere": return '/cameriere';
    default: return '/';
  }
}
function getTipo(tipo){
  switch (tipo) {
    case "admin": return {admin:"admin"};
    case "cucina": return {cucina:"cucina"};
    case "bancone": return {bancone:"bancone"};
    case "cassa": return {cassa:"cassa"};
    case "cameriere": return {cameriere:"cameriere"};
    default: return '/';
  }
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM user WHERE username = ? AND passsword = ?';
  conn.query(query, [username, password], (err, results) => {
    if (err) {
      writeLog('Errore query: ' + err.message);
      res.status(500).json({ error: 'Errore del server' });
      return;
    }

    if (results.length > 0) {
      const user = results[0];

      req.session.user = {
        id: user.id,
        username: user.username,
        tipo: user.tipo
      };

      writeLog(`✅ Login effettuato: ${user.username} (${user.tipo})`);

      res.redirect(getDashboardPath(user.tipo));
      res.send(getTipo(user.tipo))
    } else {
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  });
});

app.post('/logout', (req, res) => {
  if (req.session) {
    const username = req.session.user?.username || 'Utente sconosciuto';
    req.session.destroy((err) => {
      if (err) {
        writeLog('Errore durante il logout: ' + err.message);
        return res.status(500).json({ error: 'Errore durante il logout' });
      }
      writeLog(`🚪 Logout effettuato: ${username}`);
      res.clearCookie('restaurant_session');
      res.json({ success: true, message: 'Logout effettuato con successo' });
    });
  } else {
    res.json({ success: true, message: 'Nessuna sessione attiva' });
  }
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        username: req.session.user.username,
        tipo: req.session.user.tipo
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

//------------------------------------------------------------------ROUTE----------------------------------------------------------------
app.get("/admin", requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/admin.html'));
});

app.get("/cameriere", requireRole(['cameriere', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/cam.html'));
});

app.get("/cassa", requireRole(['cassa', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cassa/cassa.html'));
});

app.get("/cucina", requireRole(['cucina', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cucina/cucina.html'));
});

app.get("/bancone", requireRole(['bancone', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/bancone/bancone.html'));
});

//------------------------------------------------------------------ADMIN------------------------------------------------------------------

app.get("/admin/user", requireRole(['admin']), (req, res) => {
  const query = 'SELECT * FROM user';

  conn.query(query, (err, results) => {
    if (err) {
      writeLog('Errore query utenti: ' + err.message);
      res.status(500).send('Errore del server');
      return;
    }

    res.json(results);
  });
});

app.get("/admin/select", requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/user.html'));
});

app.post('/admin/users/update', requireRole(['admin']), (req, res) => {
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
      writeLog('Errore aggiornamento utente: ' + err.message);
      res.json({ success: false, message: 'Errore del server' });
      return;
    }
    res.json({ success: true, message: 'Utente aggiornato con successo' });
  });
});

app.post('/admin/users/delete', requireRole(['admin']), (req, res) => {
  const { id } = req.body;

  const query = 'DELETE FROM user WHERE id = ?';
  conn.query(query, [id], (err, result) => {
    if (err) {
      writeLog('Errore eliminazione utente: ' + err.message);
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

app.get('/admin/users/create', requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '/secure/admin/create.html'));
});

app.post('/admin/users/create', requireRole(['admin']), (req, res) => {
  const { username, password, tipo } = req.body;

  if (!username || !password || !tipo) {
    res.json({ success: false, message: 'Tutti i campi sono obbligatori' });
    return;
  }

  if (password.length < 6) {
    res.json({ success: false, message: 'La password deve essere di almeno 6 caratteri' });
    return;
  }

  const checkQuery = 'SELECT id FROM user WHERE username = ?';
  conn.query(checkQuery, [username], (err, results) => {
    if (err) {
      writeLog('Errore verifica username: ' + err.message);
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
        writeLog('Errore creazione utente: ' + err.message);
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

app.get('/api/admin/stats', requireRole(['admin']), async (req, res) => {
  const stats = {};

  conn.query('SELECT COUNT(*) AS totale FROM user', (err, resultUtenti) => {
    if (err) {
      writeLog('Errore nel conteggio utenti: ' + err.message);
      return res.status(500).json({ success: false, message: 'Errore nel conteggio utenti' });
    }

    stats.utenti = resultUtenti[0].totale;

    conn.query('SELECT COUNT(*) AS totale FROM prodotti', (err2, resultProdotti) => {
      if (err2) {
        writeLog('Errore nel conteggio prodotti: ' + err2.message);
        return res.status(500).json({ success: false, message: 'Errore nel conteggio prodotti' });
      }

      stats.prodotti = resultProdotti[0].totale;
      res.json(stats);
    });
  });
});

app.get("/admin/products/create", requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/addProduct.html'));
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + extension);
  }
});

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
    fileSize: 5 * 1024 * 1024
  }
});

app.post('/addProduct', requireRole(['admin']), upload.single('foto'), (req, res) => {
  try {
    const { nome, descrizione, prezzo, tipo } = req.body;

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

    const fotoPath = 'uploads/' + req.file.filename;

    const query = 'INSERT INTO prodotti (nome, descrizione, prezzo, fotoPath, tipo) VALUES (?, ?, ?, ?, ?)';
    const values = [nome, descrizione, parseFloat(prezzo), fotoPath, tipo];

    conn.query(query, values, (err, result) => {
      if (err) {
        writeLog('Errore nell\'inserimento del prodotto: ' + err.message);

        if (req.file) {
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) writeLog('Errore nella rimozione del file: ' + unlinkErr.message);
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Errore nell\'inserimento del prodotto nel database'
        });
      }

      res.redirect('/admin?success=1&message=Prodotto aggiunto con successo');
    });

  } catch (error) {
    writeLog('Errore generale: ' + error.message);

    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) writeLog('Errore nella rimozione del file: ' + unlinkErr.message);
      });
    }

    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
});

app.use('/uploads', express.static('uploads'));

app.get("/admin/prod", requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/product.html'));
});

app.get('/api/products', requireAuth, (req, res) => {
  const query = 'SELECT id, nome, descrizione, prezzo, fotoPath as foto, tipo, disponibile FROM prodotti';

  conn.query(query, (err, results) => {
    if (err) {
      writeLog('Errore query: ' + err.message);
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

app.delete('/api/products/:id', requireRole(['admin']), (req, res) => {
  const productId = req.params.id;
  if (!productId) {
    return res.status(400).json({ success: false, message: "ID prodotto mancante" });
  }

  conn.query('SELECT fotoPath FROM prodotti WHERE id = ?', [productId], (err, rows) => {
    if (err) {
      writeLog("Errore query SELECT: " + err.message);
      return res.status(500).json({ success: false, message: "Errore server durante la ricerca" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prodotto non trovato" });
    }

    const product = rows[0];

    if (product.fotoPath) {
      const fullPath = path.join(__dirname, product.fotoPath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (fileError) {
          writeLog("Errore eliminazione file: " + fileError.message);
        }
      }
    }

    conn.query('DELETE FROM prodotti WHERE id = ?', [productId], (deleteErr, deleteResult) => {
      if (deleteErr) {
        writeLog("Errore eliminazione prodotto: " + deleteErr.message);
        return res.status(500).json({ success: false, message: "Errore server durante l'eliminazione" });
      }

      res.json({ success: true, message: "Prodotto eliminato con successo" });
    });
  });
});

app.get("/admin/stat", requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/stat.html'));
});

app.get('/api/statistiche', requireRole(['admin']), (req, res) => {
  const dataInizio = req.query.data_inizio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dataFine = req.query.data_fine || new Date().toISOString().split('T')[0];

  let risultato = {
    periodo: { data_inizio: dataInizio, data_fine: dataFine }
  };
  let queriesCompleted = 0;
  let hasError = false;
  const totalQueries = 6;

  const checkCompletion = () => {
    if (++queriesCompleted === totalQueries && !hasError) {
      const totaleOrdini = risultato.totale_ordini || 0;
      const ordiniPagati = risultato.ordini_pagati || 0;
      const incassoTotale = risultato.incassi_totali || 0;
      const giorniAttivi = risultato.ordini_per_giorno?.length || 0;

      risultato.riassunto = {
        totale_ordini: totaleOrdini,
        ordini_pagati: ordiniPagati,
        tasso_pagamento: totaleOrdini > 0 ? ((ordiniPagati / totaleOrdini) * 100).toFixed(1) : 0,
        totale_incassi: incassoTotale,
        giorni_attivi: giorniAttivi
      };

      return res.json(risultato);
    }
  };

  conn.query(
    `SELECT COUNT(*) as totale_ordini FROM ordini WHERE data BETWEEN ? AND ?`,
    [dataInizio, dataFine],
    (err, results) => {
      if (err || !Array.isArray(results)) return res.status(500).json({ error: 'Errore ordini totali', details: err?.message });
      risultato.totale_ordini = results?.[0]?.totale_ordini || 0;
      checkCompletion();
    }
  );

  conn.query(
    `SELECT COUNT(*) as ordini_pagati FROM ordini WHERE data BETWEEN ? AND ? AND pagato = 1`,
    [dataInizio, dataFine],
    (err, results) => {
      if (err || !Array.isArray(results)) return res.status(500).json({ error: 'Errore ordini pagati', details: err?.message });
      risultato.ordini_pagati = results?.[0]?.ordini_pagati || 0;
      checkCompletion();
    }
  );

  conn.query(
    `SELECT DATE(data) as data, COUNT(*) as numero_ordini FROM ordini WHERE data BETWEEN ? AND ? GROUP BY DATE(data) ORDER BY DATE(data)`,
    [dataInizio, dataFine],
    (err, results) => {
      risultato.ordini_per_giorno = Array.isArray(results) ? results : [];
      checkCompletion();
    }
  );

  conn.query(
    `SELECT DATE(data) as data, SUM(prezzo) as incasso_giorno FROM ordini WHERE data BETWEEN ? AND ? AND pagato = 1 GROUP BY DATE(data) ORDER BY DATE(data)`,
    [dataInizio, dataFine],
    (err, results) => {
      risultato.incassi_giornalieri = Array.isArray(results) ? results : [];
      checkCompletion();
    }
  );

  conn.query(
    `SELECT nome_prodotto, SUM(prezzo) as incasso_prodotto, AVG(prezzo) as prezzo_medio, COUNT(*) as quantita_pagata FROM ordini WHERE data BETWEEN ? AND ? AND pagato = 1 GROUP BY nome_prodotto ORDER BY incasso_prodotto DESC LIMIT 10`,
    [dataInizio, dataFine],
    (err, results) => {
      risultato.top_earners = Array.isArray(results) ? results : [];
      checkCompletion();
    }
  );

  conn.query(
    `SELECT nome_prodotto, COUNT(*) as quantita_ordinata, SUM(CASE WHEN pagato = 1 THEN 1 ELSE 0 END) as quantita_pagata, AVG(prezzo) as prezzo_medio, SUM(CASE WHEN pagato = 1 THEN prezzo ELSE 0 END) as incasso_prodotto FROM ordini WHERE data BETWEEN ? AND ? GROUP BY nome_prodotto ORDER BY quantita_ordinata DESC LIMIT 20`,
    [dataInizio, dataFine],
    (err, results) => {
      risultato.prodotti_piu_venduti = Array.isArray(results) ? results : [];
      risultato.incassi_totali = Array.isArray(results)
        ? results.reduce((sum, item) => sum + parseFloat(item.incasso_prodotto || 0), 0)
        : 0;
      checkCompletion();
    }
  );
});

app.get("/admin/disp", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/admin/disp.html'));
})

app.put('/api/products/:id/availability', (req, res) => {
  const productId = req.params.id;
  const { disponibile } = req.body; 

  writeLog("cio che vedo in availability " + disponibile + " " + productId);

  if (typeof disponibile !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Il campo disponibile deve essere un boolean'
    });
  }

  conn.query(
    `UPDATE prodotti 
     SET disponibile = ? 
     WHERE id = ?`,
    [disponibile, productId],
    (err, results) => {
      if (err) {
        writeLog("errore query: " + err.message);
        return res.status(500).json({
          success: false,
          message: 'Errore database: ' + err.message
        });
      }

      if (results.affectedRows > 0) {
        writeLog("Aggiornamento riuscito, righe modificate: " + results.affectedRows);
        res.json({
          success: true,
          message: 'Disponibilità aggiornata con successo'
        });
      } else {
        writeLog("Nessuna riga modificata, probabilmente ID non trovato");
        res.status(404).json({
          success: false,
          message: 'Prodotto non trovato'
        });
      }
    }
  );
});

app.get("/admin/log",requireRole(['admin']), (req, res)=>{
   res.sendFile(path.join(__dirname, 'secure/admin/log.html'));
})

app.get("/getLog", requireRole(['admin']), (req, res)=>{
   const logPath = 'log.txt';

  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Errore nella lettura dei log.' });
    }

    
    const logLines = data.split('\n').filter(line => line.trim() !== '');

    res.json({ logs: logLines });
})
})

//----------------------------------------------------------------CAMERIERE--------------------------------------------------------------

app.get("/doComanda", requireRole(['cameriere', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/comanda.html'));
});

app.post("/api/orders", requireRole(['cameriere', 'admin']), (req, res) => {
  const { tavolo, items } = req.body;

  if (!tavolo || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Dati mancanti o invalidi" });
  }

  const nomiProdotti = items.map(item => item.name);

  const placeholders = nomiProdotti.map(() => '?').join(',');
  const query = `SELECT nome, tipo FROM prodotti WHERE nome IN (${placeholders})`;

  conn.query(query, nomiProdotti, (err, risultati) => {
    if (err) {
      writeLog("Errore durante il recupero dei tipi: " + err.message);
      return res.status(500).json({ error: "Errore recupero tipi" });
    }

    if (risultati.length !== nomiProdotti.length) {
      const prodottiTrovati = risultati.map(r => r.nome);
      const prodottiMancanti = nomiProdotti.filter(nome => !prodottiTrovati.includes(nome));
      writeLog("Prodotti non trovati: " + prodottiMancanti.join(', '));
      return res.status(400).json({
        error: "Prodotti non trovati",
        prodotti_mancanti: prodottiMancanti
      });
    }

    const tipoMap = {};
    risultati.forEach(r => {
      tipoMap[r.nome] = r.tipo;
    });

    const hasFood = items.some(item => tipoMap[item.name] === 'food');
    const hasDrink = items.some(item => tipoMap[item.name] === 'drink');

    const stato = hasFood ? 'in_corso' : 'n';
    const stato_drink = hasDrink ? 'in_corso' : 'n';

    conn.beginTransaction(err => {
      if (err) {
        writeLog("Errore avvio transazione: " + err.message);
        return res.status(500).json({ error: "Errore transazione" });
      }

      const insertComandaQuery = "INSERT INTO comanda (tavolo, stato, stato_drink) VALUES (?, ?, ?)";
      const insertComandaValues = [tavolo, stato, stato_drink];

      conn.query(insertComandaQuery, insertComandaValues, (err, result) => {
        if (err) {
          writeLog("Errore inserimento comanda: " + err.message);
          return conn.rollback(() => {
            res.status(500).json({ error: "Errore inserimento comanda" });
          });
        }

        const comandaId = result.insertId;

        const ordiniDaInserire = [];
        items.forEach(item => {
          for (let i = 0; i < item.quantity; i++) {
            ordiniDaInserire.push([
              comandaId,
              item.name,
              item.price,
              item.note || '',
              item.fotoPath || item.foto || null,
              false,
              new Date()
            ]);
          }
        });

        if (ordiniDaInserire.length === 0) {
          return conn.rollback(() => {
            res.status(400).json({ error: "Nessun ordine da inserire" });
          });
        }

        const insertQuery = `INSERT INTO ordini (comanda_id, nome_prodotto, prezzo, note, path_foto, pagato, data) VALUES ?`;

        conn.query(insertQuery, [ordiniDaInserire], (err) => {
          if (err) {
            writeLog("Errore inserimento ordini: " + err.message);
            return conn.rollback(() => {
              res.status(500).json({ error: "Errore inserimento ordini" });
            });
          }

          conn.commit(err => {
            if (err) {
              writeLog("Errore commit: " + err.message);
              return conn.rollback(() => {
                res.status(500).json({ error: "Errore commit" });
              });
            }

            writeLog(`✅ Ordine inserito da ${req.session.user.username} per tavolo ${tavolo}`);

            res.status(200).json({
              success: true,
              message: "Ordine inserito con successo",
              comanda_id: comandaId
            });
          });
        });
      });
    });
  });
});

app.get("/viewComanda", requireRole(['cameriere', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/view.html'));
});

app.get('/api/comande', requireRole(['cameriere', 'admin']), (req, res) => {
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
      writeLog("Errore nel recupero delle comande: " + err.message);
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

app.post("/api/cameriere/done", requireRole(['cameriere', 'admin']), (req, res) => {
  const { comanda_id } = req.body;

  if (!comanda_id) {
    return res.status(400).json({ error: "ID comanda mancante" });
  }

  conn.query("SELECT id FROM comanda WHERE id = ?", [comanda_id], (err, result) => {
    if (err) {
      writeLog("Errore verifica comanda: " + err.message);
      return res.status(500).json({ error: "Errore verifica comanda" });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: "Comanda non trovata" });
    }

    conn.query(
      "UPDATE comanda SET fine = TRUE WHERE id = ?",
      [comanda_id],
      (err, updateResult) => {
        if (err) {
          writeLog("Errore aggiornamento comanda: " + err.message);
          return res.status(500).json({ error: "Errore aggiornamento comanda" });
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ error: "Comanda non trovata per l'aggiornamento" });
        }

        writeLog(`✅ Comanda #${comanda_id} completata da ${req.session.user.username}`);

        res.status(200).json({
          success: true,
          message: "Comanda completata con successo",
          comanda_id: comanda_id
        });
      }
    );
  });
});

app.get("/viewTable", (req, res) => {
  res.sendFile(path.join(__dirname, 'secure/cam/table.html'));
})

//------------------------------------------------------------------CUCINA-------------------------------------------------------------
app.get('/api/cucina', requireRole(['cucina', 'admin', 'cameriere']), (req, res) => {
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
      writeLog('Errore nella query: ' + err.message);
      return res.status(500).json({ error: 'Errore nel recupero dei dati cucina' });
    }

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

app.post('/api/cucina/complete', requireRole(['cucina', 'admin']), (req, res) => {
  const { comandaId } = req.body;

  if (!comandaId) {
    return res.status(400).json({ error: "Manca il parametro comandaId" });
  }

  conn.query(
    'UPDATE comanda SET stato = ? WHERE id = ?',
    ['pronta', comandaId],
    (err, results) => {
      if (err) {
        writeLog('Errore aggiornando comanda: ' + err.message);
        return res.status(500).json({ error: "Errore interno del server" });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Comanda non trovata" });
      }

      writeLog(`🍳 Comanda cucina #${comandaId} completata da ${req.session.user.username}`);

      res.json({ message: "Comanda completata con successo" });
    }
  );
});

//--------------------------------------------------------------------BANCONE-------------------------------------------------------------
app.get('/api/bancone', requireRole(['bancone', 'admin']), (req, res) => {
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
      writeLog('Errore nella query: ' + err.message);
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

app.post('/api/bancone/complete', requireRole(['bancone', 'admin']), (req, res) => {
  const { comandaId } = req.body;

  const query = "UPDATE comanda SET stato_drink = 'pronta' WHERE id = ?";
  conn.query(query, [comandaId], (err) => {
    if (err) {
      writeLog('Errore aggiornando stato_drink: ' + err.message);
      return res.status(500).json({ error: 'Errore aggiornamento stato_drink' });
    }

    writeLog(`🍹 Comanda bancone #${comandaId} completata da ${req.session.user.username}`);

    res.sendStatus(200);
  });
});

//---------------------------------------------------------------CASSA--------------------------------------------------------------------

app.get('/api/cassa', requireRole(['cassa', 'admin', 'cameriere']), (req, res) => {
  const queryCassa = `
    SELECT 
      o.id,
      o.comanda_id,
      o.nome_prodotto,
      o.prezzo,
      o.note,
      o.path_foto,
      o.pagato,
      c.tavolo,
      c.stato,
      c.stato_drink,
      c.pagato as comanda_pagata
    FROM ordini o
    JOIN comanda c ON o.comanda_id = c.id
    WHERE c.pagato = FALSE
    ORDER BY c.tavolo ASC, c.id DESC, o.id ASC
  `;

  conn.query(queryCassa, (err, results) => {
    if (err) {
      writeLog("Errore nel recupero dei dati cassa: " + err.message);
      return res.status(500).json({ error: "Errore server" });
    }

    const ordini = results.map(ordine => ({
      ...ordine,
      pagato: Boolean(ordine.pagato),
      prezzo: parseFloat(ordine.prezzo)
    }));

    res.json(ordini);
  });
});

app.post('/api/cassa/paga-ordine', requireRole(['cassa', 'admin']), (req, res) => {
  const { ordineId } = req.body;

  if (!ordineId) {
    return res.status(400).json({ error: 'ID ordine mancante' });
  }

  conn.query(
    'SELECT id, pagato, nome_prodotto, prezzo FROM ordini WHERE id = ?',
    [ordineId],
    (err, result) => {
      if (err) {
        writeLog('Errore verifica ordine: ' + err.message);
        return res.status(500).json({ error: 'Errore verifica ordine' });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Ordine non trovato' });
      }

      const ordine = result[0];

      if (ordine.pagato) {
        return res.status(400).json({ error: 'Ordine già pagato' });
      }

      conn.query(
        'UPDATE ordini SET pagato = 1 WHERE id = ?',
        [ordineId],
        (err, updateResult) => {
          if (err) {
            writeLog('Errore nel pagamento ordine: ' + err.message);
            return res.status(500).json({ error: 'Errore aggiornamento pagamento' });
          }

          if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Ordine non trovato per l\'aggiornamento' });
          }

          writeLog(`💰 Ordine #${ordineId} pagato da ${req.session.user.username}: ${ordine.nome_prodotto} - €${ordine.prezzo}`);

          res.json({
            success: true,
            id: ordineId,
            message: 'Pagamento registrato con successo',
            prodotto: ordine.nome_prodotto,
            importo: parseFloat(ordine.prezzo)
          });
        }
      );
    }
  );
});

app.post('/api/cassa/annulla-pagamento', requireRole(['cassa', 'admin']), (req, res) => {
  const { ordineId } = req.body;

  if (!ordineId) {
    return res.status(400).json({ error: 'ID ordine mancante' });
  }

  conn.query(
    'SELECT id, pagato, nome_prodotto, prezzo FROM ordini WHERE id = ?',
    [ordineId],
    (err, result) => {
      if (err) {
        writeLog('Errore verifica ordine: ' + err.message);
        return res.status(500).json({ error: 'Errore verifica ordine' });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Ordine non trovato' });
      }

      const ordine = result[0];

      if (!ordine.pagato) {
        return res.status(400).json({ error: 'Ordine non è stato pagato' });
      }

      conn.query(
        'UPDATE ordini SET pagato = 0 WHERE id = ?',
        [ordineId],
        (err, updateResult) => {
          if (err) {
            writeLog('Errore nell\'annullamento del pagamento: ' + err.message);
            return res.status(500).json({ error: 'Errore nell\'annullamento pagamento' });
          }

          if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Ordine non trovato per l\'aggiornamento' });
          }

          writeLog(`🔄 Pagamento annullato da ${req.session.user.username} per ordine #${ordineId}: ${ordine.nome_prodotto}`);

          res.json({
            success: true,
            id: ordineId,
            message: 'Pagamento annullato con successo',
            prodotto: ordine.nome_prodotto,
            importo: parseFloat(ordine.prezzo)
          });
        }
      );
    }
  );
});

app.post('/api/cassa/paga-tavolo', requireRole(['cassa', 'admin']), (req, res) => {
  const { tavolo } = req.body;

  if (!tavolo) {
    return res.status(400).json({ error: "Numero tavolo mancante" });
  }

  conn.beginTransaction((err) => {
    if (err) {
      writeLog("Errore inizio transazione: " + err.message);
      return res.status(500).json({ error: "Errore server" });
    }

    const queryVerifica = `
      SELECT COUNT(*) as ordini_non_pagati
      FROM ordini o
      JOIN comanda c ON o.comanda_id = c.id
      WHERE c.tavolo = ? AND o.pagato = 0 AND c.pagato = 0
    `;

    conn.query(queryVerifica, [tavolo], (err, verificaResult) => {
      if (err) {
        return conn.rollback(() => {
          writeLog("Errore verifica ordini tavolo: " + err.message);
          res.status(500).json({ error: "Errore verifica ordini tavolo" });
        });
      }

      if (verificaResult[0].ordini_non_pagati > 0) {
        return conn.rollback(() => {
          res.status(400).json({
            error: `Ci sono ancora ${verificaResult[0].ordini_non_pagati} ordini non pagati nel tavolo ${tavolo}`
          });
        });
      }

      const queryComande = `
        UPDATE comanda 
        SET pagato = 1 
        WHERE tavolo = ? AND pagato = 0
      `;

      conn.query(queryComande, [tavolo], (err, resultComande) => {
        if (err) {
          return conn.rollback(() => {
            writeLog("Errore chiusura comande tavolo: " + err.message);
            res.status(500).json({ error: "Errore chiusura comande tavolo" });
          });
        }

        conn.commit((err) => {
          if (err) {
            return conn.rollback(() => {
              writeLog("Errore commit transazione: " + err.message);
              res.status(500).json({ error: "Errore finalizzazione pagamento" });
            });
          }

          writeLog(`🎉 Tavolo ${tavolo} completato e chiuso da ${req.session.user.username}`);

          res.status(200).json({
            success: true,
            message: `Tavolo ${tavolo} completato con successo`,
            comande_chiuse: resultComande.affectedRows
          });
        });
      });
    });
  });
});

//-----------------------------------------------------------------ERROR----------------------------------------------------------------
app.use((req, res) => {
  writeLog(`🚫 404 - Pagina non trovata: ${req.method} ${req.url}`);
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  writeLog('Errore server: ' + err.message);
  res.status(500).json({
    error: 'Errore interno del server',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Qualcosa è andato storto'
  });
});

//-----------------------------------------------------------------LISTEN----------------------------------------------------------------
app.listen(3000, () => {
  writeLog('🚀 Server avviato su http://localhost:3000');
  writeLog('📦 Sistema di sessioni attivo');
  writeLog('🔐 Autenticazione obbligatoria per tutte le aree protette');
});
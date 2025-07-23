const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Gestionale Bar</title>
</head>
<body>
    <h1>Gestionale Bar</h1>
    <p>Server attivo</p>
</body>
</html>
  `);
});

app.listen(3000, () => {
  console.log('Server su http://localhost:3000');
});
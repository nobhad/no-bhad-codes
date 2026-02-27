// Minimal server test
import express from 'express';

const app = express();
const PORT = 4001;

app.get('/', (req, res) => {
  res.json({ message: 'Test server working' });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

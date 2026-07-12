import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import weatherRouter from './routes/weather.js';
import switchbotRouter from './routes/switchbot.js';
import calendarRouter from './routes/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/weather', weatherRouter);
app.use('/api/switchbot', switchbotRouter);
app.use('/api/calendar', calendarRouter);

// 本番運用ではフロントエンドのビルド成果物も同じサーバーから配信し、
// CORSやAPIベースURLの設定なしで単一サービスとしてデプロイできるようにする
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`home-dashboard backend listening on port ${port}`);
});

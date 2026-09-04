import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import weatherRouter from './routes/weather.js';
import switchbotRouter from './routes/switchbot.js';
import calendarRouter from './routes/calendar.js';
import eufyRouter from './routes/eufy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');

const app = express();
app.use(cors());
// Webhookは相手の送信形式(Content-Type欠落や不正JSON)に関わらず必ず受信記録したいので、
// express.json()より先にrawボディで受けてルート側で自前パースする
app.use('/api/switchbot/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/weather', weatherRouter);
app.use('/api/switchbot', switchbotRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/eufy', eufyRouter);

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

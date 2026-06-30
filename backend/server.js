// backend/server.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// читаем инструкцию (путь относительно корня проекта)
const instructions = fs.readFileSync('backend/brief_instructions.txt', 'utf8');

const model = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'openrouter/free',
  temperature: 0.3,
  timeout: 120000,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
});

app.post('/api/chat', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Вопрос обязателен' });
  }

  try {
    const systemMessage = new SystemMessage(`
Ты — бот-помощник по составлению технического задания.
Вот твоя инструкция:

${instructions}

Отвечай на русском языке, дружелюбно и профессионально.
    `);

    const userMessage = new HumanMessage(question);
    const response = await model.invoke([systemMessage, userMessage]);
    res.json({ answer: response.content });
  } catch (error) {
    console.error('Ошибка AI:', error);
    res.status(500).json({ error: 'Ошибка при обращении к AI' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

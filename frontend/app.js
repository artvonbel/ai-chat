// ===== ЭЛЕМЕНТЫ =====
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const quickButtons = document.querySelectorAll('.quick-btn');
const themeToggle = document.getElementById('themeToggle');

// ===== КОНФИГУРАЦИЯ =====
const API_URL = 'https://ai-chat-spz1.onrender.com/api/chat';
const STORAGE_KEY = 'chat_history';
const THEME_KEY = 'chat_theme';

// ===== СОСТОЯНИЕ =====
let dialogHistory = [];
let isWaitingForResponse = false;

// ===== ЗАГРУЗКА СОХРАНЁННЫХ ДАННЫХ =====
function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    themeToggle.textContent = '🌙';
  }
}

function loadChatHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      dialogHistory = JSON.parse(saved);
      renderChatFromHistory();
    } catch (e) {
      console.warn('Ошибка загрузки истории:', e);
      dialogHistory = [];
      showWelcomeMessage();
    }
  } else {
    showWelcomeMessage();
  }
}

function saveChatHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dialogHistory));
}

// ===== ОТОБРАЖЕНИЕ СООБЩЕНИЙ =====
function renderChatFromHistory() {
  messages.innerHTML = '';
  if (dialogHistory.length === 0) {
    showWelcomeMessage();
    return;
  }

  dialogHistory.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `message ${item.sender}`;
    div.textContent = item.text;
    messages.appendChild(div);

    // Если это последнее сообщение и оно от бота — добавляем кнопки экспорта
    if (index === dialogHistory.length - 1 && item.sender === 'bot') {
      addExportButtons(div);
    }
  });
  messages.scrollTop = messages.scrollHeight;
}

function showWelcomeMessage() {
  messages.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `Привет! 👋 Я помогу тебе составить чёткое техническое задание для твоего проекта.<br/>
  Расскажи, что ты хочешь сделать, и я задам тебе нужные вопросы.`;
  messages.appendChild(div);
}

function addMessage(text, sender, options = {}) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.textContent = text;
  messages.appendChild(div);

  // Сохраняем в историю
  dialogHistory.push({ sender, text });
  saveChatHistory();

  // Если это бот и нужно показать экспорт
  if (sender === 'bot' && options.showExport) {
    addExportButtons(div);
  }

  messages.scrollTop = messages.scrollHeight;
  return div;
}

function addExportButtons(messageElement) {
  const wrap = document.createElement('div');
  wrap.className = 'export-buttons';

  const btnFull = document.createElement('button');
  btnFull.textContent = '📄 Скачать полный диалог';
  btnFull.addEventListener('click', () => exportDialog('full'));

  const btnBrief = document.createElement('button');
  btnBrief.textContent = '📋 Скачать только ТЗ';
  btnBrief.addEventListener('click', () => exportDialog('brief'));

  const btnCopy = document.createElement('button');
  btnCopy.textContent = '📋 Копировать ТЗ';
  btnCopy.addEventListener('click', () => copyLastBotMessage());

  wrap.appendChild(btnFull);
  wrap.appendChild(btnBrief);
  wrap.appendChild(btnCopy);
  messageElement.appendChild(wrap);
}

// ===== ИНДИКАТОР ПЕЧАТИ =====
function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = '<span class="dots">Бот печатает</span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function setLoading(isLoading) {
  isWaitingForResponse = isLoading;
  sendBtn.disabled = isLoading;
  input.disabled = isLoading;
  sendBtn.textContent = isLoading ? 'Отправка...' : 'Отправить';
}

// ===== ОТПРАВКА СООБЩЕНИЯ =====
async function sendMessage(text) {
  if (!text || !text.trim() || isWaitingForResponse) return;

  const trimmed = text.trim();
  addMessage(trimmed, 'user');
  input.value = '';
  setLoading(true);
  showTyping();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: trimmed }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    removeTyping();

    if (!response.ok) {
      let errorMsg = 'Ошибка на сервере.';
      try {
        const errData = await response.json();
        if (errData.error) errorMsg = errData.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (data.answer) {
      addMessage(data.answer, 'bot', { showExport: true });
    } else {
      addMessage('❌ Пустой ответ от сервера.', 'bot');
    }
  } catch (error) {
    removeTyping();
    let userMsg = '❌ Не удалось получить ответ. ';
    if (error.name === 'AbortError') {
      userMsg += 'Превышено время ожидания. Попробуйте ещё раз.';
    } else if (error.message) {
      userMsg += error.message;
    } else {
      userMsg += 'Проверьте интернет или попробуйте позже.';
    }
    addMessage(userMsg, 'bot');
    console.error('Fetch error:', error);
  } finally {
    setLoading(false);
    input.focus();
  }
}

// ===== КНОПКИ-ПРИМЕРЫ =====
quickButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt');
    if (prompt && !isWaitingForResponse) {
      input.value = prompt;
      sendMessage(prompt);
    }
  });
});

// ===== ОТПРАВКА ПО КНОПКЕ / ENTER =====
sendBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (text) sendMessage(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = input.value.trim();
    if (text) sendMessage(text);
  }
});

// ===== ПЕРЕКЛЮЧЕНИЕ ТЕМЫ =====
themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  themeToggle.textContent = isLight ? '☀️' : '🌙';
});

// ===== ЭКСПОРТ =====
function getLastBotMessage() {
  const botMessages = dialogHistory.filter(item => item.sender === 'bot');
  return botMessages.length > 0 ? botMessages[botMessages.length - 1] : null;
}

function exportDialog(mode) {
  if (dialogHistory.length === 0) {
    alert('Нет диалога для экспорта.');
    return;
  }

  let content = '';
  if (mode === 'full') {
    content = '=== ПОЛНЫЙ ПРОТОКОЛ ДИАЛОГА ===\n\n';
    dialogHistory.forEach(item => {
      const label = item.sender === 'user' ? 'Пользователь' : 'Бот';
      content += `${label}:\n${item.text}\n\n`;
    });
  } else {
    const last = getLastBotMessage();
    if (!last) {
      alert('Нет сообщений от бота для экспорта.');
      return;
    }
    content = '=== ТЕХНИЧЕСКОЕ ЗАДАНИЕ ===\n\n' + last.text;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = mode === 'full' ? 'протокол_диалога.txt' : 'техническое_задание.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function copyLastBotMessage() {
  const last = getLastBotMessage();
  if (!last) {
    alert('Нет сообщений от бота для копирования.');
    return;
  }
  navigator.clipboard.writeText(last.text).then(() => {
    alert('ТЗ скопировано в буфер обмена!');
  }).catch(() => {
    alert('Не удалось скопировать. Попробуйте выделить текст вручную.');
  });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
loadTheme();
loadChatHistory();
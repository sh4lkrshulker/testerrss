// Replace these values with the project's Supabase URL and publishable anon key.
const SUPABASE_URL = 'https://qorikeqktkzduvzjpmre.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EyStMJicAgITvH8ZNimS1g_dAnzE2P-';
const TABLE_URL = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/requests`;
const STATUS_LABELS = { new: 'Новая', in_progress: 'В работе', done: 'Завершена' };

const elements = {
  rows: document.querySelector('#request-rows'),
  dialog: document.querySelector('#request-dialog'),
  form: document.querySelector('#request-form'),
  id: document.querySelector('#request-id'),
  title: document.querySelector('#request-title'),
  category: document.querySelector('#request-category'),
  status: document.querySelector('#request-status'),
  dialogTitle: document.querySelector('#dialog-title'),
  dialogError: document.querySelector('#dialog-error'),
  saveButton: document.querySelector('#save-button'),
  createButton: document.querySelector('#create-button'),
  search: document.querySelector('#search-input'),
  toast: document.querySelector('#toast'),
};

let requests = [];
let activeFilter = 'all';
let toastTimer;

function isConfigured() {
  const hasProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim()) &&
    !/your[_-]?project|project[_-]?id/i.test(SUPABASE_URL);
  const hasPublicKey = SUPABASE_ANON_KEY.startsWith('sb_publishable_') ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(SUPABASE_ANON_KEY);
  return hasProjectUrl && hasPublicKey;
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Нет связи с Supabase. Проверьте Project URL, публичный ключ и интернет; откройте сайт по HTTPS через GitHub Pages, а не как файл.');
    }
    throw error;
  }

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.message || `Ошибка API: ${response.status}`);
  }

  const responseBody = await response.text();
  return responseBody ? JSON.parse(responseBody) : null;
}

function setConnection(state, label) {
  const dot = document.querySelector('#connection-dot');
  dot.classList.toggle('is-connected', state === 'connected');
  dot.classList.toggle('is-error', state === 'error');
  document.querySelector('#connection-label').textContent = label;
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value));
}

function makeIconButton(label, path, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${className}`.trim();
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">${path}</svg>`;
  return button;
}

function render() {
  const query = elements.search.value.trim().toLocaleLowerCase('ru');
  const visibleRequests = requests.filter((request) => {
    const matchesFilter = activeFilter === 'all' || request.status === activeFilter;
    const matchesSearch = `${request.title} ${request.category}`.toLocaleLowerCase('ru').includes(query);
    return matchesFilter && matchesSearch;
  });

  elements.rows.replaceChildren();
  if (!visibleRequests.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'table-message';
    cell.textContent = requests.length ? 'По вашему запросу ничего не найдено.' : 'Заявок пока нет. Создайте первую запись.';
    row.append(cell);
    elements.rows.append(row);
  } else {
    visibleRequests.forEach((request, index) => elements.rows.append(createRow(request, index)));
  }

  const inProgress = requests.filter((request) => request.status === 'in_progress').length;
  const completed = requests.filter((request) => request.status === 'done').length;
  document.querySelector('#total-count').textContent = requests.length;
  document.querySelector('#progress-count').textContent = inProgress;
  document.querySelector('#done-count').textContent = completed;
  document.querySelector('#nav-count').textContent = requests.length;
  document.querySelector('#filter-all-count').textContent = requests.length;
  document.querySelector('#results-label').textContent = `Показано ${visibleRequests.length} из ${requests.length}`;
}

function createRow(request, index) {
  const row = document.createElement('tr');
  const number = document.createElement('td');
  number.className = 'number-column row-number';
  number.textContent = String(index + 1).padStart(2, '0');

  const title = document.createElement('td');
  title.className = 'request-name';
  title.textContent = request.title;
  title.title = request.title;

  const category = document.createElement('td');
  category.className = 'category-label';
  category.textContent = request.category;

  const date = document.createElement('td');
  date.className = 'date-label';
  date.textContent = formatDate(request.created_at);

  const statusCell = document.createElement('td');
  const status = document.createElement('select');
  status.className = `status-select status-${request.status}`;
  status.setAttribute('aria-label', `Статус заявки «${request.title}»`);
  Object.entries(STATUS_LABELS).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    status.append(option);
  });
  status.value = request.status;
  status.addEventListener('change', () => updateStatus(request.id, status.value));
  statusCell.append(status);

  const actions = document.createElement('td');
  const actionGroup = document.createElement('div');
  actionGroup.className = 'row-actions';
  const edit = makeIconButton('Редактировать', '<path d="m13.7 4.3 2 2m-9.9 9.9-1.1 3 3-1.1 9-9a1.4 1.4 0 0 0-2-2l-9 9Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>');
  edit.addEventListener('click', () => openDialog(request));
  const remove = makeIconButton('Удалить', '<path d="M4.5 6h11m-9.8 0 .6 10h7.4l.6-10M8 6V4h4v2m-3 3v4m2-4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>', 'delete-button');
  remove.addEventListener('click', () => deleteRequest(request));
  actionGroup.append(edit, remove);
  actions.append(actionGroup);
  row.append(number, title, category, date, statusCell, actions);
  return row;
}

async function loadRequests() {
  if (!isConfigured()) {
    elements.createButton.disabled = true;
    setConnection('error', 'Нужна настройка базы');
    elements.rows.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'table-message';
    cell.textContent = 'В app.js укажите настоящий Project URL вида https://ваш-проект.supabase.co и публичный ключ. Не оставляйте your_project_id.';
    row.append(cell);
    elements.rows.append(row);
    document.querySelector('#results-label').textContent = 'Подключение не настроено';
    return;
  }

  setConnection('pending', 'Подключаемся к базе');
  try {
    requests = await apiRequest(`${TABLE_URL}?select=*&order=created_at.desc`);
    setConnection('connected', 'База подключена');
    elements.createButton.disabled = false;
    elements.createButton.title = '';
    render();
  } catch (error) {
    elements.createButton.disabled = true;
    setConnection('error', 'Нет соединения с базой');
    elements.rows.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'table-message';
    cell.textContent = `Не удалось загрузить записи: ${error.message}`;
    row.append(cell);
    elements.rows.append(row);
    document.querySelector('#results-label').textContent = 'Ошибка загрузки';
  }
}

function openDialog(request = null) {
  elements.form.reset();
  elements.dialogError.hidden = true;
  elements.id.value = request?.id || '';
  elements.title.value = request?.title || '';
  elements.category.value = request?.category || '';
  elements.status.value = request?.status || 'new';
  elements.dialogTitle.textContent = request ? 'Изменить заявку' : 'Новая заявка';
  elements.saveButton.textContent = request ? 'Сохранить' : 'Создать заявку';
  elements.dialog.showModal();
  elements.title.focus();
}

async function saveRequest(event) {
  event.preventDefault();
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = 'Сохраняем…';
  const id = elements.id.value;
  const payload = {
    title: elements.title.value.trim(),
    category: elements.category.value.trim(),
    status: elements.status.value,
  };

  try {
    if (id) {
      await apiRequest(`${TABLE_URL}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
      showToast('Изменения сохранены');
    } else {
      await apiRequest(TABLE_URL, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
      showToast('Заявка создана');
    }
    elements.dialog.close();
    await loadRequests();
  } catch (error) {
    elements.dialogError.textContent = `Не удалось сохранить: ${error.message}`;
    elements.dialogError.hidden = false;
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = id ? 'Сохранить' : 'Создать заявку';
  }
}

async function updateStatus(id, status) {
  try {
    await apiRequest(`${TABLE_URL}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status }),
    });
    showToast('Статус обновлён');
    await loadRequests();
  } catch (error) {
    showToast(`Не удалось обновить статус: ${error.message}`, true);
    await loadRequests();
  }
}

async function deleteRequest(request) {
  if (!window.confirm(`Удалить заявку «${request.title}»?`)) return;
  try {
    await apiRequest(`${TABLE_URL}?id=eq.${encodeURIComponent(request.id)}`, { method: 'DELETE' });
    showToast('Заявка удалена');
    await loadRequests();
  } catch (error) {
    showToast(`Не удалось удалить заявку: ${error.message}`, true);
  }
}

document.querySelector('#create-button').addEventListener('click', () => openDialog());
document.querySelector('#close-dialog').addEventListener('click', () => elements.dialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => elements.dialog.close());
document.querySelector('#refresh-button').addEventListener('click', loadRequests);
elements.form.addEventListener('submit', saveRequest);
elements.search.addEventListener('input', render);
document.querySelectorAll('.filter-tab').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const isSelected = tab === button;
      tab.classList.toggle('is-selected', isSelected);
      tab.setAttribute('aria-pressed', String(isSelected));
    });
    render();
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});

loadRequests();
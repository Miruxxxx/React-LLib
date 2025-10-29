import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import IssueModal from '../components/IssueModal';

function parseDate(value) {
  return value ? new Date(value + 'T00:00:00') : null;
}

function getTransactionOrderValue(tr) {
  if (!tr) return 0;
  const idNumber = Number(tr.id);
  if (Number.isFinite(idNumber) && idNumber > 0) {
    return idNumber;
  }
  const parsedDate = Date.parse(tr.date ?? '');
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

const HomePage = () => {
  const [surname, setSurname] = useState('');
  const [book, setBook] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    onHands: 0,
    overdue: 0,
    newThisMonth: 0,
    writtenOff: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Загружаем статистику
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Загружаем активные транзакции
  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const [transactionsRes, studentsRes, booksRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions`),
        fetch(`${API_URL}/api/students`),
        fetch(`${API_URL}/api/books`)
      ]);

      if (!transactionsRes.ok || !studentsRes.ok || !booksRes.ok) {
        throw new Error('Failed to load data');
      }

      const [transactions, students, books] = await Promise.all([
        transactionsRes.json(),
        studentsRes.json(),
        booksRes.json()
      ]);

      // Определяем активные выдачи
      const lastByPair = new Map();
      for (const tr of transactions) {
        const key = `${tr.studentId}:${tr.bookId}`;
        const prev = lastByPair.get(key);
        if (!prev || getTransactionOrderValue(tr) > getTransactionOrderValue(prev)) {
          lastByPair.set(key, tr);
        }
      }

      const activePairs = Array.from(lastByPair.values()).filter(tr => tr.action === 'taken');

      const combined = activePairs.map(tr => {
        const student = students.find(s => s.studentId === tr.studentId);
        const bookData = books.find(b => b.id === tr.bookId);
        return {
          studentId: tr.studentId,
          id: student?.studentId || tr.studentId,
          fullName: student ? student.name : '—',
          book: bookData?.title || '—',
          author: bookData?.author || '—',
          bookId: tr.bookId,
          barcode: bookData?.barcode ?? null,
          dueDate: tr.date || '',
          status: tr.action || '—',
        };
      });

      setTickets(combined);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      alert('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleIssueIssued = useCallback(() => {
    loadStats();
    loadTickets();
  }, [loadStats, loadTickets]);

  const openIssueModal = () => setIsIssueOpen(true);
  const closeIssueModal = () => setIsIssueOpen(false);

  const handleOnHandsKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openIssueModal();
    }
  };


  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Фильтры и сортировка
  const filteredTickets = useMemo(() => {
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    const normalizedSurname = surname.trim().toLowerCase();
    const normalizedBook = book.trim().toLowerCase();

    let list = tickets.filter(t => {
      const surnameTargets = [
        t.fullName,
        t.id,
        t.studentId
      ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());
      const bookTargets = [
        t.book,
        t.author,
        t.bookId,
        t.barcode
      ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());

      const matchesSurname = normalizedSurname
        ? surnameTargets.some(value => value.includes(normalizedSurname))
        : true;
      const matchesBook = normalizedBook
        ? bookTargets.some(value => value.includes(normalizedBook))
        : true;
      const due = parseDate(t.dueDate);
      const inFrom = from ? due >= from : true;
      const inTo = to ? due <= to : true;
      return matchesSurname && matchesBook && inFrom && inTo;
    });

    list.sort((a, b) => {
      const da = parseDate(a.dueDate)?.getTime() || 0;
      const db = parseDate(b.dueDate)?.getTime() || 0;
      return sortAsc ? da - db : db - da;
    });

    return list;
  }, [tickets, surname, book, fromDate, toDate, sortAsc]);

  // Быстрые диапазоны
  function setQuickRange(kind) {
    const today = new Date();
    if (kind === 'today') {
      const d = today.toISOString().slice(0, 10);
      setFromDate(d);
      setToDate(d);
      return;
    }
    if (kind === 'overdue') {
      setFromDate('');
      setToDate(todayStr);
      return;
    }
    if (kind === 'week') {
      const start = new Date(today);
      const end = new Date(today);
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7;
      start.setDate(today.getDate() - diffToMonday);
      end.setDate(start.getDate() + 6);
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end.toISOString().slice(0, 10));
      return;
    }
  }

  // Обработчик возврата книги
  const handleReturn = async (ticket) => {
    if (!window.confirm(`Вернуть книгу "${ticket.book}" от ${ticket.fullName}?`)) {
      return;
    }

    try {
      const trRes = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: ticket.studentId,
          bookId: ticket.bookId,
          action: 'returned',
          date: new Date().toISOString().slice(0, 10)
        })
      });

      if (!trRes.ok) {
        const error = await trRes.json();
        throw new Error(error.error || 'Ошибка создания транзакции');
      }

      await fetch(`${API_URL}/api/books/${ticket.bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: 1 })
      });

      await Promise.all([loadTickets(), loadStats()]);
      console.log(`✅ Книга "${ticket.book}" успешно возвращена`);
    } catch (err) {
      console.error('Ошибка возврата книги:', err);
      alert(`Не удалось принять книгу: ${err.message}`);
    }
  };

  return (
    <div>
      <IssueModal
        isOpen={isIssueOpen}
        onClose={closeIssueModal}
        onIssued={handleIssueIssued}
      />
      <section className="hero-section">
        <h1 className="hero-title">Добро пожаловать на сайт школьной библиотеки</h1>
        <p className="hero-subtitle">Сводка по фонду и ближайшие возвраты</p>
      </section>

      {/* Статистика */}
      <section>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number blue">{stats.total.toLocaleString('ru-RU')}</div>
            <div className="stat-label">Всего книг</div>
          </div>
          <div
            className="stat-card stat-card--interactive"
            role="button"
            tabIndex={0}
            onClick={openIssueModal}
            onKeyDown={handleOnHandsKeyDown}
          >
            <button
              type="button"
              className="stat-card-plus"
              onClick={event => { event.stopPropagation(); openIssueModal(); }}
              aria-label="Выдать книгу"
            >
              +
            </button>
            <div className="stat-number purple">{stats.onHands.toLocaleString('ru-RU')}</div>
            <div className="stat-label">На руках</div>
            <span className="stat-card-hint">Открыть выдачу</span>
          </div>
          <div className="stat-card">
            <div className="stat-number pink">{stats.overdue}</div>
            <div className="stat-label">Просрочено</div>
          </div>
          <div className="stat-card">
            <div className="stat-number green">{stats.newThisMonth}</div>
            <div className="stat-label">Новые за месяц</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.writtenOff}</div>
            <div className="stat-label">Списано</div>
          </div>
        </div>
      </section>

      {/* Таблица */}
      <section className="tickets-section">
        <div className="tickets-header">
          <h2 className="section-title">Активные выдачи</h2>
          {isLoading && <span style={{ marginLeft: '1rem', color: '#666' }}>Загрузка...</span>}
        </div>

        <div className="tickets-filters">
          <div className="filters-row">
            <input
              className="input"
              type="text"
              placeholder="Поиск по фамилии"
              value={surname}
              onChange={e => setSurname(e.target.value)}
            />
            <input
              className="input"
              type="text"
              placeholder="Поиск по книге"
              value={book}
              onChange={e => setBook(e.target.value)}
            />
            <div className="date-range">
              <input
                className="input"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
              <span className="date-sep">—</span>
              <input
                className="input"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
          </div>
          <div className="filters-quick">
            <button className="filter-chip" onClick={() => setQuickRange('today')}>Сегодня</button>
            <button className="filter-chip" onClick={() => setQuickRange('week')}>Эта неделя</button>
            <button className="filter-chip" onClick={() => setQuickRange('overdue')}>Просрочено до сегодня</button>
            <button className="filter-chip" onClick={() => { setFromDate(''); setToDate(''); }}>Сбросить даты</button>
          </div>
        </div>

        <div className="tickets-table-wrapper">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>ID студента</th>
                <th>Книга</th>
                <th>Автор</th>
                <th>
                  <button className="th-sort" onClick={() => setSortAsc(s => !s)}>
                    В срок до {sortAsc ? '↑' : '↓'}
                  </button>
                </th>
                <th>Дней до сдачи</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t, idx) => {
                const due = parseDate(t.dueDate);
                if (!due) return null;
                const diffDays = Math.ceil((due - parseDate(todayStr)) / (1000 * 60 * 60 * 24));
                const daysText =
                  diffDays === 0 ? 'Сегодня' :
                  diffDays > 0 ? `${diffDays} дн.` :
                  `${Math.abs(diffDays)} дн. назад`;
                const daysClass = diffDays < 0 ? 'danger' : diffDays === 0 ? 'warning' : 'success';

                return (
                  <tr key={`${t.studentId}-${t.bookId}-${idx}`}>
                    <td>{t.fullName}</td>
                    <td>#{t.id}</td>
                    <td>{t.book}</td>
                    <td>{t.author}</td>
                    <td>{due.toLocaleDateString('ru-RU')}</td>
                    <td><span className={`days-badge ${daysClass}`}>{daysText}</span></td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleReturn(t)}
                        disabled={isLoading}
                      >
                        Принять
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTickets.length === 0 && !isLoading && (
            <div className="empty-table">Нет активных записей</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;

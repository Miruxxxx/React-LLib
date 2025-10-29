import React, { useState, useEffect, useMemo } from 'react';
import './AbiturPage.css';
import { API_URL, DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '../config';
import Modal from '../components/Modal';
import StudentHistoryModal from '../components/StudentHistoryModal';

const getToday = () => new Date().toISOString().slice(0, 10);

const getBooksOnHands = (studentId, transactions) => {
  const studentTx = transactions.filter(tx => tx.studentId === studentId);
  const booksTaken = {};

  for (const tx of studentTx) {
    if (tx.action === 'taken') {
      booksTaken[tx.bookId] = (booksTaken[tx.bookId] || 0) + 1;
    } else if (tx.action === 'returned') {
      booksTaken[tx.bookId] = (booksTaken[tx.bookId] || 0) - 1;
      if (booksTaken[tx.bookId] <= 0) delete booksTaken[tx.bookId];
    }
  }

  return Object.keys(booksTaken).map(id => parseInt(id));
};

const getOverdueBooks = (studentId, transactions, today = new Date()) => {
  const onHands = getBooksOnHands(studentId, transactions);
  const overdue = [];

  for (const bookId of onHands) {
    const lastTaken = [...transactions]
      .filter(tx => tx.studentId === studentId && tx.bookId === bookId && tx.action === 'taken')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastTaken && new Date(lastTaken.date) < today) overdue.push(bookId);
  }

  return overdue;
};

const getStudentStatus = (studentId, transactions) => {
  const overdue = getOverdueBooks(studentId, transactions);
  if (overdue.length > 0) return 'overdue';
  
  const todayStr = getToday();
  const booksOnHands = getBooksOnHands(studentId, transactions);
  
  for (const bookId of booksOnHands) {
    const lastTaken = [...transactions]
      .filter(tx => tx.studentId === studentId && tx.bookId === bookId && tx.action === 'taken')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (lastTaken && lastTaken.date === todayStr) return 'due-today';
  }
  
  if (booksOnHands.length > 0) return 'on-hands';
  return 'ok';
};

const getBookNameById = (booksIds, books) => {
  const foundBooks = [];
  for (const id of booksIds) {
    const book = books.find(b => b.id === id);
    if (book) foundBooks.push(book.title);
  }
  return foundBooks.join('; ') || 'Нет';
};

const AbiturPage = () => {
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [newStudent, setNewStudent] = useState({
    name: '',
    grade: '',
    gradeLetter: '',
    cardId: ''
  });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [historyStudentId, setHistoryStudentId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Загружаем данные
  useEffect(() => {
    fetch(`${API_URL}/api/students`)
      .then(res => res.json())
      .then(data => setStudents(data))
      .catch(err => console.error('Ошибка загрузки учеников:', err));

    fetch(`${API_URL}/api/books`)
      .then(res => res.json())
      .then(data => setBooks(data))
      .catch(err => console.error('Ошибка загрузки книг:', err));

    fetch(`${API_URL}/api/transactions`)
      .then(res => res.json())
      .then(data => setTransactions(data))
      .catch(err => console.error('Ошибка загрузки транзакций:', err));
  }, []);

  useEffect(() => {
    const handleDocumentClick = event => {
      if (!event.target.closest('.student-card-menu') && !event.target.closest('.student-card-menu-toggle')) {
        setOpenMenuId(null);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleDocumentClick);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', handleDocumentClick);
      }
    };
  }, []);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setNewStudent(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStudent = async e => {
    e.preventDefault();
    
    const payload = {
      name: newStudent.name.trim(),
      grade: newStudent.grade,
      gradeLetter: newStudent.gradeLetter.trim(),
      cardId: newStudent.cardId.trim()
    };

    try {
      const res = await fetch(`${API_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Ошибка: ${error.error}`);
        return;
      }

      const addedStudent = await res.json();
      setStudents(prev => [addedStudent, ...prev]);
      
      setNewStudent({
        name: '',
        grade: '',
        gradeLetter: '',
        cardId: ''
      });
    } catch (err) {
      console.error('Ошибка добавления ученика:', err);
      alert('Не удалось добавить ученика');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!confirm('Удалить ученика?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/students/${studentId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Не удалось удалить');
      
      setStudents(prev => prev.filter(s => s.studentId !== studentId));
    } catch (err) {
      console.error(err);
      alert('Ошибка удаления ученика');
    }
  };

  const handleMenuToggle = (event, studentId) => {
    event.stopPropagation();
    setOpenMenuId(prev => (prev === studentId ? null : studentId));
  };

  const handleMenuEdit = (student) => {
    setStudentToEdit(student);
    setIsEditOpen(true);
    setOpenMenuId(null);
  };

  const handleMenuDelete = (studentId) => {
    if (historyStudentId === studentId) {
      setIsHistoryOpen(false);
      setHistoryStudentId(null);
    }
    setOpenMenuId(null);
    handleDeleteStudent(studentId);
  };

  const handleMenuHistory = (student) => {
    setHistoryStudentId(student.studentId);
    setIsHistoryOpen(true);
    setOpenMenuId(null);
  };

  // Фильтрация студентов
  const filteredStudents = students.filter(student => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return getStudentStatus(student.studentId, transactions) === 'overdue';
    if (filter === 'due-today') return getStudentStatus(student.studentId, transactions) === 'due-today';
    if (filter.startsWith('grade:')) return String(student.grade) === filter.split(':')[1];
    if (filter === 'fio') return student.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  // Сортировка по статусу
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const statusOrder = { overdue: 0, 'due-today': 1, 'on-hands': 2, ok: 3 };
    return statusOrder[getStudentStatus(a.studentId, transactions)] -
           statusOrder[getStudentStatus(b.studentId, transactions)];
  });

  // Пагинация
  const totalPages = Math.ceil(sortedStudents.length / perPage);
  const startIdx = (currentPage - 1) * perPage;
  const paginatedStudents = sortedStudents.slice(startIdx, startIdx + perPage);

  // Исторические данные
  useEffect(() => {
    if (!historyStudentId) return;
    const exists = students.some(s => s.studentId === historyStudentId);
    if (!exists) {
      setIsHistoryOpen(false);
      setHistoryStudentId(null);
    }
  }, [students, historyStudentId]);

  const historyStudent = useMemo(() => {
    if (!historyStudentId) return null;
    return students.find(s => s.studentId === historyStudentId) || null;
  }, [students, historyStudentId]);

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort();

  return (
    <div className="abitur-page">
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        mode="edit-student"
        student={studentToEdit}
        onStudentUpdated={(updated) => {
          setStudents(prev => prev.map(s => s.studentId === updated.studentId ? updated : s));
        }}
      />
      <StudentHistoryModal
        isOpen={isHistoryOpen && Boolean(historyStudent)}
        onClose={() => { setIsHistoryOpen(false); setHistoryStudentId(null); }}
        student={historyStudent}
      />

      <h1 className="page-title">Список учеников</h1>

      <div className="grid grid-layout">
        {/* Форма добавления */}
        <div className="section section-sticky">
          <h2 className="section-title">Добавить ученика</h2>
          <form onSubmit={handleAddStudent}>
            <div className="form-group">
              <label className="form-label">ФИО</label>
              <input
                type="text"
                name="name"
                value={newStudent.name}
                onChange={handleInputChange}
                className="input"
                required
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Класс</label>
              <input
                type="number"
                name="grade"
                value={newStudent.grade}
                onChange={handleInputChange}
                className="input"
                required
                min="1"
                max="11"
                placeholder="1-11"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Буква класса</label>
              <input
                type="text"
                name="gradeLetter"
                value={newStudent.gradeLetter}
                onChange={handleInputChange}
                className="input"
                required
                maxLength={1}
                placeholder="A"
              />
            </div>

            <div className="form-group">
              <label className="form-label">ID карты</label>
              <input
                type="text"
                name="cardId"
                value={newStudent.cardId}
                onChange={handleInputChange}
                className="input"
                required
                placeholder="19b3f1b1"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-full">
                Добавить ученика
              </button>
            </div>
          </form>
        </div>

        {/* Список учеников */}
        <div className="section">
          <div className="students-list-header">
            <h2 className="section-title">Ученики</h2>
            <div className="students-controls">
              <select
                className="input input-sm"
                value={filter}
                onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">Все</option>
                <option value="overdue">Просрочили сдачу</option>
                <option value="due-today">Сдают сегодня</option>
                <option value="fio">Поиск по ФИО</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={`grade:${g}`}>Класс {g}</option>
                ))}
              </select>

              {filter === 'fio' && (
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="ФИО..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="grid grid-auto">
            {paginatedStudents.map(student => {
              const status = getStudentStatus(student.studentId, transactions);
              const booksOnHands = getBooksOnHands(student.studentId, transactions);
              const overdueBooks = getOverdueBooks(student.studentId, transactions);
              const gradeLabel = [student.grade, student.gradeLetter && student.gradeLetter.toUpperCase()]
                .filter(Boolean)
                .join(' ')
                .trim();
              
              const cardClass = `card ${
                status === 'overdue' ? 'card-status-overdue' :
                status === 'due-today' ? 'card-status-warning' :
                status === 'on-hands' ? 'card-status-success' : ''
              }`;

              return (
                <div key={student.studentId} className={`${cardClass} student-card`}>
                  <div className="student-card-header">
                    <div className="student-card-header-main">
                      <div className="student-card-title">
                        <h3 className="student-name">{student.name}</h3>
                        {gradeLabel && (
                          <span className="badge badge-primary">{gradeLabel}</span>
                        )}
                      </div>
                      {status === 'overdue' && (
                        <span className="badge badge-danger">Просрочено</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="student-card-menu-toggle"
                      onClick={event => handleMenuToggle(event, student.studentId)}
                      aria-haspopup="true"
                      aria-expanded={openMenuId === student.studentId}
                      aria-label="Открыть меню настроек"
                    >
                      <span className="student-card-menu-icon" />
                    </button>
                    {openMenuId === student.studentId && (
                      <div
                        className="student-card-menu"
                        onClick={event => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="student-card-menu-item"
                          onClick={() => handleMenuEdit(student)}
                        >
                          Редактировать профиль
                        </button>
                        <button
                          type="button"
                          className="student-card-menu-item"
                          onClick={() => handleMenuHistory(student)}
                        >
                          Открыть историю
                        </button>
                        <button
                          type="button"
                          className="student-card-menu-item student-card-menu-item--delete"
                          onClick={() => handleMenuDelete(student.studentId)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="student-card-details">
                    <p><strong>ID карты:</strong> {student.cardId || 'Нет данных'}</p>
                    <p><strong>Книги на руках:</strong> {getBookNameById(booksOnHands, books)}</p>
                    <p><strong>Просрочено:</strong> {getBookNameById(overdueBooks, books) || 'Нет'}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Назад
            </button>
            <span className="pagination-info">
              Страница {currentPage} из {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Вперёд
            </button>
            <span>На странице:</span>
            <select
              value={perPage}
              onChange={e => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="input input-sm select-narrow"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbiturPage;


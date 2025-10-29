import React, { useState, useEffect } from 'react';
import './Modal.css';
import { API_URL } from '../config';

/**
 * Modal Component
 * 
 * @param {boolean} isOpen - Открыто ли модальное окно
 * @param {function} onClose - Callback при закрытии
 * @param {number} bookId - ID книги (для mode='issue')
 * @param {'issue'|'edit-student'} mode - Режим работы модалки
 * @param {object} student - Объект ученика (для mode='edit-student')
 * @param {function} onStudentUpdated - Callback после обновления ученика
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  bookId, 
  mode = 'issue', 
  student = null, 
  onStudentUpdated 
}) => {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [returnDate, setReturnDate] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    grade: '',
    gradeLetter: '',
    cardId: ''
  });

  // Загружаем данные при открытии модалки
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'issue') {
      fetch(`${API_URL}/api/students`)
        .then(res => res.ok ? res.json() : Promise.reject(res.status))
        .then(data => setStudents(Array.isArray(data) ? data : []))
        .catch(err => console.error('Ошибка загрузки учеников:', err));
    } else if (mode === 'edit-student' && student) {
      setEditForm({
        name: student.name || '',
        grade: String(student.grade || ''),
        gradeLetter: String(student.gradeLetter || ''),
        cardId: String(student.cardId || ''),
      });
    }
  }, [isOpen, mode, student]);

  if (!isOpen) return null;

  // Фильтруем учеников по поиску
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    `${s.grade} ${s.gradeLetter}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'issue') {
      if (!selectedStudent || !bookId || !returnDate) {
        alert('Заполните все поля');
        return;
      }

      try {
        // Создаём транзакцию
        const trRes = await fetch(`${API_URL}/api/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: selectedStudent.studentId,
            bookId,
            action: 'taken',
            date: returnDate
          })
        });

        if (!trRes.ok) {
          const err = await trRes.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка создания транзакции');
        }

        // Уменьшаем количество книг
        const qtyRes = await fetch(`${API_URL}/api/books/${bookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantityDelta: -1 })
        });

        if (!qtyRes.ok) {
          console.warn('Не удалось обновить количество книги');
        }

        alert('Книга успешно выдана!');
        onClose();
        window.location.reload(); // Обновляем страницу
      } catch (err) {
        console.error(err);
        alert(err.message || 'Ошибка при выдаче книги');
      }
    } else if (mode === 'edit-student' && student) {
      try {
        const payload = {
          name: editForm.name.trim(),
          grade: Number(editForm.grade),
          gradeLetter: editForm.gradeLetter.trim(),
          cardId: editForm.cardId.trim(),
        };

        const res = await fetch(`${API_URL}/api/students/${student.studentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка обновления ученика');
        }

        const updated = await res.json();
        if (onStudentUpdated) onStudentUpdated(updated);
        alert('Ученик успешно обновлён!');
        onClose();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Не удалось обновить ученика');
      }
    }
  };

  // Закрытие по клику на overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'issue' ? 'Выдать книгу' : 'Редактировать ученика'}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {mode === 'issue' ? (
            <>
              <div className="form-group">
                <label className="form-label">Поиск ученика *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Введите имя или класс ученика"
                  value={selectedStudent 
                    ? `${selectedStudent.name} (${selectedStudent.grade}${selectedStudent.gradeLetter})` 
                    : search
                  }
                  onChange={e => {
                    setSearch(e.target.value);
                    setSelectedStudent(null);
                  }}
                  autoComplete="off"
                  required
                />
                {search && !selectedStudent && (
                  <ul className="student-dropdown">
                    {filteredStudents.length === 0 ? (
                      <li className="student-dropdown-item no-result">
                        Не найдено
                      </li>
                    ) : (
                      filteredStudents.map(s => (
                        <li
                          key={s.studentId}
                          className="student-dropdown-item"
                          onClick={() => {
                            setSelectedStudent(s);
                            setSearch('');
                          }}
                        >
                          {s.name} ({s.grade}{s.gradeLetter})
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Срок сдачи *</label>
                <input
                  type="date"
                  className="input"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                Выдать книгу
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">ФИО *</label>
                <input
                  type="text"
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Класс *</label>
                <input
                  type="number"
                  className="input"
                  value={editForm.grade}
                  min="1"
                  max="11"
                  onChange={e => setEditForm(f => ({ ...f, grade: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Буква класса *</label>
                <input
                  type="text"
                  className="input"
                  maxLength={1}
                  value={editForm.gradeLetter}
                  onChange={e => setEditForm(f => ({ ...f, gradeLetter: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">ID карты *</label>
                <input
                  type="text"
                  className="input"
                  value={editForm.cardId}
                  onChange={e => setEditForm(f => ({ ...f, cardId: e.target.value }))}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                Сохранить изменения
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Modal;
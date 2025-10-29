import React, { useEffect, useMemo, useState } from 'react';
import './Modal.css';
import { API_URL } from '../config';
import StudentHistoryModal from './StudentHistoryModal';
const MAX_DEADLINE_DAYS = 180;
const DEFAULT_DURATION = { value: 1, unit: 'weeks' };
const DURATION_UNITS = [
  { value: 'days', label: 'дней' },
  { value: 'weeks', label: 'недель' },
  { value: 'months', label: 'месяцев' },
  { value: 'years', label: 'лет' }
];
const DURATION_PRESETS = [
  { label: '2 недели', value: 2, unit: 'weeks' },
  { label: '1 месяц', value: 1, unit: 'months' },
  { label: 'До конца семестра', value: null, unit: 'semester' }
];
const HOLIDAYS = new Set(['01-01', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (value) => {
  const date = startOfDay(value);
  date.setHours(23, 59, 0, 0);
  return date;
};
const addDuration = (date, { value, unit }) => {
  const result = new Date(date);
  switch (unit) {
    case 'weeks':
      result.setDate(result.getDate() + value * 7);
      break;
    case 'months':
      result.setMonth(result.getMonth() + value);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + value);
      break;
    case 'days':
    default:
      result.setDate(result.getDate() + value);
  }
  return result;
};
const differenceInDays = (later, earlier) => {
  return Math.ceil((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / MS_PER_DAY);
};
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};
const isHoliday = (date) => {
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return HOLIDAYS.has(key);
};
const adjustToWorkday = (candidate, maxDate) => {
  const adjusted = startOfDay(candidate);
  const limit = startOfDay(maxDate);
  while ((isWeekend(adjusted) || isHoliday(adjusted)) && adjusted.getTime() <= limit.getTime()) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  if (adjusted.getTime() > limit.getTime()) {
    return limit;
  }
  return adjusted;
};
const formatDateInput = (date) => startOfDay(date).toISOString().slice(0, 10);
const formatHumanDate = (date) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const pluralizeDays = (days) => {
  const abs = Math.abs(days);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
};
const getSemesterEnd = (base) => {
  const month = base.getMonth();
  const year = base.getFullYear();
  if (month < 6) {
    return new Date(year, 5, 30);
  }
  return new Date(year, 11, 31);
};
const IssueModal = ({
  isOpen,
  onClose,
  onIssued,
  bookId = null,
  initialBook = null
}) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDeadline = useMemo(
    () => endOfDay(addDuration(today, { value: MAX_DEADLINE_DAYS, unit: 'days' })),
    [today]
  );
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [searchBook, setSearchBook] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedBook, setSelectedBook] = useState(initialBook);
  const [durationField, setDurationField] = useState({
    value: String(DEFAULT_DURATION.value),
    unit: DEFAULT_DURATION.unit
  });
  const [deadlineDate, setDeadlineDate] = useState(() =>
    endOfDay(adjustToWorkday(addDuration(today, DEFAULT_DURATION), maxDeadline))
  );
  const [deadlineError, setDeadlineError] = useState('');
  const [deadlineHint, setDeadlineHint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setFetchError('');
      try {
        const [studentsRes, booksRes] = await Promise.all([
          fetch(`${API_URL}/api/students`),
          fetch(`${API_URL}/api/books`)
        ]);
        if (!studentsRes.ok || !booksRes.ok) {
          throw new Error('Ошибка загрузки справочников');
        }
        const [studentsData, booksData] = await Promise.all([
          studentsRes.json(),
          booksRes.json()
        ]);
        if (!cancelled) {
          setStudents(Array.isArray(studentsData) ? studentsData : []);
          setBooks(Array.isArray(booksData) ? booksData : []);
          if (bookId) {
            const matched = booksData.find(book => String(book.id) === String(bookId));
            setSelectedBook(matched || initialBook || null);
          } else if (initialBook) {
            setSelectedBook(initialBook);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки данных для выдачи:', err);
        if (!cancelled) {
          setFetchError('Не удалось загрузить список учеников или книг. Обновите страницу и попробуйте снова.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookId, initialBook]);
  useEffect(() => {
    if (!isOpen) {
      setSearchStudent('');
      setSearchBook('');
      setSelectedStudent(null);
      if (!bookId) {
        setSelectedBook(initialBook || null);
      }
      setDurationField({
        value: String(DEFAULT_DURATION.value),
        unit: DEFAULT_DURATION.unit
      });
      setDeadlineDate(endOfDay(adjustToWorkday(addDuration(today, DEFAULT_DURATION), maxDeadline)));
      setDeadlineError('');
      setDeadlineHint('');
      setIsSubmitting(false);
    }
  }, [isOpen, bookId, initialBook, today, maxDeadline]);
  const filteredStudents = useMemo(() => {
    const query = searchStudent.trim().toLowerCase();
    if (!query) {
      return students.slice(0, 10);
    }
    return students
      .filter(student =>
        student.name.toLowerCase().includes(query) ||
        `${student.grade}${student.gradeLetter}`.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [searchStudent, students]);
  const filteredBooks = useMemo(() => {
    if (bookId) return [];
    const query = searchBook.trim().toLowerCase();
    if (!query) {
      return books.slice(0, 10);
    }
    return books
      .filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [searchBook, books, bookId]);
  const effectiveBook = useMemo(() => {
    if (bookId) {
      return books.find(book => String(book.id) === String(bookId)) || selectedBook || null;
    }
    return selectedBook;
  }, [bookId, books, selectedBook]);
  const deadlineIso = formatDateInput(deadlineDate);
  const remainingDays = Math.max(0, differenceInDays(deadlineDate, today));
  const remainingText = remainingDays === 0
    ? 'сдать сегодня'
    : `осталось ${remainingDays} ${pluralizeDays(remainingDays)}`;
  const setDeadlineFromDuration = (value, unit, opts = {}) => {
    if (!Number.isFinite(value) || value <= 0) {
      setDeadlineError('Введите положительное целое число.');
      setDeadlineHint('');
      return false;
    }
    const duration = { value, unit };
    const candidate = addDuration(today, duration);
    const candidateStart = startOfDay(candidate);
    if (differenceInDays(candidateStart, today) > MAX_DEADLINE_DAYS) {
      setDeadlineError(`Дедлайн не может быть позже ${formatHumanDate(maxDeadline)}.`);
      setDeadlineHint('');
      return false;
    }
    let adjusted = adjustToWorkday(candidateStart, maxDeadline);
    let hint = '';
    if (adjusted.getTime() !== candidateStart.getTime()) {
      hint = 'Дата перенесена на ближайший рабочий день.';
    }
    setDurationField({ value: String(value), unit });
    setDeadlineDate(endOfDay(adjusted));
    setDeadlineError('');
    setDeadlineHint(opts.hint ?? hint);
    return true;
  };
  const handleDurationValueChange = (event) => {
    const raw = event.target.value;
    setDurationField(prev => ({ ...prev, value: raw }));
    const numeric = Number(raw);
    if (!raw) {
      setDeadlineError('Поле не может быть пустым.');
      setDeadlineHint('');
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setDeadlineError('Введите положительное целое число.');
      setDeadlineHint('');
      return;
    }
    setDeadlineFromDuration(Math.floor(numeric), durationField.unit);
  };
  const handleDurationUnitChange = (event) => {
    const newUnit = event.target.value;
    const numeric = Number(durationField.value);
    setDurationField(prev => ({ ...prev, unit: newUnit }));
    if (Number.isFinite(numeric) && numeric > 0) {
      setDeadlineFromDuration(Math.floor(numeric), newUnit);
    }
  };
  const handleDeadlineChange = (event) => {
    const value = event.target.value;
    if (!value) {
      setDeadlineError('Укажите дату возврата.');
      setDeadlineHint('');
      return;
    }
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setDeadlineError('Некорректная дата.');
      setDeadlineHint('');
      return;
    }
    const candidateStart = startOfDay(parsed);
    if (candidateStart.getTime() < today.getTime()) {
      setDeadlineError('Дата не может быть раньше сегодняшнего дня.');
      setDeadlineHint('');
      return;
    }
    if (differenceInDays(candidateStart, today) > MAX_DEADLINE_DAYS) {
      setDeadlineError(`Дедлайн не может быть позже ${formatHumanDate(maxDeadline)}.`);
      setDeadlineHint('');
      return;
    }
    const adjusted = adjustToWorkday(candidateStart, maxDeadline);
    const diff = Math.max(1, differenceInDays(adjusted, today));
    setDurationField({ value: String(diff), unit: 'days' });
    setDeadlineDate(endOfDay(adjusted));
    setDeadlineError('');
    setDeadlineHint(adjusted.getTime() !== candidateStart.getTime() ? 'Дата перенесена на ближайший рабочий день.' : '');
  };
  const applyPreset = (preset) => {
    if (preset.unit === 'semester') {
      const semesterEnd = adjustToWorkday(getSemesterEnd(today), maxDeadline);
      const diff = Math.max(1, Math.min(MAX_DEADLINE_DAYS, differenceInDays(semesterEnd, today)));
      const hint = differenceInDays(semesterEnd, today) > MAX_DEADLINE_DAYS
        ? `Срок ограничен ${MAX_DEADLINE_DAYS} днями от текущей даты.`
        : '';
      setDeadlineFromDuration(diff, 'days', { hint });
      return;
    }
    setDeadlineFromDuration(preset.value, preset.unit);
  };
  const canSubmit = Boolean(
    selectedStudent &&
    (bookId || effectiveBook) &&
    !deadlineError &&
    !isSubmitting
  );
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStudent) {
      setDeadlineError('Выберите ученика.');
      return;
    }
    if (!bookId && !effectiveBook) {
      setDeadlineError('Выберите книгу.');
      return;
    }
    if (deadlineError) {
      return;
    }
    const effectiveBookId = bookId ?? effectiveBook?.id;
    if (!effectiveBookId) {
      setDeadlineError('Не удалось определить книгу для выдачи.');
      return;
    }
    const payload = {
      studentId: selectedStudent.studentId,
      bookId: effectiveBookId,
      action: 'taken',
      date: formatDateInput(deadlineDate)
    };
    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Не удалось сохранить выдачу.');
      }
      await fetch(`${API_URL}/api/books/${effectiveBookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta: -1 })
      }).catch(() => {
        console.warn('Не удалось обновить остаток книги');
      });
      onClose();
      if (typeof onIssued === 'function') {
        onIssued();
      }
    } catch (err) {
      console.error('Ошибка оформления выдачи:', err);
      setDeadlineError(err.message || 'Не удалось оформить выдачу.');
    } finally {
      setIsSubmitting(false);
    }
  };
  if (!isOpen) {
    return null;
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content issue-modal">
        <div className="modal-header">
          <h2 className="modal-title">Выдача книги</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>
        <div className="issue-layout">
          <form className="modal-form issue-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Ученик *</label>
              <input
                type="text"
                className="input"
                placeholder="Начните вводить ФИО или класс"
                value={selectedStudent ? `${selectedStudent.name} (${selectedStudent.grade}${selectedStudent.gradeLetter || ''})` : searchStudent}
                onChange={event => {
                  setSearchStudent(event.target.value);
                  setSelectedStudent(null);
                }}
                autoComplete="off"
              />
              {searchStudent && !selectedStudent && (
                <ul className="student-dropdown">
                  {filteredStudents.length === 0 ? (
                    <li className="student-dropdown-item no-result">Совпадений не найдено</li>
                  ) : (
                    filteredStudents.map(student => (
                      <li
                        key={student.studentId}
                        className="student-dropdown-item"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchStudent('');
                        }}
                      >
                        {student.name} ({student.grade}{student.gradeLetter || ''})
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {!bookId && (
              <div className="form-group">
                <label className="form-label">Книга *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Название или автор"
                  value={effectiveBook ? `${effectiveBook.title} — ${effectiveBook.author}` : searchBook}
                  onChange={event => {
                    setSearchBook(event.target.value);
                    setSelectedBook(null);
                  }}
                  autoComplete="off"
                />
                {searchBook && !effectiveBook && (
                  <ul className="student-dropdown">
                    {filteredBooks.length === 0 ? (
                      <li className="student-dropdown-item no-result">Книг не найдено</li>
                    ) : (
                      filteredBooks.map(book => (
                        <li
                          key={book.id}
                          className="student-dropdown-item"
                          onClick={() => {
                            setSelectedBook(book);
                            setSearchBook('');
                          }}
                        >
                          {book.title} — {book.author}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
            {fetchError && <div className="form-error">{fetchError}</div>}
            {isLoading && <div className="issue-loading">Загружаем данные…</div>}
            <div className="issue-deadline-panel">
              <div className="issue-deadline-header">
                <span className="issue-deadline-title">На срок</span>
                <span className="issue-deadline-caption">Выберите период выдачи</span>
              </div>
              <div className="issue-deadline-grid">
                <div className="issue-duration">
                  <input
                    type="number"
                    min={1}
                    className="input issue-duration-input"
                    value={durationField.value}
                    onChange={handleDurationValueChange}
                  />
                  <select
                    className="input issue-duration-unit"
                    value={durationField.unit}
                    onChange={handleDurationUnitChange}
                  >
                    {DURATION_UNITS.map(unit => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="issue-presets">
                {DURATION_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className="issue-preset"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              </div>
              <p className="issue-deadline-note">
                Дедлайн до <strong>{formatHumanDate(deadlineDate)}</strong> (осталось {remainingText}), возврат до 23:59.
              </p>
              {deadlineHint && !deadlineError && (
                <p className="issue-deadline-hint">{deadlineHint}</p>
              )}
              {deadlineError && (
                <p className="form-error">{deadlineError}</p>
              )}
            </div>
            <div className="issue-footer">
              <button
                type="submit"
                className="btn btn-primary issue-submit-button"
                disabled={!canSubmit}
              >
                {isSubmitting ? 'Сохраняем...' : 'Выдать книгу'}
              </button>
            </div>
          </form>
          <StudentHistoryModal
            variant="inline"
            isOpen={Boolean(selectedStudent)}
            student={selectedStudent}
          />
        </div>
      </div>
    </div>
  );
};
export default IssueModal;

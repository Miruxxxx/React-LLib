import React, { useEffect, useMemo, useState } from 'react';
import './Modal.css';
import { API_URL } from '../config';

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString('ru-RU');
};

const StudentHistoryModal = ({
  isOpen,
  onClose = () => {},
  student,
  variant = 'modal'
}) => {
  const studentId = student?.studentId;
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, overdue: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !studentId) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadHistory = async () => {
      setIsLoading(true);
      setError('');

      try {
        const res = await fetch(`${API_URL}/api/students/${studentId}/history`, {
          signal: controller.signal
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Не удалось загрузить историю.');
        }

        const data = await res.json();
        if (cancelled) return;

        setHistory(Array.isArray(data.history) ? data.history : []);
        setSummary({
          total: data.summary?.total ?? 0,
          active: data.summary?.active ?? 0,
          overdue: data.summary?.overdue ?? 0
        });
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        console.error('Ошибка загрузки истории:', err);
        setError(err.message || 'Не удалось загрузить историю.');
        setHistory([]);
        setSummary({ total: 0, active: 0, overdue: 0 });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, studentId]);

  useEffect(() => {
    if (!isOpen) {
      setHistory([]);
      setSummary({ total: 0, active: 0, overdue: 0 });
      setIsLoading(false);
      setError('');
    }
  }, [isOpen]);

  const gradeLabel = useMemo(() => {
    if (!student) return '';
    const parts = [student.grade, student.gradeLetter && student.gradeLetter.toString().toUpperCase()];
    return parts.filter(Boolean).join(' ');
  }, [student]);

  if (!isOpen || !studentId) {
    return null;
  }

  const showCloseButton = variant === 'modal';

  const content = (
    <div className={`history-panel ${variant === 'inline' ? 'history-panel--inline' : ''}`}>
      <div className="history-panel-header">
        <div>
          <h3 className="history-panel-title">История выдачи</h3>
          {student && (
            <p className="history-panel-subtitle">
              {student.name}
              {gradeLabel ? ` · ${gradeLabel}` : ''}
            </p>
          )}
        </div>
        {showCloseButton && (
          <button
            type="button"
            className="history-panel-close"
            onClick={onClose}
            aria-label="Закрыть историю"
          >
            &times;
          </button>
        )}
      </div>

      <div className="history-panel-summary">
        <span>Всего: <strong>{summary.total}</strong></span>
        <span>На руках: <strong>{summary.active}</strong></span>
        <span>Просрочено: <strong className={summary.overdue > 0 ? 'text-danger' : ''}>{summary.overdue}</strong></span>
      </div>

      {isLoading && (
        <div className="history-panel-state">Загружаем историю...</div>
      )}

      {error && !isLoading && (
        <div className="history-panel-state history-panel-error">{error}</div>
      )}

      {!isLoading && !error && history.length === 0 && (
        <div className="history-panel-state">История пока пуста.</div>
      )}

      {!isLoading && !error && history.length > 0 && (
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Книга</th>
                <th>Срок сдачи</th>
                <th>Дата возврата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr
                  key={item.id}
                  className={[
                    item.overdue ? 'history-row--overdue' : '',
                    item.status ? `history-row--${item.status}` : ''
                  ].filter(Boolean).join(' ')}
                >
                  <td>
                    <div className="history-book-title">{item.title}</div>
                    <div className="history-book-author">{item.author}</div>
                  </td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td>{item.returnDate ? formatDate(item.returnDate) : '—'}</td>
                  <td>
                    <span className={`history-status history-status--${item.status}`}>
                      {item.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <div className="modal-overlay history-modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content history-modal">
        {content}
      </div>
    </div>
  );
};

export default StudentHistoryModal;

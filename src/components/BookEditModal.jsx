import React, { useEffect, useState } from 'react';
import './Modal.css';
import { API_URL } from '../config';

const initialState = {
  title: '',
  author: '',
  genre: '',
  year: '',
  quantity: '',
  barcode: ''
};

const BookEditModal = ({ isOpen, onClose, book, onUpdated }) => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && book) {
      setForm({
        title: book.title || '',
        author: book.author || '',
        genre: book.genre || '',
        year: book.year ? String(book.year) : '',
        quantity: Number.isFinite(book.quantity) ? String(book.quantity) : '',
        barcode: book.barcode ? String(book.barcode) : ''
      });
      setError('');
    } else if (!isOpen) {
      setForm(initialState);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, book]);

  if (!isOpen || !book) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const title = form.title.trim();
    const author = form.author.trim();
    const genre = form.genre.trim();
    const yearText = form.year.trim();
    const quantityText = form.quantity.trim();
    const barcodeText = form.barcode.trim();

    if (!title || !author) {
      setError('Название и автор обязательны.');
      return;
    }

    const payload = {
      title,
      author,
      genre
    };

    if (yearText) {
      const yearValue = Number(yearText);
      if (!Number.isFinite(yearValue) || yearValue < 0) {
        setError('Год должен быть положительным числом.');
        return;
      }
      payload.year = yearValue;
    } else {
      payload.year = null;
    }

    if (quantityText) {
      const quantityValue = Number(quantityText);
      if (!Number.isFinite(quantityValue) || quantityValue < 0) {
        setError('Количество должно быть неотрицательным числом.');
        return;
      }
      payload.quantity = quantityValue;
    }

    if (barcodeText) {
      const barcodeValue = Number(barcodeText);
      if (!Number.isFinite(barcodeValue)) {
        setError('Штрих-код должен содержать только цифры.');
        return;
      }
      payload.barcode = barcodeValue;
    } else {
      payload.barcode = null;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const res = await fetch(`${API_URL}/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const payloadError = await res.json().catch(() => ({}));
        throw new Error(payloadError.error || 'Не удалось сохранить изменения.');
      }

      const updatedBook = await res.json();
      onUpdated?.(updatedBook);
      onClose();
    } catch (err) {
      console.error('Ошибка обновления книги:', err);
      setError(err.message || 'Не удалось сохранить изменения.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Редактирование книги</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input
              type="text"
              name="title"
              className="input"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Автор *</label>
            <input
              type="text"
              name="author"
              className="input"
              value={form.author}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Жанр</label>
            <input
              type="text"
              name="genre"
              className="input"
              value={form.genre}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Год издания</label>
            <input
              type="number"
              name="year"
              className="input"
              value={form.year}
              onChange={handleChange}
              min="0"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Количество</label>
            <input
              type="number"
              name="quantity"
              className="input"
              value={form.quantity}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Штрих-код</label>
            <input
              type="text"
              name="barcode"
              className="input"
              value={form.barcode}
              onChange={handleChange}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookEditModal;

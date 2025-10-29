import React, { useCallback, useEffect, useState } from 'react';
import './BooksPage.css';
import { API_URL, DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '../config';
import IssueModal from '../components/IssueModal';
import BookEditModal from '../components/BookEditModal';

const createEmptyBookForm = () => ({
  title: '',
  author: '',
  genre: '',
  year: '',
  quantity: '',
  barcode: ''
});

const BooksPage = () => {
  const [books, setBooks] = useState([]);
  const [newBook, setNewBook] = useState(createEmptyBookForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [booksPerPage, setBooksPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [openMenuBookId, setOpenMenuBookId] = useState(null);
  const [isBookEditOpen, setIsBookEditOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState(null);

  const loadBooks = useCallback(() => {
    fetch(`${API_URL}/api/books`)
      .then(res => res.json())
      .then(data => setBooks(Array.isArray(data) ? data : []))
      .catch(err => console.error('Ошибка загрузки книг:', err));
  }, []);

  // Загружаем книги
  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        !event.target.closest('.book-card-menu') &&
        !event.target.closest('.book-card-menu-toggle')
      ) {
        setOpenMenuBookId(null);
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

  // Debounce для поиска
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewBook(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const title = newBook.title.trim();
    const author = newBook.author.trim();

    if (!title || !author) {
      alert('Введите название и автора книги.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBook,
          title,
          author,
          genre: newBook.genre.trim()
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(`Ошибка: ${error.error || 'Не удалось добавить книгу'}`);
        return;
      }

      const addedBook = await res.json();
      setBooks(prev => [...prev, addedBook]);
      setNewBook(createEmptyBookForm());
    } catch (err) {
      console.error('Ошибка добавления книги:', err);
      alert('Не удалось добавить книгу');
    }
  };

  const handleDeleteBook = async (id) => {
    if (!confirm('Удалить книгу?')) return;

    try {
      const res = await fetch(`${API_URL}/api/books/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Не удалось удалить книгу');

      const data = await res.json();
      if (data.success) {
        setBooks(prev => prev.filter(book => book.id !== id));
        setOpenMenuBookId(prev => (prev === id ? null : prev));
        if (bookToEdit && bookToEdit.id === id) {
          setBookToEdit(null);
          setIsBookEditOpen(false);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка удаления книги');
    }
  };

  const handleBookMenuToggle = (event, bookId) => {
    event.stopPropagation();
    setOpenMenuBookId(prev => (prev === bookId ? null : bookId));
  };

  const handleBookMenuIssue = (book) => {
    setOpenMenuBookId(null);
    openModal(book);
  };

  const handleBookMenuEdit = (book) => {
    setBookToEdit(book);
    setIsBookEditOpen(true);
    setOpenMenuBookId(null);
  };

  const handleBookMenuDelete = (bookId) => {
    setOpenMenuBookId(null);
    handleDeleteBook(bookId);
  };

  const handleBookUpdated = (updatedBook) => {
    setBooks(prev => prev.map(book => (book.id === updatedBook.id ? updatedBook : book)));
    setBookToEdit(updatedBook);
  };

  const closeBookEditModal = () => {
    setIsBookEditOpen(false);
    setBookToEdit(null);
  };

  const openModal = (book) => {
    setOpenMenuBookId(null);
    setSelectedBookId(book?.id ?? null);
    setSelectedBook(book || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBook(null);
  };

  // Фильтруем книги
  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const filteredBooks = books.filter(book => {
    if (!normalizedQuery) {
      return true;
    }

    const searchableValues = [
      book.title,
      book.author,
      book.genre,
      book.id,
      book.year,
      book.barcode
    ];

    return searchableValues
      .filter(value => value !== null && value !== undefined && value !== '')
      .some(value => String(value).toLowerCase().includes(normalizedQuery));
  });

  // Пагинация
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const startIdx = (currentPage - 1) * booksPerPage;
  const paginatedBooks = filteredBooks.slice(startIdx, startIdx + booksPerPage);

  return (
    <div className="books-page">
      <IssueModal
        isOpen={isModalOpen}
        onClose={closeModal}
        bookId={selectedBookId}
        initialBook={selectedBook}
        onIssued={loadBooks}
      />
      <BookEditModal
        isOpen={isBookEditOpen}
        onClose={closeBookEditModal}
        book={bookToEdit}
        onUpdated={(updated) => {
          handleBookUpdated(updated);
          loadBooks();
        }}
      />

      <h1 className="page-title">Библиотека книг</h1>

      <div className="grid grid-layout">
        {/* Форма добавления книги */}
        {/* Форма добавления новой книги */}
        <div className="section section-sticky">
          <h2 className="section-title">Добавить новую книгу</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Название книги *</label>
              <input
                type="text"
                name="title"
                value={newBook.title}
                onChange={handleInputChange}
                className="input"
                placeholder="Введите название книги"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Автор *</label>
              <input
                type="text"
                name="author"
                value={newBook.author}
                onChange={handleInputChange}
                className="input"
                placeholder="Укажите автора"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Жанр</label>
              <select
                name="genre"
                value={newBook.genre}
                onChange={handleInputChange}
                className="input"
              >
                <option value="">Выберите жанр</option>
                <option value="Художественная литература">Художественная литература</option>
                <option value="Фантастика">Фантастика</option>
                <option value="Приключения">Приключения</option>
                <option value="Научная литература">Научная литература</option>
                <option value="Учебная">Учебная</option>
                <option value="Биография">Биография</option>
                <option value="Детская литература">Детская литература</option>
                <option value="Другое">Другое</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Год издания</label>
              <input
                type="number"
                name="year"
                value={newBook.year}
                onChange={handleInputChange}
                className="input"
                placeholder="Например, 2024"
                min="0"
                max={new Date().getFullYear()}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Количество</label>
              <input
                type="number"
                name="quantity"
                value={newBook.quantity}
                onChange={handleInputChange}
                className="input"
                placeholder="Сколько экземпляров"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Штрих-код</label>
              <input
                type="text"
                name="barcode"
                value={newBook.barcode}
                onChange={handleInputChange}
                className="input"
                placeholder="Введите штрих-код (если есть)"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-full">
                Добавить книгу
              </button>
            </div>
          </form>
        </div>

        {/* Список книг */}
        <div className="section">
          <div className="books-list-header">
            <h2 className="section-title">Список книг</h2>
            <div className="books-controls">
              <input
                type="search"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input input-sm"
                placeholder="Поиск..."
              />
            </div>
          </div>

          <div className="grid grid-auto">
            {paginatedBooks.map(book => (
              <div key={book.id} className="card card-compact book-card">
                <div className="book-card-header">
                  <div className="book-card-header-main">
                    <h3 className="book-title">{book.title}</h3>
                    <span className={`badge ${book.quantity > 0 ? 'badge-success' : 'badge-danger'}`}>
                      {book.quantity > 0 ? `Доступно: ${book.quantity}` : 'Недоступна'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="book-card-menu-toggle"
                    onClick={(event) => handleBookMenuToggle(event, book.id)}
                    aria-haspopup="true"
                    aria-expanded={openMenuBookId === book.id}
                    aria-label="Открыть меню действий книги"
                  >
                    <span className="book-card-menu-icon" />
                  </button>
                  {openMenuBookId === book.id && (
                    <div
                      className="book-card-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="book-card-menu-item"
                        onClick={() => handleBookMenuIssue(book)}
                        disabled={book.quantity <= 0}
                      >
                        Выдать книгу
                      </button>
                      <button
                        type="button"
                        className="book-card-menu-item"
                        onClick={() => handleBookMenuEdit(book)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="book-card-menu-item book-card-menu-item--delete"
                        onClick={() => handleBookMenuDelete(book.id)}
                      >
                        Удалить книгу
                      </button>
                    </div>
                  )}
                </div>

                <div className="book-card-details">
                  <p><strong>Автор:</strong> {book.author}</p>
                  <p><strong>Жанр:</strong> {book.genre || '—'}</p>
                  <p><strong>Год:</strong> {book.year || '—'}</p>
                  <p><strong>Количество:</strong> {book.quantity}</p>
                  <p><strong>Штрих-код:</strong> {book.barcode || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="empty-table">Книги не найдены</div>
          )}

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
              value={booksPerPage}
              onChange={e => {
                setBooksPerPage(Number(e.target.value));
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

export default BooksPage;

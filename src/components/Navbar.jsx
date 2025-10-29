import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';
import { USER_NAME } from '../config';
import schoolLogo from '../images/schoolLogo.png';

function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts[1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-container">
          <div className="navbar-brand">
            <img src={schoolLogo} alt="Школа" className="navbar-logo" />
          </div>

          <div className="navbar-links">
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Главная
            </Link>

            <Link
              to="/books"
              className={`nav-link ${location.pathname === '/books' ? 'active' : ''}`}
            >
              Книги
            </Link>

            <Link
              to="/abiturients"
              className={`nav-link ${location.pathname === '/abiturients' ? 'active' : ''}`}
            >
              Абитуриенты
            </Link>
          </div>

          <div className="navbar-right">
            <button
              type="button"
              className="account-button"
              aria-label="Открыть аккаунт пользователя"
            >
              <span className="avatar" aria-hidden="true">
                {getInitials(USER_NAME)}
              </span>
              <span className="account-name">{USER_NAME}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import AbiturPage from './pages/AbiturPage';
import BooksPage from './pages/BooksPage'


function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <div className="container">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/abiturients" element={<AbiturPage />} />
              <Route path="/books" element={<BooksPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
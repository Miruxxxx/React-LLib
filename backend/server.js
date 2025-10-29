import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ipAddress } from './StaticIp.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ====================== MIDDLEWARE ======================

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Protection against huge payloads

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

// ====================== HELPER FUNCTIONS ======================

const dataPath = (file) => path.join(__dirname, 'data', file);

/**
 * Safe file read with error handling
 */
async function readJsonFile(filename) {
  try {
    const data = await fs.readFile(dataPath(filename), 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`File ${filename} not found, returning empty array`);
      return [];
    }
    throw err;
  }
}

/**
 * Safe file write with atomic operation (write to temp file first)
 */
async function writeJsonFile(filename, data) {
  const filePath = dataPath(filename);
  const tempPath = `${filePath}.tmp`;
  
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Cleanup temp file if exists
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw err;
  }
}


const CYRILLIC_TO_LATIN = {
  '\u0410': 'A', '\u0412': 'B', '\u0421': 'C', '\u0415': 'E', '\u041a': 'K', '\u041c': 'M',
  '\u041d': 'H', '\u041e': 'O', '\u0420': 'P', '\u0422': 'T', '\u0423': 'Y', '\u0425': 'X',
  '\u0430': 'a', '\u0432': 'b', '\u0441': 'c', '\u0435': 'e', '\u043a': 'k', '\u043c': 'm',
  '\u043d': 'h', '\u043e': 'o', '\u0440': 'p', '\u0442': 't', '\u0443': 'y', '\u0445': 'x',
};


const mapCyrillicToLatin = (ch) => CYRILLIC_TO_LATIN[ch] || ch;


const normalizeCardId = (cardIdRaw) => {
  if (!cardIdRaw) return '';

  let normalized = String(cardIdRaw)
    .replace(/\s+/g, '')
    .toLowerCase();

  normalized = Array.from(normalized)
    .map(ch => mapCyrillicToLatin(ch))
    .join('');

  return normalized.replace(/[^a-z0-9]/g, '');
};

const getTransactionOrderValue = (tx) => {
  if (!tx) return 0;

  const idNumber = Number(tx.id);
  if (Number.isFinite(idNumber) && idNumber > 0) {
    return idNumber;
  }

  const parsedDate = Date.parse(tx.date);
  if (Number.isFinite(parsedDate)) {
    return parsedDate;
  }

  return 0;
};

/**
 * Validates and sanitizes student payload
 * @throws {Error} if validation fails
 */
const sanitizeStudentPayload = (body) => {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length < 2) {
    throw new Error('Name is required and must be at least 2 characters long.');
  }

  const gradeNum = Number.parseInt(body?.grade, 10);
  if (!Number.isFinite(gradeNum) || gradeNum < 1 || gradeNum > 11) {
    throw new Error('Grade must be a number between 1 and 11.');
  }

  const gradeLetter = String(body?.gradeLetter);
  if (!gradeLetter) {
    throw new Error('Grade letter must be a single letter (A-Z).');
  }

  const cardId = normalizeCardId(body?.cardId);
  if (!cardId || cardId.length < 3) {
    throw new Error('Card ID is required and must contain at least 3 characters.');
  }

  const studentId = Date.now();

  return { name, studentId, grade: gradeNum, gradeLetter, cardId };
};

/**
 * Picks only allowed fields from student object
 */
const pickStudentFields = (student) => {
  if (!student) return null;

  const name = String(student?.name ?? '').trim();
  const studentId = Number(student?.studentId);
  const grade = Number(student?.grade);
  const gradeLetter = String(student?.gradeLetter);
  const cardId = normalizeCardId(student?.cardId);

  if (!name || !Number.isFinite(studentId) || !Number.isFinite(grade) || 
      !gradeLetter || !cardId) {
    return null;
  }

  return { name, studentId, grade, gradeLetter, cardId };
};

// ====================== BOOKS API ======================

app.get('/api/books', async (req, res) => {
  try {
    const books = await readJsonFile('books.json');
    res.json(books);
  } catch (err) {
    console.error('Error reading books:', err);
    res.status(500).json({ error: 'Failed to load books.' });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const books = await readJsonFile('books.json');

    const { title, author, barcode, quantity, year } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required.' });
    }

    const newBook = {
      id: Date.now(),
      title: String(title).trim(),
      author: String(author).trim(),
      barcode: barcode ? Number(barcode) : null,
      quantity: quantity ? Number(quantity) : 1,
      year: year ? Number(year) : null,
    };

    books.push(newBook);
    await writeJsonFile('books.json', books);
    res.status(201).json(newBook);
  } catch (err) {
    console.error('Error adding book:', err);
    res.status(500).json({ error: 'Failed to create book.' });
  }
});

app.patch('/api/books/:id', async (req, res) => {
  try {
    const books = await readJsonFile('books.json');
    const bookId = parseInt(req.params.id, 10);

    const idx = books.findIndex(b => b.id === bookId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const updates = req.body ?? {};
    const updatableFields = ['title', 'author', 'genre', 'year', 'quantity', 'barcode'];
    const hasDelta = Object.prototype.hasOwnProperty.call(updates, 'quantityDelta');
    const hasFieldUpdates = updatableFields.some(field => Object.prototype.hasOwnProperty.call(updates, field));

    if (!hasDelta && !hasFieldUpdates) {
      return res.status(400).json({ error: 'No updates provided.' });
    }

    const book = books[idx];

    if (hasDelta) {
      const deltaValue = Number(updates.quantityDelta);
      if (!Number.isFinite(deltaValue)) {
        return res.status(400).json({ error: 'quantityDelta must be a number.' });
      }
      const current = Number(book.quantity || 0);
      const next = Math.max(0, current + deltaValue);
      book.quantity = next;
    }

    if (hasFieldUpdates) {
      if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
        const nextTitle = String(updates.title ?? '').trim();
        if (!nextTitle) {
          return res.status(400).json({ error: 'Title is required.' });
        }
        book.title = nextTitle;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'author')) {
        const nextAuthor = String(updates.author ?? '').trim();
        if (!nextAuthor) {
          return res.status(400).json({ error: 'Author is required.' });
        }
        book.author = nextAuthor;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'genre')) {
        book.genre = String(updates.genre ?? '').trim();
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'year')) {
        const value = updates.year;
        if (value === null || value === '') {
          book.year = null;
        } else {
          const yearValue = Number(value);
          if (!Number.isFinite(yearValue)) {
            return res.status(400).json({ error: 'Year must be a number or null.' });
          }
          book.year = yearValue;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'quantity')) {
        const quantityValue = Number(updates.quantity);
        if (!Number.isFinite(quantityValue) || quantityValue < 0) {
          return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
        }
        book.quantity = quantityValue;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'barcode')) {
        const value = updates.barcode;
        if (value === null || value === '') {
          book.barcode = null;
        } else {
          const barcodeValue = Number(value);
          if (!Number.isFinite(barcodeValue)) {
            return res.status(400).json({ error: 'Barcode must be a number or null.' });
          }
          book.barcode = barcodeValue;
        }
      }
    }

    await writeJsonFile('books.json', books);
    res.json(book);
  } catch (err) {
    console.error('Error patching book:', err);
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    const books = await readJsonFile('books.json');
    const bookId = parseInt(req.params.id, 10);

    const updatedBooks = books.filter(b => b.id !== bookId);

    if (updatedBooks.length === books.length) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    await writeJsonFile('books.json', updatedBooks);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// ====================== STUDENTS API ======================

app.get('/api/students', async (req, res) => {
  try {
    const raw = await readJsonFile('students.json');
    const cleaned = Array.isArray(raw) 
      ? raw.map(pickStudentFields).filter(Boolean)
      : [];
    
    res.json(cleaned);
  } catch (err) {
    console.error('Error reading students:', err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    let students = await readJsonFile('students.json');

    let newStudent;
    try {
      newStudent = sanitizeStudentPayload(req.body);
    } catch (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError.message}`
      });
    }

    // Check for duplicate cardId
    const existingCard = students.find(s => s.cardId === newStudent.cardId);
    if (existingCard) {
      return res.status(400).json({
        error: 'A student with this card ID already exists.'
      });
    }

    students = students.map(pickStudentFields).filter(Boolean);
    students.push(newStudent);
    
    await writeJsonFile('students.json', students);
    res.status(201).json(newStudent);
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: 'Failed to add student.' });
  }
});

app.patch('/api/students/:id', async (req, res) => {
  try {
    let students = await readJsonFile('students.json');
    const studentId = parseInt(req.params.id, 10);

    if (!Number.isFinite(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID.' });
    }

    const studentIndex = students.findIndex(s => s.studentId === studentId);
    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    let updatedFields;
    try {
      updatedFields = sanitizeStudentPayload({ ...req.body, studentId });
    } catch (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError.message}`
      });
    }

    updatedFields.studentId = studentId;

    // Check for duplicate cardId (excluding current student)
    if (updatedFields.cardId !== students[studentIndex].cardId) {
      const existingCard = students.find(
        s => s.cardId === updatedFields.cardId && s.studentId !== studentId
      );
      if (existingCard) {
        return res.status(400).json({
          error: 'A student with this card ID already exists.'
        });
      }
    }

    students[studentIndex] = updatedFields;
    students = students.map(pickStudentFields).filter(Boolean);

    await writeJsonFile('students.json', students);
    res.json(updatedFields);
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const students = await readJsonFile('students.json');
    const studentId = parseInt(req.params.id, 10);

    const updated = students.filter(s => s.studentId !== studentId);

    if (updated.length === students.length) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await writeJsonFile('students.json', updated);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student.' });
  }
});

// ====================== TRANSACTIONS API ======================

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await readJsonFile('transactions.json');
    res.json(transactions);
  } catch (err) {
    console.error('Error reading transactions:', err);
    res.status(500).json({ error: 'Failed to load transactions.' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transactions = await readJsonFile('transactions.json');
    const { studentId, bookId, action, date } = req.body;

    if (!studentId || !bookId || !action) {
      return res.status(400).json({
        error: 'Missing required fields: studentId, bookId, action.'
      });
    }

    const studentIdNum = Number(studentId);
    const bookIdNum = Number(bookId);
    if (!Number.isFinite(studentIdNum) || !Number.isFinite(bookIdNum)) {
      return res.status(400).json({ error: 'Invalid studentId or bookId.' });
    }

    const actionNormalized = String(action);
    if (!['taken', 'returned'].includes(actionNormalized)) {
      return res.status(400).json({
        error: 'action must be either "taken" or "returned".'
      });
    }

    const dateStr = date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        error: 'Invalid date format (expected yyyy-mm-dd).'
      });
    }

    let warnValue;
    if (actionNormalized === 'returned') {
      const balance = transactions.reduce((acc, tr) => {
        if (Number(tr.studentId) !== studentIdNum || Number(tr.bookId) !== bookIdNum) {
          return acc;
        }
        if (tr.action === 'taken') return acc + 1;
        if (tr.action === 'returned') return acc - 1;
        return acc;
      }, 0);

      if (balance <= 0) {
        return res.status(409).json({
          error: 'Transaction rejected: no outstanding issue found for this student/book pair.'
        });
      }

      const pairTransactions = transactions
        .filter(tr => Number(tr.studentId) === studentIdNum && Number(tr.bookId) === bookIdNum)
        .sort((a, b) => getTransactionOrderValue(a) - getTransactionOrderValue(b));

      const openTakens = [];
      for (const tr of pairTransactions) {
        if (tr.action === 'taken') {
          openTakens.push(tr);
        } else if (tr.action === 'returned' && openTakens.length > 0) {
          openTakens.shift();
        }
      }

      const relatedTaken = openTakens.length > 0 ? openTakens[0] : null;
      const dueDateStr = typeof relatedTaken?.date === 'string' ? relatedTaken.date : null;
      if (dueDateStr) {
        const dueTime = Date.parse(dueDateStr);
        const returnTime = Date.parse(dateStr);
        if (Number.isFinite(dueTime) && Number.isFinite(returnTime)) {
          warnValue = returnTime > dueTime;
        }
      }
    }

    const newTransaction = {
      id: Date.now(),
      studentId: studentIdNum,
      bookId: bookIdNum,
      action: actionNormalized,
      date: dateStr,
    };

    if (typeof warnValue === 'boolean' && warnValue) {
      newTransaction.warn = true;
    }

    transactions.push(newTransaction);
    await writeJsonFile('transactions.json', transactions);
    res.status(201).json(newTransaction);
  } catch (err) {
    console.error('Error adding transaction:', err);
    res.status(500).json({ error: 'Unexpected error while recording the transaction.' });
  }
});

// ====================== STATS API ======================

app.get('/api/stats', async (req, res) => {
  try {
    const [books, transactions] = await Promise.all([
      readJsonFile('books.json'),
      readJsonFile('transactions.json')
    ]);

    const total = Array.isArray(books) ? books.length : 0;

    // Calculate books on hands (net taken - returned per book)
    const netByBook = {};
    for (const t of Array.isArray(transactions) ? transactions : []) {
      if (!t.bookId) continue;
      
      if (t.action === 'taken') {
        netByBook[t.bookId] = (netByBook[t.bookId] || 0) + 1;
      } else if (t.action === 'returned') {
        netByBook[t.bookId] = (netByBook[t.bookId] || 0) - 1;
      }
    }
    const onHands = Object.values(netByBook).reduce((acc, v) => acc + Math.max(0, v), 0);

    // Calculate overdue: books with last "taken" action before today and no subsequent "returned"
    const today = new Date().toISOString().slice(0, 10);
    const lastActionByPair = new Map();
    
    for (const t of Array.isArray(transactions) ? transactions : []) {
      const key = `${t.studentId}:${t.bookId}`;
      const prev = lastActionByPair.get(key);
      
      if (!prev || getTransactionOrderValue(t) > getTransactionOrderValue(prev)) {
        lastActionByPair.set(key, t);
      }
    }

    let overdue = 0;
    for (const [, lastAction] of lastActionByPair) {
      if (lastAction.action === 'taken' && lastAction.date && lastAction.date < today) {
        overdue++;
      }
    }

    res.json({
      total,
      onHands,
      overdue,
      newThisMonth: 0, // TODO: Implement if needed
      writtenOff: 0,   // TODO: Implement if needed
    });
  } catch (err) {
    console.error('Error computing stats:', err);
    res.status(500).json({ error: 'Failed to compute stats.' });
  }
});

// ====================== STUDENT HISTORY API ======================

app.get('/api/students/:id/history', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(studentId)) {
      return res.status(400).json({ error: 'Invalid student id.' });
    }

    const [studentsRaw, booksRaw, transactionsRaw] = await Promise.all([
      readJsonFile('students.json'),
      readJsonFile('books.json'),
      readJsonFile('transactions.json')
    ]);

    const students = Array.isArray(studentsRaw) ? studentsRaw : [];
    const books = Array.isArray(booksRaw) ? booksRaw : [];
    const transactions = Array.isArray(transactionsRaw) ? transactionsRaw : [];

    const student = students.find(s => Number(s.studentId) === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const bookMap = new Map(
      books.map(book => [Number(book.id), book])
    );

    const studentTransactions = transactions
      .filter(tr => Number(tr.studentId) === studentId)
      .sort((a, b) => getTransactionOrderValue(a) - getTransactionOrderValue(b));

    const pendingByBook = new Map();
    const history = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const toTime = (value) => {
      if (!value) return Number.NaN;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const buildEntry = (taken, returned) => {
      const related = taken ?? returned ?? null;
      const bookId = Number(related?.bookId);
      const book = bookMap.get(bookId) || null;
      const dueDate = typeof taken?.date === 'string' ? taken.date : null;
      const returnDate = typeof returned?.date === 'string' ? returned.date : null;

      const dueTime = toTime(dueDate);
      const returnTime = toTime(returnDate);

      let status = 'on-hands';
      let overdue = false;

      if (returnDate) {
        overdue =
          (Number.isFinite(dueTime) && Number.isFinite(returnTime) && returnTime > dueTime) ||
          Boolean(returned?.warn);
        status = overdue ? 'returned-late' : 'returned';
      } else {
        overdue = Number.isFinite(dueTime) && dueTime < todayMs;
        status = overdue ? 'overdue' : 'on-hands';
      }

      const statusLabel = (() => {
        switch (status) {
          case 'returned-late':
            return 'Возвращена с просрочкой';
          case 'returned':
            return 'Возвращена вовремя';
          case 'overdue':
            return 'На руках (просрочено)';
          default:
            return 'На руках';
        }
      })();

      const referenceTime = Number.isFinite(returnTime)
        ? returnTime
        : (Number.isFinite(dueTime) ? dueTime : 0);

      history.push({
        id: `${studentId}-${bookId}-${taken?.id ?? 'open'}-${returned?.id ?? 'pending'}`,
        bookId: book?.id ?? null,
        title: book?.title ?? '—',
        author: book?.author ?? '—',
        dueDate,
        returnDate,
        overdue,
        status,
        statusLabel,
        referenceTime,
        warn: Boolean(taken?.warn || returned?.warn),
      });
    };

    for (const tr of studentTransactions) {
      const bookId = Number(tr.bookId);
      if (!pendingByBook.has(bookId)) {
        pendingByBook.set(bookId, []);
      }

      if (tr.action === 'taken') {
        pendingByBook.get(bookId).push(tr);
      } else if (tr.action === 'returned') {
        const queue = pendingByBook.get(bookId);
        const taken = queue && queue.length > 0 ? queue.shift() : null;
        buildEntry(taken, tr);
      }
    }

    for (const queue of pendingByBook.values()) {
      for (const taken of queue) {
        buildEntry(taken, null);
      }
    }

    history.sort((a, b) => b.referenceTime - a.referenceTime);

    const summary = {
      total: history.length,
      active: history.filter(item => !item.returnDate).length,
      overdue: history.filter(item => item.overdue).length,
    };

    res.json({
      student: {
        studentId,
        name: student.name,
        grade: student.grade,
        gradeLetter: student.gradeLetter,
      },
      history,
      summary,
    });
  } catch (err) {
    console.error('Error building student history:', err);
    res.status(500).json({ error: 'Failed to load student history.' });
  }
});

// ====================== SCANNER API ======================

app.get('/api/scan/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    
    if (!code) {
      return res.status(400).json({ error: 'Scan code is required.' });
    }

    const [books, students] = await Promise.all([
      readJsonFile('books.json'),
      readJsonFile('students.json')
    ]);

    // Search in books by barcode
    const book = books.find(b => String(b.barcode).toLowerCase() === code);
    if (book) {
      return res.json({ type: 'book', data: book });
    }

    // Search in students by normalized cardId
    const student = students.find(s => {
      const normalizedCardId = normalizeCardId(s.cardId);
      return normalizedCardId === code;
    });
    
    if (student) {
      const cleaned = pickStudentFields(student);
      return res.json({ type: 'student', data: cleaned });
    }

    res.status(404).json({ error: 'No matching record found.' });
  } catch (err) {
    console.error('Error scanning code:', err);
    res.status(500).json({ error: 'Failed to process scan request.' });
  }
});

// ====================== MAINTENANCE API ======================

// One-time cleanup endpoint to normalize student data
app.post('/api/students/cleanup', async (req, res) => {
  try {
    const raw = await readJsonFile('students.json');
    const beforeCount = Array.isArray(raw) ? raw.length : 0;

    const cleaned = (Array.isArray(raw) ? raw : [])
      .map(pickStudentFields)
      .filter(Boolean);

    await writeJsonFile('students.json', cleaned);
    
    res.json({ 
      success: true, 
      before: beforeCount, 
      after: cleaned.length,
      removed: beforeCount - cleaned.length 
    });
  } catch (err) {
    console.error('Error cleaning students file:', err);
    res.status(500).json({ error: 'Failed to normalize students list.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ====================== 404 HANDLER ======================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ====================== SERVER START ======================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Data directory: ${path.join(__dirname, 'data')}`);
  console.log(`API available at http://${ipAddress}/api`);
});


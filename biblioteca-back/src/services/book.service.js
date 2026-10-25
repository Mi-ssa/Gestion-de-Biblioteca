const { randomUUID } = require('node:crypto');
const booksModel = require('../models/book.model');
const loansModel = require('../models/loan.model');
const withOperationLock = require('./operation-lock');

function validateBook(input) {
  const book = {
    isbn: String(input.isbn || '').trim(),
    titulo: String(input.titulo || '').trim(),
    autor: String(input.autor || '').trim(),
    categoria: String(input.categoria || '').trim(),
    stockTotal: Number(input.stockTotal),
  };
  if (!book.isbn || !book.titulo || !book.autor || !book.categoria) {
    throw Object.assign(new Error('ISBN, título, autor y categoría son obligatorios.'), { status: 400 });
  }
  if (!Number.isInteger(book.stockTotal) || book.stockTotal < 0) {
    throw Object.assign(new Error('El stock total debe ser un entero mayor o igual a cero.'), { status: 400 });
  }
  return book;
}

async function listBooks(filters = {}) {
  const books = await booksModel.findAll();
  const title = String(filters.titulo || '').trim().toLocaleLowerCase();
  const author = String(filters.autor || '').trim().toLocaleLowerCase();
  const category = String(filters.categoria || '').trim().toLocaleLowerCase();
  const available = filters.disponibilidad;
  return books.filter((book) => (
    (!title || book.titulo.toLocaleLowerCase().includes(title))
    && (!author || book.autor.toLocaleLowerCase().includes(author))
    && (!category || book.categoria.toLocaleLowerCase().includes(category))
    && (available !== 'true' || book.stockDisponible > 0)
    && (available !== 'false' || book.stockDisponible === 0)
  ));
}

async function createBook(input) {
  return withOperationLock(async () => {
    const book = validateBook(input);
    const books = await booksModel.findAll();
    if (books.some((item) => item.isbn.toLocaleLowerCase() === book.isbn.toLocaleLowerCase())) {
      throw Object.assign(new Error('Ya existe un libro con ese ISBN.'), { status: 409 });
    }
    const created = {
      id: randomUUID(),
      ...book,
      stockDisponible: book.stockTotal,
      createdAt: new Date().toISOString(),
    };
    await booksModel.saveAll([...books, created]);
    return created;
  });
}

async function updateBook(id, input) {
  return withOperationLock(async () => {
    const bookInput = validateBook(input);
    const [books, loans] = await Promise.all([booksModel.findAll(), loansModel.findAll()]);
    const index = books.findIndex((item) => item.id === id);
    if (index < 0) throw Object.assign(new Error('Libro no encontrado.'), { status: 404 });
    if (books.some((item) => item.id !== id && item.isbn.toLocaleLowerCase() === bookInput.isbn.toLocaleLowerCase())) {
      throw Object.assign(new Error('Ya existe un libro con ese ISBN.'), { status: 409 });
    }
    const activeCount = loans.filter((loan) => loan.libroId === id && loan.estado === 'activo').length;
    if (bookInput.stockTotal < activeCount) {
      throw Object.assign(new Error(`El stock total no puede ser menor que los ${activeCount} préstamos activos.`), { status: 400 });
    }
    const updated = {
      ...books[index],
      ...bookInput,
      stockDisponible: bookInput.stockTotal - activeCount,
    };
    books[index] = updated;
    await booksModel.saveAll(books);
    return updated;
  });
}

async function deleteBook(id) {
  return withOperationLock(async () => {
    const [books, loans] = await Promise.all([booksModel.findAll(), loansModel.findAll()]);
    const book = books.find((item) => item.id === id);
    if (!book) throw Object.assign(new Error('Libro no encontrado.'), { status: 404 });
    if (loans.some((loan) => loan.libroId === id && loan.estado === 'activo')) {
      throw Object.assign(new Error('No se puede eliminar un libro con préstamos activos.'), { status: 409 });
    }
    await booksModel.saveAll(books.filter((item) => item.id !== id));
    return book;
  });
}

module.exports = { listBooks, createBook, updateBook, deleteBook };

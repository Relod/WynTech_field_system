'use strict';

const { ApiError } = require('./http');

function fail(field, message) {
  throw new ApiError(400, 'VALIDATION_ERROR', message, { field });
}

function requiredString(value, field, maxLength = 255) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(field, `O campo ${field} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    fail(field, `O campo ${field} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized;
}

function optionalString(value, field, maxLength = 255) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    fail(field, `O campo ${field} deve ser texto.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    fail(field, `O campo ${field} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized || null;
}

function requiredInt(value, field, { min = 1 } = {}) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    fail(field, `O campo ${field} deve ser um número inteiro válido.`);
  }
  return parsed;
}

function optionalInt(value, field, { min = 1 } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return requiredInt(value, field, { min });
}

function enumValue(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(field, `O campo ${field} deve ser um dos valores: ${allowed.join(', ')}.`);
  }
  return value;
}

function optionalEnum(value, allowed, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return enumValue(value, allowed, field);
}

function dateValue(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(field, `O campo ${field} deve estar no formato AAAA-MM-DD.`);
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(field, `O campo ${field} contém uma data inválida.`);
  }
  return value;
}

function optionalDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return dateValue(value, field);
}

function objectValue(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(field, `O campo ${field} deve ser um objeto.`);
  }
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '20', 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

module.exports = {
  requiredString,
  optionalString,
  requiredInt,
  optionalInt,
  enumValue,
  optionalEnum,
  dateValue,
  optionalDate,
  objectValue,
  isPlainObject,
  parsePagination,
  escapeLike,
};

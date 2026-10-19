'use strict';

const { ApiError } = require('./http');

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({
      method: String(method).toUpperCase(),
      parts: pattern.split('/').filter(Boolean),
      pattern,
      handler,
    });
    return this;
  }

  get(pattern, handler) {
    return this.add('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.add('POST', pattern, handler);
  }

  put(pattern, handler) {
    return this.add('PUT', pattern, handler);
  }

  patch(pattern, handler) {
    return this.add('PATCH', pattern, handler);
  }

  delete(pattern, handler) {
    return this.add('DELETE', pattern, handler);
  }

  match(method, pathname) {
    const requestMethod = String(method).toUpperCase();
    const parts = pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== requestMethod) continue;
      if (route.parts.length !== parts.length) continue;

      const params = {};
      let matched = true;
      for (let index = 0; index < route.parts.length; index += 1) {
        const routePart = route.parts[index];
        const requestPart = parts[index];
        if (routePart.startsWith(':')) {
          try {
            params[routePart.slice(1)] = decodeURIComponent(requestPart);
          } catch {
            throw new ApiError(400, 'INVALID_PATH', 'Caminho da requisição inválido.');
          }
        } else if (routePart !== requestPart) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params, route };
    }

    return null;
  }
}

module.exports = { Router };

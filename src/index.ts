import { Hono } from 'hono'
import {serveStatic} from 'hono/bun'
import { auth } from './lib/auth'

const app = new Hono()

// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw))

// serve the frontend SPA build
// hack to serve SPA
// https://github.com/honojs/hono/issues/1859
app.use('/*', serveStatic({
  root: './src/frontend/dist'
})).use("*", serveStatic({
  path: 'index.html',
  root: './src/frontend/dist'
}))
 
export default app

import { Hono } from 'hono'
import {serveStatic} from 'hono/bun'
import { auth } from './lib/auth'

const app = new Hono()

// serve the frontend SPA build
app.use('/*', serveStatic({
  root: './src/frontend/dist'
}))
 
// better-auth setup
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw))

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
